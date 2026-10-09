import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { createDatabase, getDb, withTenantDb } from "@/lib/db";
import type { AccessContext } from "@/lib/dal";
import { createFinancialAllocations } from "@/features/finance-allocations/dal";
import { reverseFinancialTransaction } from "@/features/finance-transactions/reversal";
import { getCashReport } from "@/features/finance/cash-report";

const audit = vi.hoisted(() => ({ fail: false }));
vi.mock("@/lib/audit", async original => {
  const actual = await original<typeof import("@/lib/audit")>();
  return { ...actual, createAuditLogValues: (...args: Parameters<typeof actual.createAuditLogValues>) => {
    if (audit.fail) throw new Error("audit unavailable");
    return actual.createAuditLogValues(...args);
  } };
});
const admin = createDatabase(process.env.DATABASE_TEST_ADMIN_URL!, { allowExitOnIdle: true });
const org = randomUUID(), other = randomUUID(), user = randomUUID(), account = randomUUID();
const context: AccessContext = { organizationId: org, userId: user, employeeId: null, roles: [], permissions: ["finance.read", "finance.write", "finance.settle", "finance.reverse"] };
beforeAll(async () => {
  await admin.execute(sql`insert into organizations (id,name,slug) values (${org},'Reversal test',${org}),(${other},'Other reversal',${other})`);
  await admin.execute(sql`insert into "user" (id,organization_id,name,email) values (${user},${org},'Reversal QA',${`${user}@example.test`})`);
  await admin.execute(sql`insert into financial_accounts (id,organization_id,name,type) values (${account},${org},'Reversal account','bank')`);
});
afterAll(async () => {
  audit.fail = false;
  await admin.transaction(async tx => {
    await tx.execute(sql`alter table financial_transaction_reversals disable trigger financial_reversals_immutable`);
    await tx.execute(sql`alter table financial_allocations disable trigger financial_allocations_immutable_guard`);
    for (const table of ["audit_logs", "work_items", "financial_transaction_reversals", "financial_allocations", "financial_transactions", "financial_entries", "financial_expenses", "financial_accounts", "user"]) await tx.execute(sql`delete from ${sql.identifier(table)} where organization_id=${org}`);
    await tx.execute(sql`delete from organizations where id in (${org},${other})`);
    await tx.execute(sql`alter table financial_transaction_reversals enable trigger financial_reversals_immutable`);
    await tx.execute(sql`alter table financial_allocations enable trigger financial_allocations_immutable_guard`);
  });
  await admin.$client.end(); await getDb().$client.end();
});
async function movement(direction = "in", amount = "100.00") {
  const id = randomUUID();
  await admin.execute(sql`insert into financial_transactions (id,organization_id,account_id,direction,amount,occurred_at,created_by_user_id) values (${id},${org},${account},${direction},${amount},now(),${user})`);
  return id;
}
async function title(payable = false) {
  const id = randomUUID();
  if (payable) await admin.execute(sql`insert into financial_expenses (id,organization_id,supplier,category,description,amount,due_date,competence,responsible_user_id) values (${id},${org},'QA','QA','Reversal payable',100,'2026-10-10','2026-10',${user})`);
  else await admin.execute(sql`insert into financial_entries (id,organization_id,description,amount,received_amount,due_date,competence,responsible_user_id) values (${id},${org},'Reversal receivable',100,0,'2026-10-10','2026-10',${user})`);
  return id;
}
it("reverses a multi-title movement once, keeps allocations and allows new settlement", async () => {
  const transactionId = await movement(), a = await title(), b = await title();
  await createFinancialAllocations(context, { transactionId, allocations: [{ targetType: "receivable", targetId: a, amount: "60.00" }, { targetType: "receivable", targetId: b, amount: "40.00" }] });
  const input = { transactionId, reason: "Recebimento lançado por engano" };
  const [first, repeat] = await Promise.all([reverseFinancialTransaction(context, input), reverseFinancialTransaction(context, input)]);
  expect(first.id).toBe(repeat.id);
  expect((await admin.execute(sql`select received_amount,status from financial_entries where id in (${a},${b})`)).rows).toEqual(expect.arrayContaining([{ received_amount: "0.00", status: "planned" }, { received_amount: "0.00", status: "planned" }]));
  expect((await admin.execute(sql`select count(*)::int n from financial_allocations where transaction_id=${transactionId}`)).rows[0].n).toBe(2);
  const correction = await movement();
  await createFinancialAllocations(context, { transactionId: correction, allocations: [{ targetType: "receivable", targetId: a, amount: "100.00" }] });
  expect((await admin.execute(sql`select received_amount from financial_entries where id=${a}`)).rows[0].received_amount).toBe("100.00");
  await expect(createFinancialAllocations(context, { transactionId, allocations: [{ targetType: "receivable", targetId: b, amount: "1.00" }] })).rejects.toThrow();
  await expect(withTenantDb(context, tx => tx.execute(sql`update financial_transaction_reversals set reason='changed' where id=${first.id}`))).rejects.toMatchObject({ cause: { code: "55000" } });
  expect((await withTenantDb({ ...context, organizationId: other }, tx => tx.execute(sql`select id from financial_transaction_reversals where id=${first.id}`))).rows).toHaveLength(0);
  await expect(withTenantDb({ ...context, organizationId: other }, tx => tx.execute(sql`insert into financial_transaction_reversals (organization_id,transaction_id,amount,reason,created_by_user_id) values (${org},${correction},100,'Cross tenant',${user})`))).rejects.toMatchObject({ cause: { code: "42501" } });
});
it("reopens a payable after reversal without deleting the original payment", async () => {
  const transactionId = await movement("out"), id = await title(true);
  await createFinancialAllocations(context, { transactionId, allocations: [{ targetType: "payable", targetId: id, amount: "100.00" }] });
  await reverseFinancialTransaction(context, { transactionId, reason: "Pagamento duplicado" });
  expect((await admin.execute(sql`select paid_amount,paid_date,status from financial_expenses where id=${id}`)).rows[0]).toMatchObject({ paid_amount: "0.00", paid_date: null, status: "planned" });
  const month = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).slice(0,7);
  expect((await getCashReport(context, { month })).accounts.find(a => a.id === account)).toMatchObject({ reversedExpense: "100.00" });
});
it("rejects cross-tenant, permissions, tampered payload and short reason", async () => {
  const transactionId = await movement();
  const input = { transactionId, reason: "Engano de lançamento" };
  await expect(reverseFinancialTransaction({ ...context, organizationId: other }, input)).rejects.toThrow();
  await expect(reverseFinancialTransaction({ ...context, permissions: ["finance.write"] }, input)).rejects.toThrow();
  await expect(reverseFinancialTransaction(context, { ...input, amount: "1.00" })).rejects.toThrow();
  await expect(reverseFinancialTransaction(context, { ...input, reason: " " })).rejects.toThrow();
});
it("rolls back reversal and balances on audit failure", async () => {
  const transactionId = await movement(), id = await title();
  await createFinancialAllocations(context, { transactionId, allocations: [{ targetType: "receivable", targetId: id, amount: "100.00" }] });
  audit.fail = true;
  try { await expect(reverseFinancialTransaction(context, { transactionId, reason: "Erro de registro" })).rejects.toThrow("audit"); }
  finally { audit.fail = false; }
  expect((await admin.execute(sql`select status from financial_transactions where id=${transactionId}`)).rows[0].status).toBe("reconciled");
  expect((await admin.execute(sql`select received_amount from financial_entries where id=${id}`)).rows[0].received_amount).toBe("100.00");
  expect((await admin.execute(sql`select id from financial_transaction_reversals where transaction_id=${transactionId}`)).rows).toHaveLength(0);
});

it("keeps prior-period cash, compensates at the reversal date and isolates account balances", async () => {
  const cashAccount = randomUUID(), receipt = randomUUID();
  await admin.execute(sql`insert into financial_accounts (id,organization_id,name,type,opening_balance) values (${cashAccount},${org},'Cash period test','bank',10)`);
  const localMonth = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).slice(0,7);
  await admin.execute(sql`insert into financial_transactions (id,organization_id,account_id,direction,amount,occurred_at,created_by_user_id) values
    (${receipt},${org},${cashAccount},'in',100,(${localMonth} || '-01T12:00:00Z')::timestamptz - interval '1 day',${user}),
    (${randomUUID()},${org},${cashAccount},'in',1,(${localMonth} || '-01T01:30:00Z')::timestamptz,${user}),
    (${randomUUID()},${org},${cashAccount},'out',40,(${localMonth} || '-01T12:00:00Z')::timestamptz,${user})`);
  const current = () => getCashReport(context, { month: localMonth });
  expect((await current()).accounts.find(a => a.id === cashAccount)).toMatchObject({ opening: "111.00", income: "0.00", expense: "40.00", closing: "71.00" });
  await reverseFinancialTransaction(context, { transactionId: receipt, reason: "Receipt entered in error" });
  expect((await current()).accounts.find(a => a.id === cashAccount)).toMatchObject({ opening: "111.00", reversedIncome: "100.00", reversedExpense: "0.00", net: "-140.00", closing: "-29.00", untracedReversals: 0 });
  const [previous] = (await admin.execute(sql`select to_char((${localMonth} || '-01')::date - interval '1 month','YYYY-MM') as month`)).rows as Array<{ month: string }>;
  expect((await getCashReport(context, previous)).accounts.find(a => a.id === cashAccount)).toMatchObject({ opening: "10.00", income: "101.00", reversedIncome: "0.00", closing: "111.00" });
  expect((await getCashReport({ ...context, organizationId: other }, { month: localMonth })).accounts).toHaveLength(0);
  await expect(getCashReport({ ...context, permissions: [] }, { month: localMonth })).rejects.toThrow();
  await expect(getCashReport(context, { month: localMonth, organizationId: other })).rejects.toThrow();
  await admin.execute(sql`insert into financial_transactions (organization_id,account_id,direction,amount,occurred_at,created_by_user_id,status) values (${org},${cashAccount},'in',3,now(),${user},'reversed')`);
  expect((await current()).accounts.find(a => a.id === cashAccount)).toMatchObject({ untracedReversals: 1 });
});
