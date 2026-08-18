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

type TransactionalDatabase = Pick<Database, "transaction">;

export function createWithTenantDb(database: TransactionalDatabase) {
  return async function withConfiguredTenantDb<T>(
    context: AccessContext | null | undefined,
    callback: (transaction: TenantTransaction) => Promise<T>,
  ): Promise<T> {
    const identity = tenantIdentitySchema.safeParse(context);

    if (!identity.success) {
      throw new AccessDeniedError();
    }

    return database.transaction(async (transaction) => {
      await transaction.execute(sql`
        select
          set_config('app.organization_id', ${identity.data.organizationId}, true),
          set_config('app.user_id', ${identity.data.userId}, true)
      `);

      return callback(transaction);
    });
  };
}
