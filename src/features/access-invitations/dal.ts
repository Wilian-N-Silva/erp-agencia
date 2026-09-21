import { desc, eq } from "drizzle-orm";

import { bindTenantContext, db } from "@/lib/db";
import { accessInvitations } from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCanAny, type RoleKey } from "@/lib/rbac";

import { invitationRoleKeysSchema } from "./rules";

export type AccessInvitationListItem = {
  id: string;
  email: string;
  roleKeys: RoleKey[];
  expiresAt: Date;
  usedAt: Date | null;
  usedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

async function listAccessInvitations(
  context: AccessContext,
): Promise<AccessInvitationListItem[]> {
  assertCanAny(["settings.read", "settings.manage"], context);

  if (!context.organizationId) {
    throw new AccessDeniedError();
  }

  const rows = await db
    .select({
      createdAt: accessInvitations.createdAt,
      email: accessInvitations.email,
      expiresAt: accessInvitations.expiresAt,
      id: accessInvitations.id,
      roleKeys: accessInvitations.roleKeys,
      updatedAt: accessInvitations.updatedAt,
      usedAt: accessInvitations.usedAt,
      usedByUserId: accessInvitations.usedByUserId,
    })
    .from(accessInvitations)
    .where(eq(accessInvitations.organizationId, context.organizationId))
    .orderBy(desc(accessInvitations.createdAt));

  return rows.map((row) => {
    const roleKeys = invitationRoleKeysSchema.safeParse(row.roleKeys);

    return {
      ...row,
      roleKeys: roleKeys.success ? roleKeys.data : [],
    };
  });
}

export { tenantListAccessInvitations as listAccessInvitations };

const tenantListAccessInvitations = bindTenantContext(listAccessInvitations);
