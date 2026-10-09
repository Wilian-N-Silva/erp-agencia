import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

import { createDatabase, getDb, withTenantDb } from "@/lib/db";
import type { AccessContext } from "@/lib/dal";
import { recordSaasCharge, listSaasCharges } from "@/features/saas/charge-dal";

const audit = vi.hoisted(() => ({ fail: false }));
vi.mock("@/lib/audit", async original => {
  const actual = await original<typeof import("@/lib/audit")>();
  return { ...actual, writeAuditLog: (...args: Parameters<typeof actual.writeAuditLog>) => {
    if (audit.fail) throw new Error("audit unavailable");
    return actual.writeAuditLog(...args);
  } };
});

const admin = createDatabase(process.env.DATABASE_TEST_ADMIN_URL!, { allowExitOnIdle: true });
const org = randomUUID();
const otherOrg = randomUUID();
const user = randomUUID();
const subscription = randomUUID();
const otherSubscription = randomUUID();
const context: AccessContext = { organizationId: org, userId: user, employeeId: null, roles: [], permissions: ["finance.read", "finance.write"] };
const charge = (subscriptionId = subscription, competence = "2026-10") => ({
  subscriptionId,
  competence,
  chargedAt: `${competence}-02`,
  dueDate: `${competence}-10`,
  originalCurrency: "EUR" as const,
  originalAmount: "120.00",
  effectiveExchangeRate: "6.500000",
  iofAmountBrl: "12.00",
  feeAmountBrl: "3.00",
  totalAmountBrl: "795.00",
  chargesIncludedInTotal: "true" as const,
  notes: "Fatura QA",
});

beforeAll(async () => {
  await admin.execute(sql`insert into organizations (id,name,slug) values (${org},'SaaS charge QA',${org}),(${otherOrg},'Other charge QA',${otherOrg})`);
  await admin.execute(sql`insert into "user" (id,organization_id,name,email) values (${user},${org},'SaaS charge QA',${`${user}@example.test`})`);
  await admin.execute(sql`insert into saas_subscriptions (id,organization_id,name,category,provider,billing_currency,billing_cycle,cycle_amount,status) values (${subscription},${org},'Charge QA','software','Provider QA','EUR','annual',120,'active'),(${otherSubscription},${otherOrg},'Other Charge','software','Other','USD','monthly',10,'active')`);
});

afterAll(async () => {
  audit.fail = false;
  await admin.execute(sql`delete from audit_logs where organization_id in (${org},${otherOrg})`);
  await admin.execute(sql`delete from saas_subscription_charges where organization_id in (${org},${otherOrg})`);
  await admin.execute(sql`delete from financial_expenses where organization_id in (${org},${otherOrg})`);
  await admin.execute(sql`delete from saas_subscriptions where organization_id in (${org},${otherOrg})`);
  await admin.execute(sql`delete from "user" where organization_id in (${org},${otherOrg})`);
  await admin.execute(sql`delete from organizations where id in (${org},${otherOrg})`);
  await admin.$client.end();
  await getDb().$client.end();
});

it("records one effective charge, freezes the rate and creates one AP", async () => {
  const first = await recordSaasCharge(context, charge());
  const retry = await recordSaasCharge(context, charge());
  expect(retry.id).toBe(first.id);
  expect(first).toMatchObject({ originalCurrency: "EUR", originalAmount: "120.00", effectiveExchangeRate: "6.500000", principalAmountBrl: "780.00", totalAmountBrl: "795.00", chargesIncludedInTotal: true });
  expect((await admin.execute(sql`select count(*)::int n from financial_expenses where organization_id=${org}`)).rows[0].n).toBe(1);
  expect((await admin.execute(sql`select amount,category,description,competence from financial_expenses where id=${first.financialExpenseId}`)).rows[0]).toMatchObject({ amount: "795.00", category: "SaaS", competence: "2026-10" });
  expect((await listSaasCharges(context, subscription))).toHaveLength(1);
});

it("rejects cross-tenant subscriptions and payload tampering", async () => {
  await expect(recordSaasCharge(context, charge(otherSubscription, "2026-11"))).rejects.toThrow();
  await expect(recordSaasCharge({ ...context, permissions: ["finance.read"] }, charge(subscription, "2026-11"))).rejects.toThrow();
  await expect(recordSaasCharge(context, { ...charge(subscription, "2026-11"), organizationId: otherOrg } as never)).rejects.toThrow();
});

it("rolls back the payable and charge when audit fails", async () => {
  audit.fail = true;
  try {
    await expect(recordSaasCharge(context, charge(subscription, "2026-12"))).rejects.toThrow("audit unavailable");
  } finally {
    audit.fail = false;
  }
  expect((await admin.execute(sql`select count(*)::int n from saas_subscription_charges where organization_id=${org} and competence='2026-12'`)).rows[0].n).toBe(0);
  expect((await admin.execute(sql`select count(*)::int n from financial_expenses where organization_id=${org} and competence='2026-12'`)).rows[0].n).toBe(0);
});

it("enforces tenant RLS for direct access", async () => {
  expect(await withTenantDb({ ...context, organizationId: otherOrg }, async tx => tx.execute(sql`select id from saas_subscription_charges where id=${randomUUID()}`))).toMatchObject({ rows: [] });
  expect(await getDb().execute(sql`select id from saas_subscription_charges`)).toMatchObject({ rows: [] });
});
