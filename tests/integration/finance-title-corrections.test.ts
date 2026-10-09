import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { createDatabase, getDb, withTenantDb } from "@/lib/db";
import type { AccessContext } from "@/lib/dal";
import { cancelFinancialEntryAction, cancelFinancialExpenseAction, updateFinancialEntryAction } from "@/features/finance/actions";

const state = vi.hoisted(() => ({ context: null as AccessContext | null, auditFails: false }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: () => { throw new Error("Unauthenticated"); } }));
vi.mock("@/lib/rate-limit", async original => ({ ...await original<typeof import("@/lib/rate-limit")>(), enforceAuthenticatedRateLimit: vi.fn() }));
vi.mock("@/lib/dal", async original => ({
  ...await original<typeof import("@/lib/dal")>(),
  getCurrentAccessContext: async () => state.context,
  bindCurrentTenantContext: (operation: (data: FormData) => Promise<void>) => (data: FormData) => withTenantDb(state.context!, () => operation(data)),
}));
vi.mock("@/lib/audit", async original => {
  const actual = await original<typeof import("@/lib/audit")>();
  return { ...actual, writeAuditLog: (...args: Parameters<typeof actual.writeAuditLog>) => {
    if (state.auditFails) throw new Error("audit unavailable");
    return actual.writeAuditLog(...args);
  } };
});
const admin = createDatabase(process.env.DATABASE_TEST_ADMIN_URL!, { allowExitOnIdle: true });
const org = randomUUID(), user = randomUUID();
const context: AccessContext = { organizationId: org, userId: user, employeeId: null, roles: [], permissions: ["finance.write"] };
const form = (values: Record<string, string>) => { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value); return data; };
beforeAll(async () => {
  state.context = context;
  await admin.execute(sql`insert into organizations (id,name,slug) values (${org},'Title corrections',${org})`);
  await admin.execute(sql`insert into "user" (id,organization_id,name,email) values (${user},${org},'Title QA',${`${user}@example.test`})`);
});
afterAll(async () => {
  await admin.transaction(async tx => {
    for (const table of ["audit_logs", "provision_cycles", "provisions", "financial_entries", "financial_expenses", "user"]) await tx.execute(sql`delete from ${sql.identifier(table)} where organization_id=${org}`);
    await tx.execute(sql`delete from organizations where id=${org}`);
  });
  await admin.$client.end(); await getDb().$client.end();
});
async function entry(settled = "0.00") {
  const id = randomUUID();
  await admin.execute(sql`insert into financial_entries (id,organization_id,description,amount,received_amount,legacy_settled_amount,due_date,competence,responsible_user_id) values (${id},${org},'Manual AR',100,${settled},${settled},'2026-10-10','2026-10',${user})`);
  return id;
}
it("requires a reason, audits cancellation and forbids reopening", async () => {
  const id = await entry();
  expect(await cancelFinancialEntryAction(form({ id }))).toMatchObject({ ok: false, code: "CONFLICT" });
  expect(await cancelFinancialEntryAction(form({ id, reason: "Duplicated obligation" }))).toMatchObject({ ok: true });
  expect((await admin.execute(sql`select status from financial_entries where id=${id}`)).rows[0].status).toBe("cancelled");
  expect((await admin.execute(sql`select metadata from audit_logs where entity_id=${id}`)).rows[0].metadata).toMatchObject({ reason: "Duplicated obligation" });
  expect(await cancelFinancialEntryAction(form({ id, reason: "Again" }))).toMatchObject({ ok: false });
});
it("rejects cancellation and reduction below a partial historical settlement", async () => {
  const id = await entry("50.00");
  expect(await cancelFinancialEntryAction(form({ id, reason: "Wrong title" }))).toMatchObject({ ok: false });
  expect(await updateFinancialEntryAction(form({ id, description: "Correction", amount: "49.99", dueDate: "2026-10-12", competence: "2026-10", reason: "Correct amount" }))).toMatchObject({ ok: false });
  expect((await admin.execute(sql`select amount,status from financial_entries where id=${id}`)).rows[0]).toEqual({ amount: "100.00", status: "planned" });
});
it("rolls back corrections if the audit cannot be persisted", async () => {
  const id = await entry();
  const data = form({ id, description: "Correction", amount: "80.00", dueDate: "2026-10-12", competence: "2026-10", reason: "Correct amount" });
  state.auditFails = true;
  try { await expect(updateFinancialEntryAction(data)).rejects.toThrow("audit unavailable"); }
  finally { state.auditFails = false; }
  expect((await admin.execute(sql`select amount from financial_entries where id=${id}`)).rows[0].amount).toBe("100.00");
  expect(await updateFinancialEntryAction(data)).toMatchObject({ ok: true });
  expect((await admin.execute(sql`select amount from financial_entries where id=${id}`)).rows[0].amount).toBe("80.00");
});
it("protects linked payables against cancellation", async () => {
  const id = randomUUID(), provision = randomUUID();
  await admin.execute(sql`insert into financial_expenses (id,organization_id,supplier,category,description,amount,due_date,competence,responsible_user_id) values (${id},${org},'Supplier','Category','Provision AP',100,'2026-10-10','2026-10',${user})`);
  await admin.execute(sql`insert into provisions (id,organization_id,name,category,estimated_monthly_amount) values (${provision},${org},'Provision','Category',100)`);
  await admin.execute(sql`insert into provision_cycles (organization_id,provision_id,competence,estimated_amount,due_date,status,financial_expense_id,created_by_user_id) values (${org},${provision},'2026-10',100,'2026-10-10','realized',${id},${user})`);
  expect(await cancelFinancialExpenseAction(form({ id, reason: "Wrong obligation" }))).toMatchObject({ ok: false, message: expect.stringContaining("origem") });
});
it("rejects foreign tenant ids and payload tampering", async () => {
  await expect(cancelFinancialEntryAction(form({ id: randomUUID(), reason: "Foreign title" }))).rejects.toThrow();
  const id = await entry();
  expect(await cancelFinancialEntryAction(form({ id, reason: "Wrong title", status: "received" }))).toMatchObject({ ok: false });
  state.context = { ...context, permissions: [] };
  try { await expect(cancelFinancialEntryAction(form({ id, reason: "Wrong title" }))).rejects.toThrow(); }
  finally { state.context = context; }
});
