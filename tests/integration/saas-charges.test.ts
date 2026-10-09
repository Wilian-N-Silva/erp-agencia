import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

import { createDatabase, getDb, withTenantDb } from "@/lib/db";
import type { AccessContext } from "@/lib/dal";
import { recordSaasCharge, listSaasCharges } from "@/features/saas/charge-dal";
import { correctSaasCharge, saasChargeRevision } from "@/features/saas/charge-correction";
import { reverseFinancialTransaction } from "@/features/finance-transactions/reversal";

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
  await admin.transaction(async tx => {
    for (const [table, trigger] of [["financial_transaction_reversals", "financial_reversals_immutable"], ["financial_allocations", "financial_allocations_immutable_guard"]]) {
      await tx.execute(sql.raw(`alter table ${table} disable trigger ${trigger}`));
      await tx.execute(sql`delete from ${sql.identifier(table)} where organization_id=${org}`);
      await tx.execute(sql.raw(`alter table ${table} enable trigger ${trigger}`));
    }
  });
  for (const table of ["work_items", "financial_transactions", "financial_accounts"]) await admin.execute(sql`delete from ${sql.identifier(table)} where organization_id=${org}`);
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
  const known = await recordSaasCharge(context, charge());
  expect(await listSaasCharges({ ...context, organizationId: otherOrg }, subscription)).toEqual([]);
  expect(await withTenantDb({ ...context, organizationId: otherOrg }, async tx => tx.execute(sql`select id from saas_subscription_charges where id=${known.id}`))).toMatchObject({ rows: [] });
  expect(await withTenantDb({ ...context, organizationId: otherOrg }, async tx => tx.execute(sql`select id from audit_logs where entity_id=${known.id}`))).toMatchObject({ rows: [] });
  expect(await getDb().execute(sql`select id from saas_subscription_charges`)).toMatchObject({ rows: [] });
});

const reviewer: AccessContext = { ...context, permissions: [...context.permissions, "finance.reverse"] };
it("corrects the recorded exchange data and the same AP without altering estimates, creating cash or repeating audit", async () => {
  const before = await recordSaasCharge(context, charge(subscription, "2027-01"));
  const request = { ...charge(subscription, before.competence), chargeId: before.id, revision: saasChargeRevision(before), reason: "Cotação conferida no extrato", effectiveExchangeRate: "7", totalAmountBrl: "855" };
  const after = await correctSaasCharge(reviewer, request);
  expect(after).toMatchObject({ id: before.id, financialExpenseId: before.financialExpenseId, totalAmountBrl: "855.00", principalAmountBrl: "840.00", effectiveExchangeRate: "7.000000" });
  expect((await correctSaasCharge(reviewer, request)).id).toBe(before.id);
  expect((await admin.execute(sql`select amount,competence from financial_expenses where id=${before.financialExpenseId}`)).rows[0]).toEqual({ amount: "855.00", competence: "2027-01" });
  expect((await admin.execute(sql`select cycle_amount from saas_subscriptions where id=${subscription}`)).rows[0].cycle_amount).toBe("120.00");
  expect((await admin.execute(sql`select count(*)::int n from audit_logs where entity_type='saas_subscription_charge' and action='update' and entity_id=${before.id}`)).rows[0].n).toBe(1);
  expect((await admin.execute(sql`select count(*)::int n from financial_transactions where organization_id=${org}`)).rows[0].n).toBe(0);
  expect((await listSaasCharges(context, subscription)).find(row => row.id === before.id)?.corrections).toEqual([expect.objectContaining({ amountBefore: "795.00", amountAfter: "855.00", reason: request.reason })]);
  await expect(correctSaasCharge(reviewer, { ...request, totalAmountBrl: "860" })).rejects.toThrow(/alterada/);
});
it("rejects tenant, permissions, changed competence and injected financial IDs", async () => {
  const before = await recordSaasCharge(context, charge(subscription, "2027-02"));
  const request = { ...charge(subscription, before.competence), chargeId: before.id, revision: saasChargeRevision(before), reason: "Correção conferida", totalAmountBrl: "800" };
  await expect(correctSaasCharge(context, request)).rejects.toThrow();
  await expect(correctSaasCharge({ ...reviewer, organizationId: otherOrg }, request)).rejects.toThrow();
  await expect(correctSaasCharge(reviewer, { ...request, competence: "2027-03" })).rejects.toThrow(/competência/);
  await expect(correctSaasCharge(reviewer, { ...request, financialExpenseId: randomUUID() })).rejects.toThrow();
  audit.fail = true;
  try { await expect(correctSaasCharge(reviewer, request)).rejects.toThrow("audit unavailable"); } finally { audit.fail = false; }
  expect((await listSaasCharges(context, subscription)).find(row => row.id === before.id)?.totalAmountBrl).toBe("795.00");
  expect((await admin.execute(sql`select amount from financial_expenses where id=${before.financialExpenseId}`)).rows[0].amount).toBe("795.00");
});
it("reads partial settlement from allocations despite a paid cache and allows correction after an audited reversal", async () => {
  const before = await recordSaasCharge(context, charge(subscription, "2027-03"));
  const request = { ...charge(subscription, before.competence), chargeId: before.id, revision: saasChargeRevision(before), reason: "Correção após estorno", totalAmountBrl: "800" };
  const account = randomUUID(), movement = randomUUID();
  await admin.execute(sql`insert into financial_accounts (id,organization_id,name,type) values (${account},${org},'SaaS QA account','bank')`);
  await admin.execute(sql`insert into financial_transactions (id,organization_id,account_id,direction,amount,occurred_at,created_by_user_id) values (${movement},${org},${account},'out',100,now(),${user})`);
  await withTenantDb(context, tx => tx.execute(sql`insert into financial_allocations (organization_id,transaction_id,financial_expense_id,amount,created_by_user_id) values (${org},${movement},${before.financialExpenseId},100,${user})`));
  await admin.execute(sql`update financial_expenses set paid_amount=795,status='paid' where id=${before.financialExpenseId}`);
  expect((await listSaasCharges(context, subscription)).find(row => row.id === before.id)).toMatchObject({ financialExpenseStatus: "partial", confirmedAmount: "100.00", settledAmount: "100.00" });
  await expect(correctSaasCharge(reviewer, request)).rejects.toThrow(/Estorne/);
  await reverseFinancialTransaction(reviewer, { transactionId: movement, reason: "Pagamento registrado indevidamente" });
  expect((await listSaasCharges(context, subscription)).find(row => row.id === before.id)).toMatchObject({ financialExpenseStatus: "open", confirmedAmount: "0.00" });
  await correctSaasCharge(reviewer, request);
  expect((await listSaasCharges(context, subscription)).find(row => row.id === before.id)?.totalAmountBrl).toBe("800.00");
});
it("serializes competing revisions instead of silently overwriting another correction", async () => {
  const before = await recordSaasCharge(context, charge(subscription, "2027-04"));
  const request = { ...charge(subscription, before.competence), chargeId: before.id, revision: saasChargeRevision(before), reason: "Conferência da cotação" };
  const result = await Promise.allSettled([correctSaasCharge(reviewer, { ...request, totalAmountBrl: "800" }), correctSaasCharge(reviewer, { ...request, totalAmountBrl: "810" })]);
  expect(result.filter(row => row.status === "fulfilled")).toHaveLength(1);
});
