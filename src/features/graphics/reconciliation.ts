import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { moneyToCents } from "@/features/finance/rules";
import { createFinancialAllocations } from "@/features/finance-allocations/dal";
import { generateWorkItem, resolveWorkItem } from "@/features/work-items/dal";
import { writeAuditLog } from "@/lib/audit";
import { withTenantDb } from "@/lib/db";
import { financialAllocations, financialEntries, financialTransactions, graphicJobs, graphicReconciliationSuggestions, graphicSaleInstallments, graphicSales, workItems } from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCan, assertCanAny } from "@/lib/rbac";
import { GraphicFlowError } from "./client-decision-rules";
import { graphicSuggestionReviewSchema, graphicSuggestionSchema } from "./reconciliation-rules";

export async function suggestGraphicReconciliation(context: AccessContext, raw: unknown) {
  assertCan("graphics.reconcile_suggest", context);
  if (!context.organizationId) throw new AccessDeniedError();
  const organizationId = context.organizationId;
  const input = graphicSuggestionSchema.parse(raw);
  return withTenantDb(context, async tx => {
    const [movement] = await tx.select().from(financialTransactions).where(and(eq(financialTransactions.organizationId, organizationId), eq(financialTransactions.id, input.transactionId))).for("update").limit(1);
    const [job] = await tx.select().from(graphicJobs).where(and(eq(graphicJobs.organizationId, organizationId), eq(graphicJobs.id, input.jobId), isNull(graphicJobs.deletedAt))).limit(1);
    if (!movement || !job || (movement.clientId && movement.clientId !== job.clientId)) throw new AccessDeniedError();
    if (movement.direction !== "in" || !["pending_reconciliation", "partially_reconciled"].includes(movement.status)) throw new GraphicFlowError("Selecione um recebimento com saldo a conciliar.");
    const [entry] = await tx.select({ amount: financialEntries.amount, received: financialEntries.receivedAmount, status: financialEntries.status })
      .from(graphicSales).innerJoin(graphicSaleInstallments, and(eq(graphicSaleInstallments.saleId, graphicSales.id), eq(graphicSaleInstallments.organizationId, organizationId)))
      .innerJoin(financialEntries, and(eq(financialEntries.id, graphicSaleInstallments.entryId), eq(financialEntries.organizationId, organizationId)))
      .where(and(eq(graphicSales.organizationId, organizationId), eq(graphicSales.jobId, job.id), eq(financialEntries.id, input.entryId), isNull(financialEntries.deletedAt))).limit(1);
    if (!entry) throw new AccessDeniedError();
    const [allocated] = await tx.select({ total: sql<string>`coalesce(sum(${financialAllocations.amount}), 0)` }).from(financialAllocations).where(and(eq(financialAllocations.organizationId, organizationId), eq(financialAllocations.transactionId, movement.id)));
    const received = entry.received ?? (entry.status === "received" ? entry.amount : "0.00");
    if (entry.status === "cancelled" || moneyToCents(input.amount) > moneyToCents(entry.amount) - moneyToCents(received) || moneyToCents(input.amount) > moneyToCents(movement.amount) - moneyToCents(allocated.total)) throw new GraphicFlowError("O valor sugerido excede o saldo do título ou da movimentação. Atualize os valores.");
    const [existing] = await tx.select().from(graphicReconciliationSuggestions).where(and(eq(graphicReconciliationSuggestions.organizationId, organizationId), eq(graphicReconciliationSuggestions.transactionId, movement.id), eq(graphicReconciliationSuggestions.entryId, input.entryId), eq(graphicReconciliationSuggestions.status, "pending"))).limit(1);
    if (existing) {
      if (existing.amount !== input.amount || existing.reason !== input.reason) throw new GraphicFlowError("Já existe sugestão pendente para esta parcela e movimentação. Aguarde a revisão do Financeiro.");
      return existing;
    }
    const [suggestion] = await tx.insert(graphicReconciliationSuggestions).values({ ...input, organizationId, createdByUserId: context.userId }).returning();
    await writeAuditLog(context, { action: "create", entityType: "graphic_reconciliation_suggestion", entityId: suggestion.id, after: suggestion });
    await generateWorkItem(context, { kind: "graphic_reconciliation_review", sourceType: "graphic_reconciliation_suggestion", sourceId: suggestion.id, occurrenceKey: "initial", title: `Revisar conciliação · ${job.internalCode}`.slice(0,200), description: "O Financeiro deve revisar o título, o recebimento e o valor sugeridos pela Gráfica antes de confirmar qualquer liquidação." });
    return suggestion;
  });
}

export async function reviewGraphicReconciliation(context: AccessContext, raw: unknown) {
  assertCan("finance.settle", context);
  if (!context.organizationId) throw new AccessDeniedError();
  const organizationId = context.organizationId;
  const input = graphicSuggestionReviewSchema.parse(raw);
  return withTenantDb(context, async tx => {
    const [reference] = await tx.select({ transactionId: graphicReconciliationSuggestions.transactionId }).from(graphicReconciliationSuggestions).where(and(eq(graphicReconciliationSuggestions.organizationId, organizationId), eq(graphicReconciliationSuggestions.id, input.suggestionId))).limit(1);
    if (!reference) throw new AccessDeniedError();
    // Same lock order as suggestion creation and financial allocation.
    await tx.select({ id: financialTransactions.id }).from(financialTransactions).where(and(eq(financialTransactions.organizationId, organizationId), eq(financialTransactions.id, reference.transactionId))).for("update");
    const [before] = await tx.select().from(graphicReconciliationSuggestions).where(and(eq(graphicReconciliationSuggestions.organizationId, organizationId), eq(graphicReconciliationSuggestions.id, input.suggestionId))).for("update").limit(1);
    if (before.status !== "pending") {
      if (before.status === input.decision) return before;
      throw new GraphicFlowError("Esta sugestão já foi revisada. Atualize a página para consultar a decisão.");
    }
    if (input.decision === "accepted") await createFinancialAllocations(context, { transactionId: before.transactionId, allocations: [{ targetType: "receivable", targetId: before.entryId, amount: before.amount }] });
    const [after] = await tx.update(graphicReconciliationSuggestions).set({ status: input.decision, reviewedByUserId: context.userId, reviewedAt: new Date(), reviewNotes: input.notes }).where(and(eq(graphicReconciliationSuggestions.organizationId, organizationId), eq(graphicReconciliationSuggestions.id, before.id))).returning();
    await writeAuditLog(context, { action: "status_change", entityType: "graphic_reconciliation_suggestion", entityId: after.id, before, after, metadata: { financialTransactionId: before.transactionId } });
    const pending = await tx.select({ id: workItems.id }).from(workItems).where(and(eq(workItems.organizationId, organizationId), eq(workItems.sourceType, "graphic_reconciliation_suggestion"), eq(workItems.sourceId, before.id), inArray(workItems.status, ["open", "in_progress"])));
    for (const item of pending) await resolveWorkItem(context, { id: item.id, resolution: `${input.decision === "accepted" ? "Sugestão confirmada" : "Sugestão rejeitada"}: ${input.notes}` });
    return after;
  });
}

export async function getGraphicSuggestions(context: AccessContext, scope: { jobId: string } | { transactionId: string }) {
  assertCanAny(["graphics.reconcile_suggest", "graphics.finance_read", "finance.read", "finance.write", "finance.settle"], context);
  if (!context.organizationId) throw new AccessDeniedError();
  const organizationId = context.organizationId;
  z.union([z.strictObject({ jobId: z.string().uuid() }), z.strictObject({ transactionId: z.string().uuid() })]).parse(scope);
  return withTenantDb(context, tx => tx.select({ suggestion: graphicReconciliationSuggestions, code: graphicJobs.internalCode, description: financialEntries.description })
    .from(graphicReconciliationSuggestions).innerJoin(graphicJobs, and(eq(graphicJobs.id, graphicReconciliationSuggestions.jobId), eq(graphicJobs.organizationId, organizationId)))
    .innerJoin(financialEntries, and(eq(financialEntries.id, graphicReconciliationSuggestions.entryId), eq(financialEntries.organizationId, organizationId)))
    .where(and(eq(graphicReconciliationSuggestions.organizationId, organizationId), "jobId" in scope ? eq(graphicReconciliationSuggestions.jobId, scope.jobId) : eq(graphicReconciliationSuggestions.transactionId, scope.transactionId)))
    .orderBy(desc(graphicReconciliationSuggestions.createdAt)).limit(200));
}

export async function getGraphicSuggestionMovements(context: AccessContext, rawJobId: unknown) {
  assertCan("graphics.reconcile_suggest", context);
  if (!context.organizationId) throw new AccessDeniedError();
  const organizationId = context.organizationId, jobId = z.string().uuid().parse(rawJobId);
  return withTenantDb(context, async tx => {
    const [job] = await tx.select({ clientId: graphicJobs.clientId }).from(graphicJobs).where(and(eq(graphicJobs.organizationId, organizationId), eq(graphicJobs.id, jobId), isNull(graphicJobs.deletedAt))).limit(1);
    if (!job) throw new AccessDeniedError();
    return tx.select({ id: financialTransactions.id, amount: financialTransactions.amount, occurredAt: financialTransactions.occurredAt, reference: financialTransactions.reference,
      remaining: sql<string>`${financialTransactions.amount} - coalesce((select sum(a.amount) from financial_allocations a where a.organization_id=${organizationId} and a.transaction_id=${financialTransactions.id}), 0)` })
      .from(financialTransactions).where(and(eq(financialTransactions.organizationId, organizationId), eq(financialTransactions.direction, "in"), inArray(financialTransactions.status, ["pending_reconciliation", "partially_reconciled"]), or(eq(financialTransactions.clientId, job.clientId), isNull(financialTransactions.clientId))))
      .orderBy(desc(financialTransactions.occurredAt)).limit(200);
  });
}
