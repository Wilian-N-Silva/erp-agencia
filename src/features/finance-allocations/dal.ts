import { and, eq, isNull, sql } from "drizzle-orm";

import { centsToMoney, moneyToCents, toDateKey } from "@/features/finance/rules";
import { createAuditLogValues } from "@/lib/audit";
import { withTenantDb } from "@/lib/db";
import {
  auditLogs,
  financialAllocations,
  financialEntries,
  financialExpenses,
  financialTransactions,
} from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCan } from "@/lib/rbac";

import {
  calculateAllocationTotal,
  FinancialAllocationError,
  financialAllocationBatchInputSchema,
  type FinancialAllocationTargetType,
} from "./rules";

type LockedTransaction = {
  amount: string;
  direction: string;
  id: string;
  occurredAt: Date;
  organizationId: string;
  status: string;
};

type LockedTarget = {
  amount: string;
  cachedSettled: string;
  date: string | null;
  id: string;
  status: string;
  targetType: FinancialAllocationTargetType;
};

export async function createFinancialAllocations(
  context: AccessContext,
  rawInput: unknown,
) {
  assertCan("finance.settle", context);
  if (!context.organizationId) throw new AccessDeniedError();

  const input = financialAllocationBatchInputSchema.parse(rawInput);
  const organizationId = context.organizationId;

  return withTenantDb(context, async (transaction) => {
    const transactionRows = await transaction
      .select({
        amount: financialTransactions.amount,
        direction: financialTransactions.direction,
        id: financialTransactions.id,
        occurredAt: financialTransactions.occurredAt,
        organizationId: financialTransactions.organizationId,
        status: financialTransactions.status,
      })
      .from(financialTransactions)
      .where(
        and(
          eq(financialTransactions.id, input.transactionId),
          eq(financialTransactions.organizationId, organizationId),
        ),
      )
      .limit(1)
      .for("update");
    const financialTransaction = transactionRows[0] as LockedTransaction | undefined;

    if (!financialTransaction) throw new AccessDeniedError();
    if (financialTransaction.status === "reversed") {
      throw new FinancialAllocationError(
        "transaction_reversed",
        "Uma movimentacao estornada nao pode receber alocacoes.",
      );
    }

    const sortedAllocations = [...input.allocations].sort((left, right) =>
      `${left.targetType}:${left.targetId}`.localeCompare(
        `${right.targetType}:${right.targetId}`,
      ),
    );
    const targets = new Map<string, LockedTarget>();

    for (const allocation of sortedAllocations) {
      assertDirection(financialTransaction.direction, allocation.targetType);
      const target = await lockTarget(
        transaction,
        organizationId,
        allocation.targetType,
        allocation.targetId,
      );
      targets.set(targetKey(allocation.targetType, allocation.targetId), target);
    }

    const existingTransactionAllocated = await sumTransactionAllocations(
      transaction,
      organizationId,
      financialTransaction.id,
    );
    const requestedTransactionAmount = centsToMoney(
      input.allocations.reduce(
        (total, allocation) => total + moneyToCents(allocation.amount),
        0,
      ),
    );
    const transactionResult = calculateAllocationTotal({
      capacity: financialTransaction.amount,
      existingAllocated: existingTransactionAllocated,
      requested: requestedTransactionAmount,
      scope: "transaction",
    });

    const targetResults = new Map<
      string,
      ReturnType<typeof calculateAllocationTotal>
    >();
    for (const allocation of sortedAllocations) {
      const key = targetKey(allocation.targetType, allocation.targetId);
      const target = targets.get(key)!;
      if (target.status === "cancelled") {
        throw new FinancialAllocationError(
          "cancelled_target",
          "Um titulo cancelado nao pode receber alocacoes.",
        );
      }
      const existingAllocated = await sumTargetAllocations(
        transaction,
        organizationId,
        allocation.targetType,
        allocation.targetId,
      );
      targetResults.set(
        key,
        calculateAllocationTotal({
          cachedSettled: target.cachedSettled,
          capacity: target.amount,
          existingAllocated,
          requested: allocation.amount,
          scope: "target",
        }),
      );
    }

    const createdAllocations = [];
    for (const allocation of sortedAllocations) {
      const [created] = await transaction
        .insert(financialAllocations)
        .values({
          amount: allocation.amount,
          createdByUserId: context.userId,
          financialEntryId:
            allocation.targetType === "receivable" ? allocation.targetId : null,
          financialExpenseId:
            allocation.targetType === "payable" ? allocation.targetId : null,
          metadata: null,
          organizationId,
          transactionId: financialTransaction.id,
        })
        .returning();
      createdAllocations.push(created);
      await transaction.insert(auditLogs).values(
        createAuditLogValues(context, {
          action: "create",
          after: created,
          entityId: created.id,
          entityType: "financial_allocation",
        }),
      );
    }

    for (const allocation of sortedAllocations) {
      const key = targetKey(allocation.targetType, allocation.targetId);
      const before = targets.get(key)!;
      const result = targetResults.get(key)!;
      const settlementDate =
        result.status === "settled"
          ? maxDate(before.date, toDateKey(financialTransaction.occurredAt))
          : before.date;

      const after =
        allocation.targetType === "receivable"
          ? (
              await transaction
                .update(financialEntries)
                .set({
                  receivedAmount: result.settledAmount,
                  receivedDate: settlementDate,
                  status:
                    result.status === "settled"
                      ? "received"
                      : before.status === "overdue"
                        ? "overdue"
                        : "planned",
                  updatedAt: new Date(),
                })
                .where(
                  and(
                    eq(financialEntries.id, allocation.targetId),
                    eq(financialEntries.organizationId, organizationId),
                  ),
                )
                .returning()
            )[0]
          : (
              await transaction
                .update(financialExpenses)
                .set({
                  paidAmount: result.settledAmount,
                  paidDate: settlementDate,
                  status:
                    result.status === "settled"
                      ? "paid"
                      : before.status === "overdue"
                        ? "overdue"
                        : "planned",
                  updatedAt: new Date(),
                })
                .where(
                  and(
                    eq(financialExpenses.id, allocation.targetId),
                    eq(financialExpenses.organizationId, organizationId),
                  ),
                )
                .returning()
            )[0];

      await transaction.insert(auditLogs).values(
        createAuditLogValues(context, {
          action: "status_change",
          after,
          before,
          entityId: allocation.targetId,
          entityType:
            allocation.targetType === "receivable"
              ? "financial_entry"
              : "financial_expense",
          metadata: { source: "financial_allocation" },
        }),
      );
    }

    const nextTransactionStatus =
      transactionResult.status === "settled"
        ? "reconciled"
        : transactionResult.status === "partial"
          ? "partially_reconciled"
          : "pending_reconciliation";
    const [updatedTransaction] = await transaction
      .update(financialTransactions)
      .set({ status: nextTransactionStatus, updatedAt: new Date() })
      .where(
        and(
          eq(financialTransactions.id, financialTransaction.id),
          eq(financialTransactions.organizationId, organizationId),
        ),
      )
      .returning();

    await transaction.insert(auditLogs).values(
      createAuditLogValues(context, {
        action: "status_change",
        after: updatedTransaction,
        before: financialTransaction,
        entityId: financialTransaction.id,
        entityType: "financial_transaction",
        metadata: { source: "financial_allocation" },
      }),
    );

    return {
      allocations: createdAllocations,
      transaction: updatedTransaction,
    };
  });
}

type AllocationTransaction = Parameters<Parameters<typeof withTenantDb>[1]>[0];

async function lockTarget(
  transaction: AllocationTransaction,
  organizationId: string,
  targetType: FinancialAllocationTargetType,
  targetId: string,
): Promise<LockedTarget> {
  if (targetType === "receivable") {
    const rows = await transaction
      .select({
        amount: financialEntries.amount,
        cachedSettled: financialEntries.receivedAmount,
        date: financialEntries.receivedDate,
        id: financialEntries.id,
        status: financialEntries.status,
      })
      .from(financialEntries)
      .where(
        and(
          eq(financialEntries.id, targetId),
          eq(financialEntries.organizationId, organizationId),
          isNull(financialEntries.deletedAt),
        ),
      )
      .limit(1)
      .for("update");
    const row = rows[0];
    if (!row) throw new AccessDeniedError();
    return {
      ...row,
      cachedSettled:
        row.cachedSettled ?? (row.status === "received" ? row.amount : "0.00"),
      targetType,
    };
  }

  const rows = await transaction
    .select({
      amount: financialExpenses.amount,
      cachedSettled: financialExpenses.paidAmount,
      date: financialExpenses.paidDate,
      id: financialExpenses.id,
      status: financialExpenses.status,
    })
    .from(financialExpenses)
    .where(
      and(
        eq(financialExpenses.id, targetId),
        eq(financialExpenses.organizationId, organizationId),
        isNull(financialExpenses.deletedAt),
      ),
    )
    .limit(1)
    .for("update");
  const row = rows[0];
  if (!row) throw new AccessDeniedError();
  return { ...row, targetType };
}

async function sumTransactionAllocations(
  transaction: AllocationTransaction,
  organizationId: string,
  transactionId: string,
) {
  const [row] = await transaction
    .select({ total: sql<string>`coalesce(sum(${financialAllocations.amount}), 0)` })
    .from(financialAllocations)
    .where(
      and(
        eq(financialAllocations.organizationId, organizationId),
        eq(financialAllocations.transactionId, transactionId),
      ),
    );
  return row?.total ?? "0.00";
}

async function sumTargetAllocations(
  transaction: AllocationTransaction,
  organizationId: string,
  targetType: FinancialAllocationTargetType,
  targetId: string,
) {
  const targetCondition =
    targetType === "receivable"
      ? eq(financialAllocations.financialEntryId, targetId)
      : eq(financialAllocations.financialExpenseId, targetId);
  const [row] = await transaction
    .select({ total: sql<string>`coalesce(sum(${financialAllocations.amount}), 0)` })
    .from(financialAllocations)
    .where(and(eq(financialAllocations.organizationId, organizationId), targetCondition));
  return row?.total ?? "0.00";
}

function assertDirection(direction: string, targetType: FinancialAllocationTargetType) {
  if (
    (direction === "in" && targetType !== "receivable") ||
    (direction === "out" && targetType !== "payable")
  ) {
    throw new FinancialAllocationError(
      "direction_mismatch",
      "A direcao da movimentacao nao corresponde ao tipo do titulo.",
    );
  }
}

function targetKey(targetType: FinancialAllocationTargetType, targetId: string) {
  return `${targetType}:${targetId}`;
}

function maxDate(left: string | null, right: string) {
  return left && left > right ? left : right;
}
