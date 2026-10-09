import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { withTenantDb } from "@/lib/db";
import { auditLogs, financialAllocations, financialEntries, financialExpenses, financialTransactionReversals, financialTransactions } from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { assertCan, assertCanAny, AccessDeniedError } from "@/lib/rbac";
import { createAuditLogValues } from "@/lib/audit";
import { centsToMoney, moneyToCents } from "@/features/finance/rules";
import { syncReconciliationWorkItem } from "@/features/finance-allocations/work-items";

export const reversalInputSchema = z.strictObject({ transactionId: z.string().uuid(), reason: z.string().trim().min(3).max(2000) });
export class FinancialReversalError extends Error {}

export async function getFinancialTransactionReversal(context: AccessContext, transactionId: string) {
  assertCanAny(["finance.read", "finance.write", "finance.settle", "finance.reverse"], context);
  if (!context.organizationId) throw new AccessDeniedError();
  z.string().uuid().parse(transactionId);
  return withTenantDb(context, async tx => {
    const [record] = await tx.select().from(financialTransactionReversals).where(and(eq(financialTransactionReversals.transactionId, transactionId), eq(financialTransactionReversals.organizationId, context.organizationId!))).limit(1);
    return record ?? null;
  });
}

export async function reverseFinancialTransaction(context: AccessContext, raw: unknown) {
  assertCan("finance.reverse", context);
  if (!context.organizationId) throw new AccessDeniedError();
  const input = reversalInputSchema.parse(raw);
  const org = context.organizationId;
  return withTenantDb(context, async tx => {
    const [movement] = await tx.select().from(financialTransactions).where(and(eq(financialTransactions.id, input.transactionId), eq(financialTransactions.organizationId, org))).for("update").limit(1);
    if (!movement) throw new AccessDeniedError();
    const [previous] = await tx.select().from(financialTransactionReversals).where(and(eq(financialTransactionReversals.transactionId, movement.id), eq(financialTransactionReversals.organizationId, org))).limit(1);
    if (previous) return previous;
    if (movement.status === "reversed") throw new FinancialReversalError("Movimentação sem registro de estorno confiável. Solicite revisão do histórico.");
    const allocations = await tx.select().from(financialAllocations).where(and(eq(financialAllocations.organizationId, org), eq(financialAllocations.transactionId, movement.id)));
    const targets = [...new Set(allocations.map(a => a.financialEntryId ? `receivable:${a.financialEntryId}` : `payable:${a.financialExpenseId}`))].sort();
    // Same lock order as allocation writes: movement, then targets in sorted order.
    const locked = [];
    for (const key of targets) {
      const [type, id] = key.split(":");
      const table = type === "receivable" ? financialEntries : financialExpenses;
      const [title] = await tx.select().from(table).where(and(eq(table.id, id), eq(table.organizationId, org))).for("update").limit(1);
      if (!title) throw new AccessDeniedError();
      const removed = allocations.filter(a => type === "receivable" ? a.financialEntryId === id : a.financialExpenseId === id).reduce((total, a) => total + moneyToCents(a.amount), 0);
      const cached = "receivedAmount" in title ? title.receivedAmount ?? (title.status === "received" ? title.amount : "0.00") : title.paidAmount;
      const remaining = moneyToCents(cached) - removed;
      if (remaining < 0 || remaining > moneyToCents(title.amount)) throw new FinancialReversalError("Saldo inconsistente. Revise o título antes de estornar.");
      locked.push({ type, id, title, remaining });
    }
    const [reversal] = await tx.insert(financialTransactionReversals).values({ organizationId: org, transactionId: movement.id, amount: movement.amount, reason: input.reason, createdByUserId: context.userId }).returning();
    const [afterMovement] = await tx.update(financialTransactions).set({ status: "reversed", updatedAt: new Date() }).where(and(eq(financialTransactions.id, movement.id), eq(financialTransactions.organizationId, org))).returning();
    for (const target of locked) {
      const settled = target.remaining === moneyToCents(target.title.amount);
      const [dates] = await tx.execute(sql`select max(t.occurred_at)::date::text as date from financial_allocations a join financial_transactions t on t.id=a.transaction_id and t.organization_id=a.organization_id where a.organization_id=${org} and t.status <> 'reversed' and ${target.type === "receivable" ? sql`a.financial_entry_id=${target.id}::uuid` : sql`a.financial_expense_id=${target.id}::uuid`}`).then(result => result.rows as Array<{ date: string | null }>);
      const values = { updatedAt: new Date() };
      const after = target.type === "receivable"
        ? (await tx.update(financialEntries).set({ ...values, status: target.title.status === "cancelled" ? "cancelled" : settled ? "received" : "planned", receivedAmount: centsToMoney(target.remaining), receivedDate: settled ? dates.date : null }).where(and(eq(financialEntries.id, target.id), eq(financialEntries.organizationId, org))).returning())[0]
        : (await tx.update(financialExpenses).set({ ...values, status: target.title.status === "cancelled" ? "cancelled" : settled ? "paid" : "planned", paidAmount: centsToMoney(target.remaining), paidDate: settled ? dates.date : null }).where(and(eq(financialExpenses.id, target.id), eq(financialExpenses.organizationId, org))).returning())[0];
      await tx.insert(auditLogs).values(createAuditLogValues(context, { action: "status_change", entityType: target.type === "receivable" ? "financial_entry" : "financial_expense", entityId: target.id, before: target.title, after, metadata: { reversalId: reversal.id, transactionId: movement.id } }));
    }
    await tx.insert(auditLogs).values(createAuditLogValues(context, { action: "create", entityType: "financial_transaction_reversal", entityId: reversal.id, after: reversal }));
    await tx.insert(auditLogs).values(createAuditLogValues(context, { action: "status_change", entityType: "financial_transaction", entityId: movement.id, before: movement, after: afterMovement, metadata: { reversalId: reversal.id } }));
    await syncReconciliationWorkItem(context, movement.id);
    return reversal;
  });
}
