import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { createAuditLogValues } from "@/lib/audit";
import { bindTenantContext, db, withTenantDb } from "@/lib/db";
import {
  auditLogs,
  clients,
  financialAccounts,
  financialTransactions,
  suppliers,
} from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCanAny } from "@/lib/rbac";

import type {
  FinancialTransactionDirection,
  FinancialTransactionInput,
  FinancialTransactionStatus,
} from "./rules";

export async function createFinancialTransactionRecord(
  context: AccessContext,
  input: FinancialTransactionInput,
) {
  assertCanAny(["finance.write"], context);
  const organizationId = requireOrganizationId(context);

  return withTenantDb(context, async (transaction) => {
    const [account, client, supplier] = await Promise.all([
      transaction
        .select({ id: financialAccounts.id })
        .from(financialAccounts)
        .where(
          and(
            eq(financialAccounts.id, input.accountId),
            eq(financialAccounts.organizationId, organizationId),
            eq(financialAccounts.status, "active"),
          ),
        )
        .limit(1),
      input.clientId
        ? transaction
            .select({ id: clients.id })
            .from(clients)
            .where(
              and(
                eq(clients.id, input.clientId),
                eq(clients.organizationId, organizationId),
                isNull(clients.deletedAt),
              ),
            )
            .limit(1)
        : Promise.resolve([{ id: null }]),
      input.supplierId
        ? transaction
            .select({ id: suppliers.id })
            .from(suppliers)
            .where(
              and(
                eq(suppliers.id, input.supplierId),
                eq(suppliers.organizationId, organizationId),
                eq(suppliers.isActive, true),
              ),
            )
            .limit(1)
        : Promise.resolve([{ id: null }]),
    ]);

    if (!account[0] || !client[0] || !supplier[0]) {
      throw new AccessDeniedError();
    }

    const [created] = await transaction
      .insert(financialTransactions)
      .values({
        accountId: input.accountId,
        amount: input.amount,
        clientId: input.clientId,
        counterpartyName: input.counterpartyName,
        createdByUserId: context.userId,
        direction: input.direction,
        importMetadata: null,
        method: input.method,
        occurredAt: input.occurredAt,
        organizationId,
        origin: "manual",
        reference: input.reference,
        status: "pending_reconciliation",
        supplierId: input.supplierId,
      })
      .returning();

    await transaction.insert(auditLogs).values(
      createAuditLogValues(context, {
        action: "create",
        entityType: "financial_transaction",
        entityId: created.id,
        after: created,
      }),
    );

    return created;
  });
}

export type FinancialTransactionListItem = {
  id: string;
  accountId: string;
  accountName: string;
  amount: string;
  clientId: string | null;
  clientName: string | null;
  counterpartyName: string | null;
  direction: FinancialTransactionDirection;
  method: string | null;
  occurredAt: Date;
  reference: string | null;
  status: FinancialTransactionStatus;
  supplierId: string | null;
  supplierName: string | null;
};

export type FinancialTransactionFormOptions = {
  accounts: Array<{ id: string; name: string }>;
  clients: Array<{ id: string; name: string }>;
  suppliers: Array<{ id: string; name: string }>;
};

async function listFinancialTransactions(
  context: AccessContext,
): Promise<FinancialTransactionListItem[]> {
  assertCanAny(["finance.read", "finance.write"], context);
  const organizationId = requireOrganizationId(context);

  const rows = await db
    .select({
      id: financialTransactions.id,
      accountId: financialTransactions.accountId,
      accountName: financialAccounts.name,
      amount: financialTransactions.amount,
      clientId: financialTransactions.clientId,
      clientName: clients.name,
      counterpartyName: financialTransactions.counterpartyName,
      direction: financialTransactions.direction,
      method: financialTransactions.method,
      occurredAt: financialTransactions.occurredAt,
      reference: financialTransactions.reference,
      status: financialTransactions.status,
      supplierId: financialTransactions.supplierId,
      supplierName: suppliers.name,
    })
    .from(financialTransactions)
    .innerJoin(
      financialAccounts,
      and(
        eq(financialAccounts.id, financialTransactions.accountId),
        eq(financialAccounts.organizationId, organizationId),
      ),
    )
    .leftJoin(
      clients,
      and(
        eq(clients.id, financialTransactions.clientId),
        eq(clients.organizationId, organizationId),
      ),
    )
    .leftJoin(
      suppliers,
      and(
        eq(suppliers.id, financialTransactions.supplierId),
        eq(suppliers.organizationId, organizationId),
      ),
    )
    .where(eq(financialTransactions.organizationId, organizationId))
    .orderBy(desc(financialTransactions.occurredAt), desc(financialTransactions.createdAt))
    .limit(200);

  return rows as FinancialTransactionListItem[];
}

async function listFinancialTransactionFormOptions(
  context: AccessContext,
): Promise<FinancialTransactionFormOptions> {
  assertCanAny(["finance.read", "finance.write"], context);
  const organizationId = requireOrganizationId(context);
  const [accounts, clientRows, supplierRows] = await Promise.all([
    db
      .select({ id: financialAccounts.id, name: financialAccounts.name })
      .from(financialAccounts)
      .where(
        and(
          eq(financialAccounts.organizationId, organizationId),
          eq(financialAccounts.status, "active"),
        ),
      )
      .orderBy(asc(financialAccounts.name)),
    db
      .select({ id: clients.id, name: clients.name })
      .from(clients)
      .where(
        and(eq(clients.organizationId, organizationId), isNull(clients.deletedAt)),
      )
      .orderBy(asc(clients.name)),
    db
      .select({ id: suppliers.id, name: suppliers.name })
      .from(suppliers)
      .where(
        and(eq(suppliers.organizationId, organizationId), eq(suppliers.isActive, true)),
      )
      .orderBy(asc(suppliers.name)),
  ]);

  return { accounts, clients: clientRows, suppliers: supplierRows };
}

function requireOrganizationId(context: AccessContext) {
  if (!context.organizationId) throw new AccessDeniedError();
  return context.organizationId;
}

export const getFinancialTransactions = bindTenantContext(
  listFinancialTransactions,
);
export const getFinancialTransactionFormOptions = bindTenantContext(
  listFinancialTransactionFormOptions,
);
