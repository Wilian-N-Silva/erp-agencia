import { and, eq, getTableColumns, isNull } from "drizzle-orm";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";
import { withTenantDb } from "@/lib/db";
import { financialExpenses, saasSubscriptionCharges, saasSubscriptions } from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCan } from "@/lib/rbac";
import { titleSettledAmount } from "@/features/finance/ledger";
import { moneyToCents } from "@/features/finance/rules";
import { saasChargeRevision } from "./charge-correction";

export const cancelSaasChargeSchema = z.strictObject({
  subscriptionId: z.string().uuid(), chargeId: z.string().uuid(),
  revision: z.string().regex(/^[a-f0-9]{64}$/), reason: z.string().trim().min(5).max(1000),
  confirmation: z.literal("cancel"),
});
export class SaasChargeCancellationError extends Error {}

export async function cancelSaasCharge(context: AccessContext, raw: unknown) {
  assertCan("finance.write", context); assertCan("finance.reverse", context);
  if (!context.organizationId) throw new AccessDeniedError();
  const input = cancelSaasChargeSchema.parse(raw), org = context.organizationId;
  return withTenantDb(context, async tx => {
    // Same lock order as registration/correction; cancelling a contract does not erase its bills.
    const [subscription] = await tx.select().from(saasSubscriptions).where(and(eq(saasSubscriptions.id, input.subscriptionId), eq(saasSubscriptions.organizationId, org), isNull(saasSubscriptions.deletedAt))).for("update").limit(1);
    if (!subscription) throw new AccessDeniedError();
    const [before] = await tx.select().from(saasSubscriptionCharges).where(and(eq(saasSubscriptionCharges.id, input.chargeId), eq(saasSubscriptionCharges.subscriptionId, subscription.id), eq(saasSubscriptionCharges.organizationId, org))).for("update").limit(1);
    if (!before || !before.financialExpenseId) throw new AccessDeniedError();
    const [payable] = await tx.select(getTableColumns(financialExpenses)).from(financialExpenses)
      .where(and(eq(financialExpenses.id, before.financialExpenseId), eq(financialExpenses.organizationId, org), isNull(financialExpenses.deletedAt))).for("update").limit(1);
    if (!payable) throw new AccessDeniedError();
    if (before.cancelledAt && payable.status === "cancelled") return before;
    if (before.cancelledAt || payable.status === "cancelled") throw new SaasChargeCancellationError("O estado da cobrança e da conta a pagar precisa ser conferido antes de continuar.");
    if (input.revision !== saasChargeRevision(before)) throw new SaasChargeCancellationError("Esta cobrança foi alterada desde sua consulta. Atualize a página antes de cancelar.");
    const [settlement] = await tx.select({ amount: titleSettledAmount("payable") }).from(financialExpenses).where(and(eq(financialExpenses.id, payable.id), eq(financialExpenses.organizationId, org))).limit(1);
    if (!settlement || moneyToCents(settlement.amount) > 0) throw new SaasChargeCancellationError("Estorne a liquidação ou revise a reserva histórica antes de cancelar esta cobrança.");
    const now = new Date();
    const [after] = await tx.update(saasSubscriptionCharges).set({ cancelledAt: now, cancellationReason: input.reason, updatedAt: now })
      .where(and(eq(saasSubscriptionCharges.id, before.id), eq(saasSubscriptionCharges.organizationId, org))).returning();
    const [afterPayable] = await tx.update(financialExpenses).set({ status: "cancelled", updatedAt: now })
      .where(and(eq(financialExpenses.id, payable.id), eq(financialExpenses.organizationId, org))).returning();
    await writeAuditLog(context, { action: "update", entityType: "saas_subscription_charge", entityId: before.id, before, after, metadata: { operation: "cancel_charge", financialExpenseId: payable.id, reason: input.reason } });
    await writeAuditLog(context, { action: "update", entityType: "financial_expense", entityId: payable.id, before: payable, after: afterPayable, metadata: { operation: "cancel_saas_charge", saasSubscriptionChargeId: before.id, reason: input.reason } });
    return after;
  });
}
