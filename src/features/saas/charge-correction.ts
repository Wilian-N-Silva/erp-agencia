import { createHash } from "node:crypto";
import { and, eq, getTableColumns, isNull } from "drizzle-orm";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";
import { withTenantDb } from "@/lib/db";
import { financialExpenses, saasSubscriptionCharges, saasSubscriptions } from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCan } from "@/lib/rbac";
import { titleSettledAmount } from "@/features/finance/ledger";
import { centsToMoney, moneyToCents } from "@/features/finance/rules";
import { calculatePrincipalAmount, recordSaasChargeSchema } from "./charge-rules";

const fields = ["subscriptionId", "competence", "chargedAt", "dueDate", "originalCurrency", "originalAmount", "effectiveExchangeRate", "iofAmountBrl", "feeAmountBrl", "totalAmountBrl", "chargesIncludedInTotal", "notes"] as const;
export function saasChargeRevision(charge: Record<string, unknown>) {
  return createHash("sha256").update(JSON.stringify(fields.map(field => charge[field]))).digest("hex");
}
export const correctSaasChargeSchema = recordSaasChargeSchema.safeExtend({
  chargeId: z.string().uuid(), revision: z.string().regex(/^[a-f0-9]{64}$/), reason: z.string().trim().min(5).max(1000),
});
export class SaasChargeCorrectionError extends Error {}

export async function correctSaasCharge(context: AccessContext, raw: unknown) {
  assertCan("finance.write", context); assertCan("finance.reverse", context);
  if (!context.organizationId) throw new AccessDeniedError();
  const input = correctSaasChargeSchema.parse(raw), org = context.organizationId;
  return withTenantDb(context, async tx => {
    const [subscription] = await tx.select().from(saasSubscriptions).where(and(eq(saasSubscriptions.id, input.subscriptionId), eq(saasSubscriptions.organizationId, org), isNull(saasSubscriptions.deletedAt))).for("update").limit(1);
    if (!subscription) throw new AccessDeniedError();
    const [before] = await tx.select().from(saasSubscriptionCharges).where(and(eq(saasSubscriptionCharges.id, input.chargeId), eq(saasSubscriptionCharges.organizationId, org), eq(saasSubscriptionCharges.subscriptionId, subscription.id))).for("update").limit(1);
    if (!before || !before.financialExpenseId) throw new AccessDeniedError();
    if (input.competence !== before.competence) throw new SaasChargeCorrectionError("A competência da cobrança é preservada. Confira a origem antes de corrigir.");
    const [payable] = await tx.select({ ...getTableColumns(financialExpenses), ledgerSettled: titleSettledAmount("payable") }).from(financialExpenses)
      .where(and(eq(financialExpenses.id, before.financialExpenseId), eq(financialExpenses.organizationId, org), isNull(financialExpenses.deletedAt))).for("update").limit(1);
    if (!payable) throw new AccessDeniedError();
    if (payable.status === "cancelled" || moneyToCents(payable.ledgerSettled) > 0) throw new SaasChargeCorrectionError("Estorne a liquidação ou revise a reserva histórica antes de corrigir esta cobrança.");
    if (saasChargeRevision(before) === saasChargeRevision(input) && payable.amount === before.totalAmountBrl && payable.dueDate === before.dueDate && payable.competence === before.competence) return before;
    if (input.revision !== saasChargeRevision(before)) throw new SaasChargeCorrectionError("Esta cobrança foi alterada desde sua consulta. Atualize a página antes de corrigir.");
    const values = { chargedAt: input.chargedAt, dueDate: input.dueDate, originalCurrency: input.originalCurrency, originalAmount: input.originalAmount,
      effectiveExchangeRate: input.effectiveExchangeRate, principalAmountBrl: centsToMoney(calculatePrincipalAmount(input.originalAmount, input.effectiveExchangeRate)),
      iofAmountBrl: input.iofAmountBrl, feeAmountBrl: input.feeAmountBrl, totalAmountBrl: input.totalAmountBrl, chargesIncludedInTotal: input.chargesIncludedInTotal, notes: input.notes };
    const [after] = await tx.update(saasSubscriptionCharges).set({ ...values, updatedAt: new Date() }).where(and(eq(saasSubscriptionCharges.id, before.id), eq(saasSubscriptionCharges.organizationId, org))).returning();
    const [afterPayable] = await tx.update(financialExpenses).set({ amount: input.totalAmountBrl, dueDate: input.dueDate, competence: before.competence, notes: input.notes !== before.notes ? input.notes : payable.notes, updatedAt: new Date() })
      .where(and(eq(financialExpenses.id, payable.id), eq(financialExpenses.organizationId, org))).returning();
    await writeAuditLog(context, { action: "update", entityType: "saas_subscription_charge", entityId: before.id, before, after, metadata: { financialExpenseId: payable.id, reason: input.reason } });
    await writeAuditLog(context, { action: "update", entityType: "financial_expense", entityId: payable.id, before: payable, after: afterPayable, metadata: { saasSubscriptionChargeId: before.id, reason: input.reason } });
    return after;
  });
}
