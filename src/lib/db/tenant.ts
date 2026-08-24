import { AsyncLocalStorage } from "node:async_hooks";

import { sql } from "drizzle-orm";
import { z } from "zod";

import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError } from "@/lib/rbac";

import type { Database } from "./index";

const tenantIdentitySchema = z.object({
  organizationId: z.string().uuid(),
  userId: z.string().trim().min(1),
});

export type TenantTransaction = Parameters<
  Parameters<Database["transaction"]>[0]
>[0];

export type TenantDbOperation<Result> = (
  transaction: TenantTransaction,
) => Promise<Result>;

type TransactionalDatabase = Pick<Database, "transaction">;

type TenantTransactionContext = {
  organizationId: string;
  transaction: TenantTransaction;
  userId: string;
};

const tenantTransactionStorage =
  new AsyncLocalStorage<TenantTransactionContext>();

export function getActiveTenantTransaction() {
  return tenantTransactionStorage.getStore()?.transaction;
}

/**
 * Runs tenant database work in one transaction with transaction-local RLS
 * identity. Throwing from the operation rolls back every awaited write.
 * Nested calls for the same identity reuse the active transaction; switching
 * organization or user while it is active is denied.
 */
export function createWithTenantDb(database: TransactionalDatabase) {
  return async function withConfiguredTenantDb<T>(
    context: AccessContext,
    operation: TenantDbOperation<T>,
  ): Promise<T> {
    const identity = tenantIdentitySchema.safeParse(context);

    if (!identity.success) {
      throw new AccessDeniedError();
    }

    const activeContext = tenantTransactionStorage.getStore();

    if (activeContext) {
      if (
        activeContext.organizationId !== identity.data.organizationId ||
        activeContext.userId !== identity.data.userId
      ) {
        throw new AccessDeniedError();
      }

      return operation(activeContext.transaction);
    }

    return database.transaction(async (transaction) => {
      await transaction.execute(sql`
        select
          set_config('app.organization_id', ${identity.data.organizationId}, true),
          set_config('app.user_id', ${identity.data.userId}, true)
      `);

      return tenantTransactionStorage.run(
        {
          organizationId: identity.data.organizationId,
          transaction,
          userId: identity.data.userId,
        },
        () => operation(transaction),
      );
    });
  };
}
