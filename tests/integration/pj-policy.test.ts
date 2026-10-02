import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { createDatabase, getDb, withTenantDb } from "@/lib/db";
import type { AccessContext } from "@/lib/dal";
import { attachPjSalesToNextInvoice, configurePjApprover, getOwnPjPolicy, lockPjEmployee, requestPjTimeOff, reviewPjTimeOff } from "@/features/timeoff/pj-policy";
const failAudit = vi.hoisted(() => ({ enabled: false }));
const actionContext = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/dal", async original => {
  const actual = await original<typeof import("@/lib/dal")>();
  const { withTenantDb } = await import("@/lib/db");
  return { ...actual, getCurrentAccessContext: actionContext,
    bindCurrentTenantContext: (operation: (...args: unknown[]) => Promise<unknown>) =>
      (...args: unknown[]) => withTenantDb(actionContext(), () => operation(...args)),
  };
});
import { createInvoiceRequestFormAction } from "@/features/portal/actions";
vi.mock("@/lib/audit", async original => {
  const actual = await original<typeof import("@/lib/audit")>();
  return { ...actual, writeAuditLog: (...args: Parameters<typeof actual.writeAuditLog>) => {
    if (failAudit.enabled) throw new Error("audit unavailable");
    return actual.writeAuditLog(...args);
  } };
});
const admin = createDatabase(process.env.DATABASE_TEST_ADMIN_URL!, { allowExitOnIdle: true });
const orgs = [randomUUID(), randomUUID()];
const accounts = orgs.map(org => `pj-policy-${org}`);
const people: string[] = [];
const context: AccessContext = { userId: accounts[0], organizationId: orgs[0], employeeId: null, roles: [], permissions: ["settings.manage", "timeoff.write", "timeoff.read_own", "compensation.read", "compensation.read_own"] };
let area: string, position: string;
beforeAll(async () => {
  for (const [i, org] of orgs.entries()) {
    await admin.execute(sql`insert into organizations (id,name,slug) values (${org},'PJ policy test',${org})`);
    await admin.execute(sql`insert into "user" (id,organization_id,name,email) values (${accounts[i]},${org},'Approver QA',${`${accounts[i]}@example.test`})`);
  }
  area = randomUUID(); position = randomUUID();
  await admin.execute(sql`insert into areas (id,organization_id,name) values (${area},${orgs[0]},'QA')`);
  await admin.execute(sql`insert into positions (id,organization_id,name) values (${position},${orgs[0]},'QA')`);
  await configurePjApprover(context, { userId: context.userId });
});
afterAll(async () => {
  failAudit.enabled = false;
  for (const org of orgs) {
    await admin.execute(sql`delete from invoice_request_items where invoice_request_id in (select id from invoice_requests where organization_id=${org})`);
    for (const table of ["audit_logs", "app_settings", "invoice_requests", "time_off_requests", "employees", "areas", "positions", "user"])
      await admin.execute(sql`delete from ${sql.identifier(table)} where organization_id=${org}`);
    await admin.execute(sql`delete from organizations where id=${org}`);
  }
  await admin.$client.end(); await getDb().$client.end();
});
async function employee(start = "2020-01-01") {
  const id = randomUUID(); people.push(id);
  await admin.execute(sql`insert into employees (id,organization_id,registration_number,full_name,area_id,position_id,employment_type,start_date,current_compensation) values (${id},${orgs[0]},${id},'PJ QA',${area},${position},'pj',${start},3900)`);
  return { ...context, employeeId: id };
}
async function invoice(employeeId: string, competence = "2090-10", submitted = false) {
  const id = randomUUID();
  await admin.execute(sql`insert into invoice_requests (id,organization_id,employee_id,competence,due_date,expected_amount,suggested_description,status,created_by_user_id) values (${id},${orgs[0]},${employeeId},${competence},'2090-10-31',4200,'QA',${submitted ? "submitted" : "published"},${context.userId})`);
  await admin.execute(sql`insert into invoice_request_items (invoice_request_id,label,amount,kind) values (${id},'Base',3900,'base'),(${id},'Ajuda',300,'allowance')`);
  return id;
}
const sale = { kind: "sale", days: 15, notes: "Venda combinada com Jaci" };
it("reserves sale days then uses current compensation on approval and attaches once to an open NF", async () => {
  const own = await employee();
  const nf = await invoice(own.employeeId!);
  const id = await requestPjTimeOff(own, sale);
  expect((await getOwnPjPolicy(own)).balance.reserved).toBe(15);
  await admin.execute(sql`update employees set current_compensation=4500 where id=${own.employeeId}`);
  await reviewPjTimeOff(context, { id, decision: "approve", amount: "2250.00" });
  expect((await admin.execute(sql`select sale_base_amount, sale_suggested_amount, sale_approved_amount from time_off_requests where id=${id}`)).rows[0]).toMatchObject({ sale_base_amount: "4500.00", sale_suggested_amount: "2250.00", sale_approved_amount: "2250.00" });
  await withTenantDb(context, async () => { await lockPjEmployee(context, own.employeeId!); await attachPjSalesToNextInvoice(context, own.employeeId!); });
  expect((await admin.execute(sql`select count(*)::int n from invoice_request_items where source_time_off_id=${id}`)).rows[0]).toMatchObject({ n: 1 });
  expect((await admin.execute(sql`select expected_amount from invoice_requests where id=${nf}`)).rows[0]).toMatchObject({ expected_amount: "6450.00" });
  expect((await getOwnPjPolicy(own)).balance.sold).toBe(15);
});
it("keeps approved sale pending when NF is submitted then includes it in a later composition", async () => {
  const own = await employee(); await invoice(own.employeeId!, "2090-09", true);
  const id = await requestPjTimeOff(own, sale);
  await reviewPjTimeOff(context, { id, decision: "approve", amount: "1900.00", note: "Valor negociado pela responsável" });
  expect((await admin.execute(sql`select count(*)::int n from invoice_request_items where source_time_off_id=${id}`)).rows[0]).toMatchObject({ n: 0 });
  const nf = await invoice(own.employeeId!);
  await withTenantDb(context, async () => { await lockPjEmployee(context, own.employeeId!); await attachPjSalesToNextInvoice(context, own.employeeId!); });
  expect((await admin.execute(sql`select invoice_request_id,amount from invoice_request_items where source_time_off_id=${id}`)).rows[0]).toMatchObject({ invoice_request_id: nf, amount: "1900.00" });
});
it("allows ten calendar days with an explanation, rejects overlap, and releases a refused reservation", async () => {
  const own = await employee();
  const rest = { kind: "rest", startDate: "2090-10-01", endDate: "2090-10-10", notes: "Dez dias combinados com Jaci" };
  const id = await requestPjTimeOff(own, rest);
  expect((await getOwnPjPolicy(own)).balance.reserved).toBe(10);
  await expect(requestPjTimeOff(own, rest)).rejects.toThrow("intervalo");
  await reviewPjTimeOff(context, { id, decision: "reject" });
  expect((await getOwnPjPolicy(own)).balance.reserved).toBe(0);
});
it("rejects insufficient balance and serializes competing reservations", async () => {
  const now = new Date();
  const own = await employee(`${now.getFullYear()-1}-01-01`);
  const results = await Promise.allSettled([requestPjTimeOff(own, { ...sale, days: 20 }), requestPjTimeOff(own, { ...sale, days: 20 })]);
  expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
  expect((await getOwnPjPolicy(own)).balance.available).toBe(10);
});
it("rejects foreign tenant IDs, impersonated employee IDs, and unauthorized approvers", async () => {
  const own = await employee(); const id = await requestPjTimeOff(own, sale);
  await expect(requestPjTimeOff(own, { ...sale, employeeId: randomUUID() })).rejects.toThrow();
  await expect(reviewPjTimeOff({ ...context, userId: accounts[1], organizationId: orgs[1] }, { id, decision: "approve", amount: "1950.00" })).rejects.toThrow();
  await expect(reviewPjTimeOff({ ...context, userId: "other-reviewer" }, { id, decision: "approve", amount: "1950.00" })).rejects.toThrow();
  await expect(reviewPjTimeOff({ ...context, permissions: [] }, { id, decision: "approve", amount: "1950.00" })).rejects.toThrow();
});
it("rolls back approval and NF changes when audit fails", async () => {
  const own = await employee(); const nf = await invoice(own.employeeId!); const id = await requestPjTimeOff(own, sale);
  failAudit.enabled = true;
  try { await expect(reviewPjTimeOff(context, { id, decision: "approve", amount: "1950.00" })).rejects.toThrow("audit unavailable"); }
  finally { failAudit.enabled = false; }
  expect((await admin.execute(sql`select status from time_off_requests where id=${id}`)).rows[0]).toMatchObject({ status: "requested" });
  expect((await admin.execute(sql`select expected_amount from invoice_requests where id=${nf}`)).rows[0]).toMatchObject({ expected_amount: "4200.00" });
});
it("returns a safe form error only after rolling back the NF and its items", async () => {
  const own = await employee();
  actionContext.mockReturnValue({ ...context, permissions: [...context.permissions, "invoices.write"] });
  const form = new FormData();
  for (const [key, value] of Object.entries({ employeeId: own.employeeId!, competence: "2090-11", dueDate: "2090-11-28", baseAmount: "3900.00" })) form.set(key, value);
  failAudit.enabled = true;
  try {
    const result = await createInvoiceRequestFormAction({ ok: false }, form);
    expect(result).toEqual({ ok: false, error: "Não foi possível publicar a composição. Tente novamente." });
  } finally { failAudit.enabled = false; }
  expect((await admin.execute(sql`select count(*)::int n from invoice_requests where employee_id=${own.employeeId}`)).rows[0]).toMatchObject({ n: 0 });
});
it("can refuse a pending sale even if current remuneration became zero", async () => {
  const own = await employee(); const id = await requestPjTimeOff(own, sale);
  await admin.execute(sql`update employees set current_compensation=0 where id=${own.employeeId}`);
  await reviewPjTimeOff(context, { id, decision: "reject" });
  expect((await getOwnPjPolicy(own)).balance.reserved).toBe(0);
  expect((await admin.execute(sql`select status,sale_base_amount from time_off_requests where id=${id}`)).rows[0]).toMatchObject({ status: "rejected", sale_base_amount: "3900.00" });
});
