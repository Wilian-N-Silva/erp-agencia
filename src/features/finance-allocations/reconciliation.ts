import { and, asc, eq, ilike, isNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { centsToMoney, moneyToCents } from "@/features/finance/rules";
import { withTenantDb } from "@/lib/db";
import { clients, financialAllocations, financialEntries, financialExpenses, financialTransactions } from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCan, assertCanAny } from "@/lib/rbac";
import { createFinancialAllocations } from "./dal";
import { FinancialAllocationError, financialAllocationBatchInputSchema } from "./rules";

export async function confirmReconciliation(context: AccessContext, raw: unknown) {
  assertCan("finance.settle", context);
  if (!context.organizationId) throw new AccessDeniedError();
  const organizationId = context.organizationId;
  const input = financialAllocationBatchInputSchema.safeExtend({ expectedRemaining: z.string().regex(/^\d+\.\d{2}$/) }).parse(raw);
  return withTenantDb(context, async tx => {
    const [movement] = await tx.select().from(financialTransactions).where(and(eq(financialTransactions.organizationId, organizationId), eq(financialTransactions.id, input.transactionId))).for("update").limit(1);
    if (!movement) throw new AccessDeniedError();
    const [allocated] = await tx.select({ total: sql<string>`coalesce(sum(${financialAllocations.amount}), 0)` }).from(financialAllocations).where(and(eq(financialAllocations.organizationId, organizationId), eq(financialAllocations.transactionId, movement.id)));
    if (moneyToCents(movement.amount) - moneyToCents(allocated.total) !== moneyToCents(input.expectedRemaining)) {
      throw new FinancialAllocationError("inconsistent_balance", "O saldo mudou desde a abertura da tela. Atualize a página antes de confirmar novamente.");
    }
    return createFinancialAllocations(context, { transactionId: movement.id, allocations: input.allocations });
  });
}

export type ReconciliationCandidate = {
  id: string; description: string; counterparty: string | null; dueDate: string;
  remaining: string; suggested: boolean; targetType: "receivable" | "payable";
};

export async function getReconciliation(context: AccessContext, raw: unknown) {
  assertCanAny(["finance.read", "finance.write", "finance.settle"], context);
  if (!context.organizationId) throw new AccessDeniedError();
  const organizationId = context.organizationId;
  const input = z.strictObject({ transactionId: z.string().uuid(), query: z.string().trim().max(100).default("") }).parse(raw);
  return withTenantDb(context, async (tx) => {
    const [movement] = await tx.select().from(financialTransactions).where(and(eq(financialTransactions.organizationId, organizationId), eq(financialTransactions.id, input.transactionId))).limit(1);
    if (!movement) return null;
    const allocations = await tx.select({ id: financialAllocations.id, amount: financialAllocations.amount,
      description: sql<string>`coalesce(${financialEntries.description}, ${financialExpenses.description})`, createdAt: financialAllocations.createdAt })
      .from(financialAllocations)
      .leftJoin(financialEntries, and(eq(financialEntries.id, financialAllocations.financialEntryId), eq(financialEntries.organizationId, organizationId)))
      .leftJoin(financialExpenses, and(eq(financialExpenses.id, financialAllocations.financialExpenseId), eq(financialExpenses.organizationId, organizationId)))
      .where(and(eq(financialAllocations.organizationId, organizationId), eq(financialAllocations.transactionId, movement.id))).orderBy(asc(financialAllocations.createdAt));
    const remaining = centsToMoney(moneyToCents(movement.amount) - allocations.reduce((total, row) => total + moneyToCents(row.amount), 0));
    const candidates: ReconciliationCandidate[] = [];
    const search = `%${input.query}%`;
    if (movement.status !== "reversed" && moneyToCents(remaining) > 0) {
      if (movement.direction === "in") {
        const balance = sql<string>`${financialEntries.amount} - coalesce(${financialEntries.receivedAmount}, case when ${financialEntries.status} = 'received' then ${financialEntries.amount} else 0 end)`;
        const match = sql<boolean>`${financialEntries.clientId} = ${movement.clientId}::uuid`;
        const rows = await tx.select({ id: financialEntries.id, description: financialEntries.description, counterparty: clients.name, dueDate: financialEntries.dueDate, remaining: balance, suggested: match })
          .from(financialEntries).leftJoin(clients, and(eq(clients.id, financialEntries.clientId), eq(clients.organizationId, organizationId)))
          .where(and(eq(financialEntries.organizationId, organizationId), isNull(financialEntries.deletedAt), ne(financialEntries.status, "cancelled"), sql`${balance} > 0`,
            input.query ? or(ilike(financialEntries.description, search), ilike(clients.name, search)) : undefined))
          .orderBy(sql`${match} desc nulls last`, asc(financialEntries.dueDate), asc(financialEntries.id)).limit(201);
        candidates.push(...rows.map(row => ({ ...row, suggested: Boolean(row.suggested), targetType: "receivable" as const })));
      } else {
        const balance = sql<string>`${financialExpenses.amount} - ${financialExpenses.paidAmount}`;
        const match = sql<boolean>`${financialExpenses.supplierId} = ${movement.supplierId}::uuid`;
        const rows = await tx.select({ id: financialExpenses.id, description: financialExpenses.description, counterparty: financialExpenses.supplier, dueDate: financialExpenses.dueDate, remaining: balance, suggested: match })
          .from(financialExpenses).where(and(eq(financialExpenses.organizationId, organizationId), isNull(financialExpenses.deletedAt), ne(financialExpenses.status, "cancelled"), sql`${balance} > 0`,
            input.query ? or(ilike(financialExpenses.description, search), ilike(financialExpenses.supplier, search)) : undefined))
          .orderBy(sql`${match} desc nulls last`, asc(financialExpenses.dueDate), asc(financialExpenses.id)).limit(201);
        candidates.push(...rows.map(row => ({ ...row, suggested: Boolean(row.suggested), targetType: "payable" as const })));
      }
    }
    return { movement, allocations, remaining, candidates: candidates.slice(0, 200), truncated: candidates.length > 200 };
  });
}
