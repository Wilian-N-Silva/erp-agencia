import { and, eq } from "drizzle-orm";

import type { TenantTransaction } from "@/lib/db";
import { sessions, users } from "@/lib/db/schema";
import { AccessDeniedError } from "@/lib/rbac";

export async function revokeUserSessions(
  transaction: TenantTransaction,
  input: {
    organizationId: string;
    userId: string;
  },
) {
  const [targetUser] = await transaction
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.id, input.userId),
        eq(users.organizationId, input.organizationId),
      ),
    )
    .limit(1);

  if (!targetUser) {
    throw new AccessDeniedError();
  }

  const revokedSessions = await transaction
    .delete(sessions)
    .where(eq(sessions.userId, targetUser.id))
    .returning({ id: sessions.id });

  return revokedSessions.length;
}
