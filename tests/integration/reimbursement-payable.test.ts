import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { createDatabase, getDb, withTenantDb } from "@/lib/db";
import type { AccessContext } from "@/lib/dal";
import { createReimbursementPayable } from "@/features/portal/reimbursement-payable";
import { listReimbursements } from "@/features/portal/dal";
import { createFinancialAllocations } from "@/features/finance-allocations/dal";
import { reverseFinancialTransaction } from "@/features/finance-transactions/reversal";
import { includeReimbursementInInvoiceAction, markReimbursementPaidAction } from "@/features/portal/actions";

const audit = vi.hoisted(() => ({ fail: false }));
const current = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/dal", async original => ({ ...await original<typeof import("@/lib/dal")>(),
  getCurrentAccessContext: current,
  bindCurrentTenantContext: (operation: (data: FormData) => Promise<void>) => (data: FormData) => withTenantDb(current(), () => operation(data)),
}));
vi.mock("@/lib/audit", async original => {
  const actual = await original<typeof import("@/lib/audit")>();
  return { ...actual, createAuditLogValues: (...args: Parameters<typeof actual.createAuditLogValues>) => {
    if (audit.fail) throw new Error("audit unavailable");
    return actual.createAuditLogValues(...args);
  } };
});
const admin = createDatabase(process.env.DATABASE_TEST_ADMIN_URL!, { allowExitOnIdle: true });
const org = randomUUID(), other = randomUUID(), user = randomUUID(), employee = randomUUID(), category = randomUUID(), account = randomUUID();
const context: AccessContext = { organizationId: org, userId: user, employeeId: employee, roles: [], permissions: ["finance.write", "finance.read", "finance.settle", "finance.reverse", "reimbursements.approve_finance", "reimbursements.read"] };
beforeAll(async () => {
  current.mockResolvedValue(context);
  const area = randomUUID(), position = randomUUID();
  await admin.execute(sql`insert into organizations (id,name,slug) values (${org},'Direct reim',${org}),(${other},'Other direct reim',${other})`);
  await admin.execute(sql`insert into "user" (id,organization_id,name,email) values (${user},${org},'Reim QA',${`${user}@example.test`})`);
  await admin.execute(sql`insert into areas (id,organization_id,name) values (${area},${org},'QA')`);
  await admin.execute(sql`insert into positions (id,organization_id,name) values (${position},${org},'QA')`);
  await admin.execute(sql`insert into employees (id,organization_id,registration_number,full_name,position_id,area_id,employment_type,start_date,current_compensation) values (${employee},${org},'REIM','Employee reimbursement',${position},${area},'pj','2026-01-01',1000)`);
  await admin.execute(sql`insert into financial_categories (id,organization_id,name,nature) values (${category},${org},'Reim','expense')`);
  await admin.execute(sql`insert into financial_accounts (id,organization_id,name,type) values (${account},${org},'Reim account','bank')`);
});
afterAll(async () => {
  await admin.transaction(async tx => {
    await tx.execute(sql`alter table financial_allocations disable trigger financial_allocations_immutable_guard`);
    await tx.execute(sql`alter table financial_transaction_reversals disable trigger financial_reversals_immutable`);
    for (const table of ["audit_logs", "work_items", "financial_transaction_reversals", "financial_allocations", "financial_transactions", "reimbursement_requests", "invoice_requests", "financial_expenses", "financial_accounts", "financial_categories", "employees", "positions", "areas", "user"]) await tx.execute(sql`delete from ${sql.identifier(table)} where organization_id=${org}`);
    await tx.execute(sql`delete from organizations where id in (${org},${other})`);
    await tx.execute(sql`alter table financial_allocations enable trigger financial_allocations_immutable_guard`);
    await tx.execute(sql`alter table financial_transaction_reversals enable trigger financial_reversals_immutable`);
  });
  await admin.$client.end(); await getDb().$client.end();
});
async function request(status = "finance_approved") {
  const id = randomUUID();
  await admin.execute(sql`insert into reimbursement_requests (id,organization_id,employee_id,title,category,amount,expense_date,status) values (${id},${org},${employee},'Direct test','Transport',100,'2026-10-01',${status}::reimbursement_status)`);
  return id;
}
const input = (reimbursementId: string) => ({ reimbursementId, dueDate: "2026-10-15", competence: "2026-10", categoryId: category, costCenterId: null });
async function movement(amount: number) {
  const id = randomUUID();
  await admin.execute(sql`insert into financial_transactions (id,organization_id,account_id,direction,amount,occurred_at,created_by_user_id) values (${id},${org},${account},'out',${amount},now(),${user})`);
  return id;
}
it("creates exactly one payable concurrently, derives partial/full payment and reopens on reversal", async () => {
  const id = await request();
  const [first, second] = await Promise.all([createReimbursementPayable(context, input(id)), createReimbursementPayable(context, input(id))]);
  expect(second.expenseId).toBe(first.expenseId);
  expect((await admin.execute(sql`select count(*)::int n from financial_expenses where organization_id=${org}`)).rows[0].n).toBe(1);
  const a = await movement(40), b = await movement(60);
  await createFinancialAllocations(context, { transactionId: a, allocations: [{ targetType: "payable", targetId: first.expenseId, amount: "40.00" }] });
  expect((await listReimbursements(context)).find(r => r.id === id)).toMatchObject({ status: "finance_approved", invoicePaymentLabel: "Conta a pagar avulsa parcialmente paga", paidAt: null });
  await createFinancialAllocations(context, { transactionId: b, allocations: [{ targetType: "payable", targetId: first.expenseId, amount: "60.00" }] });
  expect((await listReimbursements({ ...context, permissions: ["reimbursements.read_own"] }, { ownOnly: true })).find(r => r.id === id)).toMatchObject({ status: "paid", invoicePaymentLabel: "Pago pela conciliação da conta a pagar avulsa", paidAt: expect.any(Date) });
  await reverseFinancialTransaction(context, { transactionId: b, reason: "Wrong payment" });
  expect((await listReimbursements(context)).find(r => r.id === id)).toMatchObject({ status: "finance_approved", invoicePaymentLabel: "Conta a pagar avulsa parcialmente paga" });
  expect((await admin.execute(sql`select status,paid_at from reimbursement_requests where id=${id}`)).rows[0]).toEqual({ status: "finance_approved", paid_at: null });
  await expect(withTenantDb(context, tx => tx.execute(sql`update reimbursement_requests set financial_expense_id=null where id=${id}`))).rejects.toMatchObject({ cause: { code: "55000" } });
});
it("rejects legacy payment, unapproved requests, tampering, wrong organization and missing permission", async () => {
  for (const status of ["submitted", "paid"]) await expect(createReimbursementPayable(context, input(await request(status)))).rejects.toThrow();
  const historical = await request();
  await admin.execute(sql`update reimbursement_requests set paid_at=now() where id=${historical}`);
  await expect(createReimbursementPayable(context, input(historical))).rejects.toThrow("históricos");
  const id = await request();
  await expect(createReimbursementPayable({ ...context, organizationId: other }, input(id))).rejects.toThrow();
  await expect(createReimbursementPayable({ ...context, permissions: ["finance.write"] }, input(id))).rejects.toThrow();
  await expect(createReimbursementPayable(context, { ...input(id), amount: "1.00" })).rejects.toThrow();
  await expect(createReimbursementPayable(context, { ...input(id), categoryId: randomUUID() })).rejects.toThrow();
});
it("rolls back source and payable on audit failure", async () => {
  const id = await request(); audit.fail = true;
  try { await expect(createReimbursementPayable(context, input(id))).rejects.toThrow("audit unavailable"); }
  finally { audit.fail = false; }
  expect((await admin.execute(sql`select financial_expense_id from reimbursement_requests where id=${id}`)).rows[0].financial_expense_id).toBeNull();
});

it("preserves approved obligations for an archived employee", async () => {
  const id = await request();
  await admin.execute(sql`update employees set deleted_at=now() where id=${employee}`);
  try {
    const payable = await createReimbursementPayable(context, input(id));
    expect((await admin.execute(sql`select supplier,amount from financial_expenses where id=${payable.expenseId}`)).rows[0]).toEqual({ supplier: "Employee reimbursement", amount: "100.00" });
  } finally { await admin.execute(sql`update employees set deleted_at=null where id=${employee}`); }
});

it("blocks direct settlement and mutually exclusive invoice/payable origins on the server", async () => {
  // The binding mock reads the synchronous value to enter the same real tenant transaction.
  current.mockReturnValue({ ...context, permissions: [...context.permissions, "invoices.write"] });
  const invoice = randomUUID(), id = await request(), linked = await request();
  await admin.execute(sql`insert into invoice_requests (id,organization_id,employee_id,competence,due_date,expected_amount,suggested_description,created_by_user_id) values (${invoice},${org},${employee},'2026-10','2026-10-15',100,'Test invoice',${user})`);
  await createReimbursementPayable(context, input(id));
  const include = new FormData(); include.set("reimbursementId", id); include.set("invoiceRequestId", invoice);
  await expect(includeReimbursementInInvoiceAction(include)).rejects.toThrow("avulsa");
  await admin.execute(sql`update reimbursement_requests set included_invoice_request_id=${invoice} where id=${linked}`);
  await expect(createReimbursementPayable(context, input(linked))).rejects.toThrow("NF");
  const direct = new FormData(); direct.set("id", id);
  await expect(markReimbursementPaidAction(direct)).rejects.toThrow("Baixa direta descontinuada");
  expect((await admin.execute(sql`select status,paid_at from reimbursement_requests where id=${id}`)).rows[0]).toEqual({ status: "finance_approved", paid_at: null });
});
