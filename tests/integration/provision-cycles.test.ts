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
import { cancelProvisionCycle, correctRealizedProvisionCycle, listProvisionCycles, planProvisionCycle, realizeProvisionCycle } from "@/features/provisions/dal";
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
  await admin.transaction(async tx => {
    await tx.execute(sql`alter table financial_allocations disable trigger financial_allocations_immutable_guard`);
    await tx.execute(sql`delete from financial_allocations where organization_id=${org}`);
    await tx.execute(sql`alter table financial_allocations enable trigger financial_allocations_immutable_guard`);
  });
  await admin.execute(sql`delete from financial_transactions where organization_id=${org}`);
  await admin.execute(sql`delete from financial_accounts where organization_id=${org}`);
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
  await expect(cancelProvisionCycle(context, { id: cycles[0].id, reason: "Cancelamento tardio" })).rejects.toThrow();
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

it("corrects the realized source without another AP, cash movement or loss of the estimate", async () => {
  const cycle = await realizeProvisionCycle(context, realize((await planProvisionCycle(context, plan(await provision()))).id));
  const reviewer: AccessContext = { ...context, permissions: [...context.permissions, "finance.reverse"] };
  const request = { id: cycle.id, amount: "145,67", dueDate: "2026-11-20", reason: "Valor confirmado na cobrança externa" };
  const count = (await admin.execute(sql`select count(*)::int n from financial_expenses where organization_id=${org}`)).rows[0].n;
  await correctRealizedProvisionCycle(reviewer, request);
  await correctRealizedProvisionCycle(reviewer, request);
  expect((await listProvisionCycles(context)).find(row => row.id === cycle.id)).toMatchObject({ estimatedAmount: "100.00", financialExpenseId: cycle.financialExpenseId, actualAmount: "145.67", actualDueDate: "2026-11-20" });
  expect((await admin.execute(sql`select count(*)::int n from financial_expenses where organization_id=${org}`)).rows[0].n).toBe(count);
  expect((await admin.execute(sql`select count(*)::int n from audit_logs where entity_type='financial_expense' and metadata->>'origin'='provision_cycle_correction' and entity_id=${cycle.financialExpenseId}`)).rows[0].n).toBe(1);
});

it("rejects correction without reversal permission, tenant scope, strict fields or when partially reconciled despite stale cache", async () => {
  const cycle = await realizeProvisionCycle(context, realize((await planProvisionCycle(context, plan(await provision()))).id));
  const reviewer: AccessContext = { ...context, permissions: [...context.permissions, "finance.reverse"] };
  const request = { id: cycle.id, amount: "145.67", dueDate: "2026-11-20", reason: "Correção conferida" };
  await expect(correctRealizedProvisionCycle(context, request)).rejects.toThrow();
  await expect(correctRealizedProvisionCycle({ ...reviewer, organizationId: other }, request)).rejects.toThrow();
  await expect(correctRealizedProvisionCycle(reviewer, { ...request, supplierId: foreignSupplier })).rejects.toThrow();
  const account = randomUUID(), movement = randomUUID();
  await admin.execute(sql`insert into financial_accounts (id,organization_id,name,type) values (${account},${org},'Correction account','bank')`);
  await admin.execute(sql`insert into financial_transactions (id,organization_id,account_id,direction,amount,occurred_at,created_by_user_id) values (${movement},${org},${account},'out',1,now(),${user})`);
  await withTenantDb(context, tx => tx.execute(sql`insert into financial_allocations (organization_id,transaction_id,financial_expense_id,amount,created_by_user_id) values (${org},${movement},${cycle.financialExpenseId},1,${user})`));
  await expect(correctRealizedProvisionCycle(reviewer, request)).rejects.toThrow(/Estorne/);
  await expect(cancelProvisionCycle(reviewer, { id: cycle.id, reason: "Cobrança indevida" })).rejects.toThrow(/Estorne/);
  expect((await admin.execute(sql`select amount,paid_amount from financial_expenses where id=${cycle.financialExpenseId}`)).rows[0]).toEqual({ amount: "123.45", paid_amount: "0.00" });
});

it("rolls back the source correction when audit is unavailable", async () => {
  const cycle = await realizeProvisionCycle(context, realize((await planProvisionCycle(context, plan(await provision()))).id));
  auditFailure.enabled = true;
  try { await expect(correctRealizedProvisionCycle({ ...context, permissions: [...context.permissions, "finance.reverse"] }, { id: cycle.id, amount: "150", dueDate: "2026-12-10", reason: "Correção do documento externo" })).rejects.toThrow("audit failure"); }
  finally { auditFailure.enabled = false; }
  expect((await admin.execute(sql`select amount,due_date::text from financial_expenses where id=${cycle.financialExpenseId}`)).rows[0]).toEqual({ amount: "123.45", due_date: "2026-11-02" });
});

it("cancels a realized cycle and its payable atomically, preserving the link and rejecting detached database writes", async () => {
  const cycle = await realizeProvisionCycle(context, realize((await planProvisionCycle(context, plan(await provision()))).id));
  const reviewer: AccessContext = { ...context, permissions: [...context.permissions, "finance.reverse"] };
  await expect(withTenantDb(context, tx => tx.execute(sql`update financial_expenses set status='cancelled' where id=${cycle.financialExpenseId}`))).rejects.toMatchObject({ cause: { code: "23514" } });
  await expect(withTenantDb(context, tx => tx.execute(sql`update provision_cycles set financial_expense_id=null,status='cancelled',cancellation_reason='Detached origin' where id=${cycle.id}`))).rejects.toMatchObject({ cause: { code: "55000" } });
  const cancelled = await cancelProvisionCycle(reviewer, { id: cycle.id, reason: "Cobrança não será realizada" });
  expect(cancelled).toMatchObject({ status: "cancelled", financialExpenseId: cycle.financialExpenseId, estimatedAmount: "100.00" });
  expect((await admin.execute(sql`select status,amount from financial_expenses where id=${cycle.financialExpenseId}`)).rows[0]).toEqual({ status: "cancelled", amount: "123.45" });
  expect((await cancelProvisionCycle(reviewer, { id: cycle.id, reason: "Reenvio do cancelamento" })).id).toBe(cycle.id);
  await expect(withTenantDb(context, tx => tx.execute(sql`update financial_expenses set status='planned' where id=${cycle.financialExpenseId}`))).rejects.toMatchObject({ cause: { code: "23514" } });
  await expect(realizeProvisionCycle(context, realize(cycle.id))).rejects.toThrow(/cancelada/);
});

it("rolls back payable cancellation and origin together when audit fails", async () => {
  const cycle = await realizeProvisionCycle(context, realize((await planProvisionCycle(context, plan(await provision()))).id));
  auditFailure.enabled = true;
  try { await expect(cancelProvisionCycle({ ...context, permissions: [...context.permissions, "finance.reverse"] }, { id: cycle.id, reason: "Cobrança indevida" })).rejects.toThrow("audit failure"); }
  finally { auditFailure.enabled = false; }
  expect((await admin.execute(sql`select status from financial_expenses where id=${cycle.financialExpenseId}`)).rows[0].status).toBe("planned");
  expect((await listProvisionCycles(context)).find(row => row.id === cycle.id)?.status).toBe("realized");
});
