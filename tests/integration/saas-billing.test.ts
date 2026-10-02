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
import { createSaasSubscriptionAction, updateSaasBillingAction } from "@/features/saas/actions";
import { listSaasSubscriptions } from "@/features/saas/dal";
const admin = createDatabase(process.env.DATABASE_TEST_ADMIN_URL!, { allowExitOnIdle: true });
const org = randomUUID(), other = randomUUID(), user = randomUUID();
const context: AccessContext = { organizationId: org, userId: user, employeeId: null, roles: [], permissions: ["saas.write", "finance.read"] };
const form = (input: Record<string, string>) => { const result = new FormData(); for (const [k,v] of Object.entries(input)) result.set(k,v); return result; };
const billing = { billingCurrency: "EUR", billingCycle: "annual", cycleAmount: "120", estimatedExchangeRate: "6.123456", exchangeRateDate: "2026-10-02", exchangeRateSource: "QA" };
beforeAll(async () => {
  await admin.execute(sql`insert into organizations (id,name,slug) values (${org},'QA',${org}),(${other},'Other',${other})`);
  await admin.execute(sql`insert into "user" (id,organization_id,name,email) values (${user},${org},'QA',${`${user}@example.test`})`);
});
afterAll(async () => {
  for (const table of ["audit_logs", "saas_subscriptions", "user"]) await admin.execute(sql`delete from ${sql.identifier(table)} where organization_id=${org}`);
  await admin.execute(sql`delete from organizations where id in (${org},${other})`);
  await admin.$client.end(); await getDb().$client.end();
});
async function create() {
  current.mockReturnValue(context); auditFailure.enabled = false;
  const name = randomUUID();
  await createSaasSubscriptionAction(form({ name, category: "QA", status: "active", ...billing }));
  return (await listSaasSubscriptions(context)).find(row => row.name === name)!;
}
it("persists the original annual price and updates only the estimate", async () => {
  const row = await create();
  expect(row).toMatchObject({ monthlyCost: "61.23", annualizedCost: "734.81", billing: { cycleAmount: "120.00", billingCurrency: "EUR", billingCycle: "annual" } });
  await updateSaasBillingAction(form({ id: row.id, ...billing, estimatedExchangeRate: "6.5" }));
  expect((await listSaasSubscriptions(context)).find(s => s.id === row.id)).toMatchObject({ monthlyCost: "65.00", annualizedCost: "780.00", billing: { cycleAmount: "120.00" } });
  expect((await admin.execute(sql`select count(*)::int n from financial_expenses where organization_id=${org}`)).rows[0].n).toBe(0);
  expect((await admin.execute(sql`select count(*)::int n from financial_transactions where organization_id=${org}`)).rows[0].n).toBe(0);
});
it("accepts BRL monthly and unknown costs without requiring an exchange rate", async () => {
  current.mockReturnValue(context);
  for (const cycleAmount of ["87,65", ""]) {
    const name = randomUUID();
    await createSaasSubscriptionAction(form({ name, category: "QA", status: "active", cycleAmount, billingCurrency: "BRL", billingCycle: "monthly", estimatedExchangeRate: "", exchangeRateDate: "", exchangeRateSource: "" }));
    expect((await listSaasSubscriptions(context)).find(row => row.name === name)?.monthlyCost).toBe(cycleAmount ? "87.65" : null);
  }
});
it("hides financial metadata and rejects unauthorized or cross-tenant edits", async () => {
  const row = await create();
  const reader: AccessContext = { ...context, permissions: ["saas.read"] };
  const visible = (await listSaasSubscriptions(reader)).find(s => s.id === row.id)!;
  expect(visible).toMatchObject({ monthlyCost: null, annualizedCost: null, cycleEstimate: null, billing: null, costHidden: true });
  expect(visible).not.toHaveProperty("estimatedExchangeRate");
  expect(await listSaasSubscriptions({ ...context, organizationId: other })).toEqual([]);
  for (const denied of [reader, { ...context, permissions: ["saas.write"] }, { ...context, organizationId: other }]) {
    current.mockReturnValue(denied);
    await expect(updateSaasBillingAction(form({ id: row.id, ...billing }))).rejects.toThrow();
  }
});
it("rolls back an audit failure and rejects missing provenance and payload tampering", async () => {
  const row = await create();
  auditFailure.enabled = true;
  await expect(updateSaasBillingAction(form({ id: row.id, ...billing, cycleAmount: "999" }))).rejects.toThrow("audit failure");
  auditFailure.enabled = false;
  expect((await listSaasSubscriptions(context)).find(s => s.id === row.id)?.billing?.cycleAmount).toBe("120.00");
  for (const values of [{ ...billing, billingCurrency: "BTC" }, { ...billing, exchangeRateSource: "" }, { ...billing, organizationId: other }])
    await expect(updateSaasBillingAction(form({ id: row.id, ...values }))).rejects.toThrow();
});
