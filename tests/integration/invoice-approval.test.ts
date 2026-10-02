import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { createDatabase, getDb } from "@/lib/db";
import type { AccessContext } from "@/lib/dal";
const current = vi.hoisted(() => vi.fn());
const auditFailure = vi.hoisted(() => ({ enabled: false }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/dal", async original => {
  const actual = await original<typeof import("@/lib/dal")>();
  const { withTenantDb } = await import("@/lib/db");
  return { ...actual, getCurrentAccessContext: current, bindCurrentTenantContext: (operation: (...args: unknown[]) => Promise<unknown>) => (...args: unknown[]) => withTenantDb(current(), () => operation(...args)) };
});
vi.mock("@/lib/audit", async original => {
  const actual = await original<typeof import("@/lib/audit")>();
  return { ...actual, writeAuditLog: (...args: Parameters<typeof actual.writeAuditLog>) => {
    if (auditFailure.enabled) throw new Error("audit failure");
    return actual.writeAuditLog(...args);
  } };
});
import { approveInvoiceRequestAction, markInvoicePaidAction } from "@/features/portal/actions";
import { listInvoiceRequests } from "@/features/portal/dal";
import { createFinancialAllocations } from "@/features/finance-allocations/dal";
const admin = createDatabase(process.env.DATABASE_TEST_ADMIN_URL!, { allowExitOnIdle: true });
const org = randomUUID(), other = randomUUID(), employee = randomUUID(), area = randomUUID(), position = randomUUID(), file = randomUUID();
const user = `approval-${randomUUID()}`;
const context: AccessContext = { organizationId: org, userId: user, employeeId: null, roles: [], permissions: ["invoices.approve"] };
let month = 0;
beforeAll(async () => {
  await admin.execute(sql`insert into organizations (id,name,slug) values (${org},'QA',${org}),(${other},'Other',${other})`);
  await admin.execute(sql`insert into "user" (id,organization_id,name,email) values (${user},${org},'QA',${`${user}@example.test`})`);
  await admin.execute(sql`insert into areas (id,organization_id,name) values (${area},${org},'QA')`);
  await admin.execute(sql`insert into positions (id,organization_id,name) values (${position},${org},'QA')`);
  await admin.execute(sql`insert into employees (id,organization_id,registration_number,full_name,area_id,position_id,employment_type,start_date,current_compensation) values (${employee},${org},${employee},'PJ Approval QA',${area},${position},'pj','2020-01-01',3900)`);
  await admin.execute(sql`insert into files (id,organization_id,owner_employee_id,storage_provider,storage_key,original_name,mime_type,extension,byte_size,uploaded_by_user_id) values (${file},${org},${employee},'local',${file},'qa.pdf','application/pdf','pdf',10,${user})`);
});
afterAll(async () => {
  await admin.transaction(async tx => {
    await tx.execute(sql`alter table financial_allocations disable trigger financial_allocations_immutable_guard`);
    await tx.execute(sql`delete from financial_allocations where organization_id=${org}`);
    await tx.execute(sql`alter table financial_allocations enable trigger financial_allocations_immutable_guard`);
  });
  for (const table of ["audit_logs", "work_items", "financial_transactions", "financial_accounts", "invoice_requests", "financial_expenses", "files", "employees", "areas", "positions", "user"]) await admin.execute(sql`delete from ${sql.identifier(table)} where organization_id=${org}`);
  await admin.execute(sql`delete from organizations where id in (${org},${other})`);
  await admin.$client.end(); await getDb().$client.end();
});
async function invoice(issued = "6150.00", pdf: string | null = file) {
  current.mockReturnValue(context); auditFailure.enabled = false;
  const id = randomUUID(), competence = `2026-${String(++month).padStart(2,"0")}`;
  await admin.execute(sql`insert into invoice_requests (id,organization_id,employee_id,competence,due_date,expected_amount,issued_amount,suggested_description,status,created_by_user_id,file_id) values (${id},${org},${employee},${competence},'2026-12-31',6150,${issued},'Base + ajuda + venda aprovada','submitted',${user},${pdf})`);
  return id;
}
const form = (id: string) => { const data = new FormData(); data.set("id",id); return data; };
const read = async (id: string) => (await admin.execute(sql`select status,financial_expense_id from invoice_requests where id=${id}`)).rows[0];
it("concurrent approvals create exactly one linked unpaid obligation with the complete composition amount", async () => {
  const id = await invoice();
  const results = await Promise.allSettled([approveInvoiceRequestAction(form(id)),approveInvoiceRequestAction(form(id))]);
  expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
  const row = await read(id);
  expect(row.status).toBe("approved");
  expect(row.financial_expense_id).toBeTruthy();
  const expenses = await admin.execute(sql`select amount,paid_amount,supplier,status from financial_expenses where organization_id=${org}`);
  expect(expenses.rows).toEqual([{ amount: "6150.00", paid_amount: "0.00", supplier: "PJ Approval QA", status: "planned" }]);
  expect((await admin.execute(sql`select count(*)::int n from financial_transactions where organization_id=${org}`)).rows[0].n).toBe(0);
});
it("rolls back both approval and payable if audit fails", async () => {
  const id = await invoice();
  const before = (await admin.execute(sql`select id from financial_expenses where organization_id=${org}`)).rows;
  auditFailure.enabled = true;
  await expect(approveInvoiceRequestAction(form(id))).rejects.toThrow("audit failure");
  auditFailure.enabled = false;
  expect(await read(id)).toEqual({ status: "submitted", financial_expense_id: null });
  expect((await admin.execute(sql`select id from financial_expenses where organization_id=${org}`)).rows).toEqual(before);
});
it("denies divergent values, absent PDFs, unprivileged users and other tenants", async () => {
  for (const id of [await invoice("6000.00"),await invoice("6150.00",null)]) {
    await expect(approveInvoiceRequestAction(form(id))).rejects.toThrow();
    expect((await read(id)).financial_expense_id).toBeNull();
  }
  const id = await invoice();
  for (const ctx of [{ ...context, permissions: [] },{ ...context, organizationId: other }]) {
    current.mockReturnValue(ctx);
    await expect(approveInvoiceRequestAction(form(id))).rejects.toThrow();
  }
  expect((await read(id)).status).toBe("submitted");
});
it("shows only reconciled payments to the owner, reopens after a reversal and denies manual paid state", async () => {
  const id = await invoice();
  await approveInvoiceRequestAction(form(id));
  const payable = (await read(id)).financial_expense_id;
  await expect(markInvoicePaidAction(form(id))).rejects.toThrow("concilie");
  const own: AccessContext = { ...context, employeeId: employee, permissions: ["invoices.read_own"] };
  const view = async () => (await listInvoiceRequests(own)).find(row => row.id === id)!;
  expect((await view()).payment).toMatchObject({ state: "open", paid: "0.00", remaining: "6150.00" });
  const account = randomUUID();
  await admin.execute(sql`insert into financial_accounts (id,organization_id,name,type) values (${account},${org},'QA','bank')`);
  const movements: string[] = [];
  for (const amount of ["2000.00", "4150.00"]) {
    const movement = randomUUID(); movements.push(movement);
    await admin.execute(sql`insert into financial_transactions (id,organization_id,account_id,direction,amount,occurred_at,created_by_user_id) values (${movement},${org},${account},'out',${amount},'2026-09-30T12:00:00Z',${user})`);
    await createFinancialAllocations({ ...context, permissions: ["finance.settle"] }, { transactionId: movement, allocations: [{ targetType: "payable", targetId: payable, amount }] });
    expect((await view()).payment.state).toBe(amount === "2000.00" ? "partial" : "settled");
  }
  expect((await view()).status).toBe("paid");
  // Model a persisted reversal; the full reversal command is a separate FIN-006 task.
  await admin.execute(sql`update financial_transactions set status='reversed' where id=${movements[1]}`);
  expect(await view()).toMatchObject({ status: "approved", paidAt: null, payment: { state: "partial", paid: "2000.00", remaining: "4150.00" } });
  expect((await read(id)).status).toBe("approved");
  expect(await listInvoiceRequests({ ...own, employeeId: randomUUID() })).toEqual([]);
  expect(await listInvoiceRequests({ ...own, organizationId: other })).toEqual([]);
});
