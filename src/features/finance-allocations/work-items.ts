import { and, eq, inArray } from "drizzle-orm";
import { generateWorkItem, resolveWorkItem } from "@/features/work-items/dal";
import { withTenantDb } from "@/lib/db";
import { financialTransactions, workItems } from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCanAny } from "@/lib/rbac";

/** Call inside the transaction that creates or locks the cash movement. */
export async function syncReconciliationWorkItem(context: AccessContext, transactionId: string) {
  assertCanAny(["finance.write", "finance.settle"], context);
  if (!context.organizationId) throw new AccessDeniedError();
  const organizationId = context.organizationId;
  return withTenantDb(context, async (tx) => {
    const [movement] = await tx.select().from(financialTransactions).where(and(
      eq(financialTransactions.organizationId, organizationId), eq(financialTransactions.id, transactionId),
    )).for("update").limit(1);
    if (!movement) throw new AccessDeniedError();
    if (movement.status === "pending_reconciliation" || movement.status === "partially_reconciled") {
      await generateWorkItem(context, {
        kind: "financial_reconciliation", sourceType: "financial_transaction", sourceId: movement.id,
        occurrenceKey: "initial", title: "Conciliar movimentação financeira",
        description: "Identifique as contas a receber ou pagar e distribua o valor da movimentação. A pendência permanece até a conciliação integral.",
        assignedUserId: movement.createdByUserId,
      });
      return;
    }
    const items = await tx.select({ id: workItems.id }).from(workItems).where(and(
      eq(workItems.organizationId, organizationId), eq(workItems.kind, "financial_reconciliation"),
      eq(workItems.sourceType, "financial_transaction"), eq(workItems.sourceId, movement.id),
      inArray(workItems.status, ["open", "in_progress"]),
    ));
    for (const item of items) await resolveWorkItem(context, { id: item.id,
      resolution: movement.status === "reconciled" ? "Movimentação integralmente conciliada pelo Financeiro." : "Movimentação estornada pelo Financeiro." });
  });
}
