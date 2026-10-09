import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { createDatabase, getDb, withTenantDb } from "@/lib/db";
import { provisionCycles } from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
const auditFailure = vi.hoisted(() => ({ enabled: false }));
vi.mock("@/lib/audit", async original => {
  const actual = await original<typeof import("@/lib/audit")>();
  return { ...actual, writeAuditLog: (...args: Parameters<typeof actual.writeAuditLog>) => {
    if (auditFailure.enabled) throw new Error("audit failure");
    return actual.writeAuditLog(...args);
  } };
});
import { cancelProvisionCycle, listProvisionCycles, planProvisionCycle, realizeProvisionCycle } from "@/features/provisions/dal";
import { getFinanceDashboard } from "@/features/finance/dal";
import { buildFinanceCsv } from "@/features/finance/export";
const admin = createDatabase(process.env.DATABASE_TEST_ADMIN_URL!, { allowExitOnIdle: true });
const org = randomUUID(), other = randomUUID(), user = randomUUID(), supplier = randomUUID(), foreignSupplier = randomUUID();
const context: AccessContext = { organizationId: org, userId: user, employeeId: null, roles: [], permissions: ["finance.write", "finance.read"] };
beforeAll(async () => {
  await admin.execute(sql`insert into organizations (id,name,slug) values (${org},'Cycles',${org}),(${other},'Other',${other})`);
  await admin.execute(sql`insert into "user" (id,organization_id,name,email) values (${user},${org},'QA',${`${user}@example.test`})`);
  await admin.execute(sql`insert into suppliers (id,organization_id,name) values (${supplier},${org},'Supplier'),(${foreignSupplier},${other},'Other')`);
});
afterAll(async () => {
  auditFailure.enabled = false;
  for (const table of ["audit_logs", "provision_cycles", "financial_expenses", "provisions", "suppliers", "user"])
    await admin.execute(sql`delete from ${sql.identifier(table)} where organization_id in (${org},${other})`);
  await admin.execute(sql`delete from organizations where id in (${org},${other})`);
  await admin.$client.end(); await getDb().$client.end();
});
async function provision(recurring = true) {
  const id = randomUUID();
  await admin.execute(sql`insert into provisions (id,organization_id,name,category,estimated_monthly_amount,recurring) values (${id},${org},'QA cycle','SaaS',100,${recurring})`);
  return id;
}
const plan = (provisionId: string, competence = "2026-10") => ({ provisionId, competence, estimatedAmount: "100", dueDate: `${competence}-28` });
const realize = (id: string) => ({ id, supplierId: supplier, amount: "123.45", dueDate: "2026-11-02" });
it("serializes repeated planning and realization, preserving estimate and creating only one AP without cash", async () => {
  const provisionId = await provision();
  const cycles = await Promise.all([planProvisionCycle(context, plan(provisionId)), planProvisionCycle(context, plan(provisionId))]);
  expect(cycles[0].id).toBe(cycles[1].id);
  expect((await getFinanceDashboard(context, { asOf: new Date("2026-10-01T12:00:00Z") })).totals).toMatchObject({ provisionsExpected: "100.00", expensesExpected: "0.00" });
  const realized = await Promise.all([realizeProvisionCycle(context, realize(cycles[0].id)), realizeProvisionCycle(context, realize(cycles[0].id))]);
  expect(realized[0].financialExpenseId).toBe(realized[1].financialExpenseId);
  expect(realized[0]).toMatchObject({ status: "realized", estimatedAmount: "100.00" });
  expect((await admin.execute(sql`select amount,paid_amount,competence,due_date from financial_expenses where id=${realized[0].financialExpenseId}`)).rows[0]).toMatchObject({ amount: "123.45", paid_amount: "0.00", competence: "2026-10" });
  expect((await admin.execute(sql`select count(*)::int n from financial_expenses where organization_id=${org}`)).rows[0].n).toBe(1);
  expect((await admin.execute(sql`select count(*)::int n from financial_transactions where organization_id=${org}`)).rows[0].n).toBe(0);
  expect((await planProvisionCycle(context, plan(provisionId))).status).toBe("realized");
  const dashboard = await getFinanceDashboard(context, { asOf: new Date("2026-10-01T12:00:00Z") });
  expect(dashboard.totals).toMatchObject({ provisionsExpected: "0.00", expensesExpected: "123.45" });
  const csv = buildFinanceCsv(dashboard);
  const provisionRow = csv.split("\r\n").find(row => row.startsWith("Provisao prevista;"));
  expect(provisionRow).toContain("10/2026");
  expect(provisionRow).toMatch(/0,00;Sim;;;$/);
  await expect(cancelProvisionCycle(context, { id: cycles[0].id, reason: "Cancelamento tardio" })).rejects.toThrow("conta a pagar");
});
it("cancels a single occurrence without affecting the next cycle or deleting history", async () => {
  const provisionId = await provision();
  const cycle = await planProvisionCycle(context, plan(provisionId));
  const cancelled = await cancelProvisionCycle(context, { id: cycle.id, reason: "Fornecedor não cobrará" });
  expect(cancelled.status).toBe("cancelled");
  expect((await planProvisionCycle(context, plan(provisionId))).status).toBe("cancelled");
  await expect(realizeProvisionCycle(context, realize(cycle.id))).rejects.toThrow("cancelada");
  expect((await planProvisionCycle(context, plan(provisionId, "2026-11"))).status).toBe("planned");
  const once = await provision(false);
  await planProvisionCycle(context, plan(once));
  await expect(planProvisionCycle(context, plan(once, "2026-11"))).rejects.toThrow("não recorrente");
});
it("rejects cross-tenant references, missing permissions and injected server-owned fields", async () => {
  const input = plan(await provision());
  const cycle = await planProvisionCycle(context, input);
  for (const denied of [{ ...context, organizationId: other }, { ...context, permissions: [] }]) {
    await expect(planProvisionCycle(denied, input)).rejects.toThrow();
    await expect(realizeProvisionCycle(denied, realize(cycle.id))).rejects.toThrow();
    await expect(cancelProvisionCycle(denied, { id: cycle.id, reason: "Teste de isolamento" })).rejects.toThrow();
  }
  expect(await listProvisionCycles({ ...context, organizationId: other })).toEqual([]);
  await expect(realizeProvisionCycle(context, { ...realize(cycle.id), supplierId: foreignSupplier })).rejects.toThrow();
  await expect(planProvisionCycle(context, { ...input, organizationId: other })).rejects.toThrow();
  await expect(realizeProvisionCycle(context, { ...realize(cycle.id), paidAmount: "123.45" })).rejects.toThrow();
});
it("enforces database RLS without relying on DAL filtering and enforces tenant foreign keys", async () => {
  const provisionId = await provision();
  const cycle = await planProvisionCycle(context, plan(provisionId));
  expect(await withTenantDb({ ...context, organizationId: other }, tx => tx.select().from(provisionCycles))).toEqual([]);
  expect(await getDb().select().from(provisionCycles)).toEqual([]);
  await expect(withTenantDb(context, tx => tx.insert(provisionCycles).values({ organizationId: other, provisionId, competence: "2026-12", estimatedAmount: "1", dueDate: "2026-12-01", createdByUserId: user }))).rejects.toThrow();
  const update = await withTenantDb({ ...context, organizationId: other }, tx => tx.execute(sql`update provision_cycles set estimated_amount=999 where id=${cycle.id} returning id`));
  expect(update.rows).toEqual([]);
  const removed = await withTenantDb({ ...context, organizationId: other }, tx => tx.execute(sql`delete from provision_cycles where id=${cycle.id} returning id`));
  expect(removed.rows).toEqual([]);
  await expect(admin.execute(sql`insert into provision_cycles (organization_id,provision_id,competence,estimated_amount,due_date,created_by_user_id) values (${other},${provisionId},'2026-12',1,'2026-12-01',${user})`)).rejects.toThrow();
});
it("rolls back AP and cycle transition together on audit failure", async () => {
  const cycle = await planProvisionCycle(context, plan(await provision()));
  const before = (await admin.execute(sql`select count(*)::int n from financial_expenses where organization_id=${org}`)).rows[0].n;
  auditFailure.enabled = true;
  try { await expect(realizeProvisionCycle(context, realize(cycle.id))).rejects.toThrow("audit failure"); }
  finally { auditFailure.enabled = false; }
  expect((await admin.execute(sql`select count(*)::int n from financial_expenses where organization_id=${org}`)).rows[0].n).toBe(before);
  expect((await listProvisionCycles(context)).find(row => row.id === cycle.id)).toMatchObject({ status: "planned", financialExpenseId: null });
});
