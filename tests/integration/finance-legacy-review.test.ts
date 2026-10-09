import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { createDatabase, withTenantDb } from "@/lib/db";
import type { AccessContext } from "@/lib/dal";
import { financialEntries, financialExpenses } from "@/lib/db/schema";
import { getFinancialLegacyReview, releaseFinancialLegacyReserve } from "@/features/finance/legacy-review";
import { titleSettledAmount } from "@/features/finance/ledger";
import { createFinancialAllocations } from "@/features/finance-allocations/dal";
import { reverseFinancialTransaction } from "@/features/finance-transactions/reversal";

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
const reason = "Baixa duplicada no sistema antigo";
const evidence = "Extrato conferido: lançamento inexistente no banco";
const input = (type: "receivable" | "payable", id: string, amount = "40.00") => ({ type, id, amount, reason, evidence, confirmed: "yes", requestId: randomUUID() });
beforeAll(async () => {
  await admin.execute(sql`insert into organizations (id,name,slug) values (${org},'Legacy review test',${org}),(${other},'Other legacy review',${other})`);
  await admin.execute(sql`insert into "user" (id,organization_id,name,email) values (${user},${org},'Review QA',${`${user}@example.test`})`);
  await admin.execute(sql`insert into financial_accounts (id,organization_id,name,type) values (${account},${org},'Review account','bank')`);
});
afterAll(async () => {
  audit.fail = false;
  await admin.transaction(async tx => {
    for (const [table, trigger] of [["financial_legacy_releases", "financial_legacy_release_guard"], ["financial_allocations", "financial_allocations_immutable_guard"], ["financial_transaction_reversals", "financial_reversals_immutable"]]) {
      await tx.execute(sql.raw(`alter table ${table} disable trigger ${trigger}`));
      await tx.execute(sql`delete from ${sql.identifier(table)} where organization_id=${org}`);
      await tx.execute(sql.raw(`alter table ${table} enable trigger ${trigger}`));
    }
    for (const table of ["work_items", "audit_logs", "financial_transactions", "financial_entries", "financial_expenses", "financial_accounts", "user"]) await tx.execute(sql`delete from ${sql.identifier(table)} where organization_id=${org}`);
    await tx.execute(sql`delete from organizations where id in (${org},${other})`);
  });
  await admin.$client.end();
});
async function title(type: "receivable" | "payable") {
  const id = randomUUID();
  await admin.execute(type === "receivable"
    ? sql`insert into financial_entries (id,organization_id,description,amount,legacy_settled_amount,due_date,competence,responsible_user_id) values (${id},${org},'Legacy AR',100,40,'2026-10-10','2026-10',${user})`
    : sql`insert into financial_expenses (id,organization_id,supplier,category,description,amount,legacy_settled_amount,due_date,competence,responsible_user_id) values (${id},${org},'Supplier','QA','Legacy AP',100,40,'2026-10-10','2026-10',${user})`);
  return id;
}
it("releases AR/AP reservations without changing baseline or cash, allows reconciliation and preserves release on reversal", async () => {
  for (const type of ["receivable", "payable"] as const) {
    const id = await title(type), request = input(type, id), movement = randomUUID();
    const beforeMovements = (await admin.execute(sql`select count(*)::int n from financial_transactions where organization_id=${org}`)).rows[0].n;
    const first = await releaseFinancialLegacyReserve(context, request);
    expect((await releaseFinancialLegacyReserve(context, request)).id).toBe(first.id);
    expect((await getFinancialLegacyReview(context, { type, id })).title).toMatchObject({ originalReserve: "40.00", reserved: "0.00", confirmedAmount: "0.00" });
    expect((await admin.execute(sql`select count(*)::int n from financial_transactions where organization_id=${org}`)).rows[0].n).toBe(beforeMovements);
    await admin.execute(sql`insert into financial_transactions (id,organization_id,account_id,direction,amount,occurred_at,created_by_user_id) values (${movement},${org},${account},${type === "receivable" ? "in" : "out"},100,now(),${user})`);
    await createFinancialAllocations(context, { transactionId: movement, allocations: [{ targetType: type, targetId: id, amount: "100.00" }] });
    const table = type === "receivable" ? financialEntries : financialExpenses;
    expect(await withTenantDb(context, tx => tx.select({ settled: titleSettledAmount(type) }).from(table).where(eq(table.id, id)))).toEqual([{ settled: "100.00" }]);
    await reverseFinancialTransaction(context, { transactionId: movement, reason: "Movimento incorreto após revisão" });
    expect(await withTenantDb(context, tx => tx.select({ settled: titleSettledAmount(type) }).from(table).where(eq(table.id, id)))).toEqual([{ settled: "0.00" }]);
    await expect(withTenantDb(context, tx => tx.execute(sql`update financial_legacy_releases set amount=1 where id=${first.id}`))).rejects.toMatchObject({ cause: { code: "55000" } });
    await expect(withTenantDb(context, tx => tx.execute(sql`delete from financial_legacy_releases where id=${first.id}`))).rejects.toMatchObject({ cause: { code: "55000" } });
    expect((await withTenantDb({ ...context, organizationId: other }, tx => tx.execute(sql`select id from financial_legacy_releases where id=${first.id}`))).rows).toHaveLength(0);
  }
});
it("serializes competing reviews and the database rejects over-release", async () => {
  const id = await title("receivable");
  const results = await Promise.allSettled([releaseFinancialLegacyReserve(context, input("receivable", id, "30.00")), releaseFinancialLegacyReserve(context, input("receivable", id, "30.00"))]);
  expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
  expect((await getFinancialLegacyReview(context, { type: "receivable", id })).title.reserved).toBe("10.00");
  await expect(withTenantDb(context, tx => tx.execute(sql`insert into financial_legacy_releases (organization_id,financial_entry_id,request_id,amount,reason,evidence,created_by_user_id) values (${org},${id},${randomUUID()},11,${reason},${evidence},${user})`))).rejects.toMatchObject({ cause: { code: "23514" } });
});
it("rejects permissions, IDOR, RLS writes, tampering, short evidence and request reuse", async () => {
  const id = await title("payable"), request = input("payable", id);
  await expect(releaseFinancialLegacyReserve({ ...context, permissions: ["finance.write"] }, request)).rejects.toThrow();
  await expect(releaseFinancialLegacyReserve({ ...context, organizationId: other }, request)).rejects.toThrow();
  await expect(releaseFinancialLegacyReserve(context, { ...request, organizationId: other })).rejects.toThrow();
  await expect(releaseFinancialLegacyReserve(context, { ...request, evidence: "ok" })).rejects.toThrow();
  await expect(releaseFinancialLegacyReserve(context, { ...request, confirmed: "no" })).rejects.toThrow();
  await expect(withTenantDb({ ...context, organizationId: other }, tx => tx.execute(sql`insert into financial_legacy_releases (organization_id,financial_expense_id,request_id,amount,reason,evidence,created_by_user_id) values (${org},${id},${randomUUID()},1,${reason},${evidence},${user})`))).rejects.toMatchObject({ cause: { code: "42501" } });
  await releaseFinancialLegacyReserve(context, request);
  await expect(releaseFinancialLegacyReserve(context, { ...request, amount: "1.00" })).rejects.toThrow(/solicitação/);
});
it("rolls back release and cached title state when audit fails", async () => {
  const id = await title("receivable");
  audit.fail = true;
  await expect(releaseFinancialLegacyReserve(context, input("receivable", id))).rejects.toThrow("audit unavailable");
  audit.fail = false;
  const review = await getFinancialLegacyReview(context, { type: "receivable", id });
  expect(review.title.reserved).toBe("40.00");
  expect(review.history).toHaveLength(0);
});
