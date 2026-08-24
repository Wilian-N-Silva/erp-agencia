import { and, eq, gt, isNull, sql } from "drizzle-orm";

import { createAuditLogValues } from "@/lib/audit";
import { db, withTenantDb, type TenantTransaction } from "@/lib/db";
import {
  accessInvitations,
  auditLogs,
  roles,
  userRoles,
  users,
} from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";

import {
  AccessInvitationAuthError,
  invitationAuthErrorCodes,
} from "./lifecycle";
import { invitationRoleKeysSchema, normalizeInvitationEmail } from "./rules";

export {
  AccessInvitationAuthError,
  invitationAuthErrorCodes,
} from "./lifecycle";

export async function findValidInvitationForEmail(
  email: string,
  now = new Date(),
) {
  const normalizedEmail = normalizeInvitationEmail(email);

  return withInvitationEmailDb(normalizedEmail, async (transaction) => {
    const [invitation] = await transaction
      .select({
        id: accessInvitations.id,
        organizationId: accessInvitations.organizationId,
      })
      .from(accessInvitations)
      .where(
        and(
          eq(accessInvitations.email, normalizedEmail),
          isNull(accessInvitations.usedAt),
          gt(accessInvitations.expiresAt, now),
        ),
      )
      .limit(1);

    return invitation ?? null;
  });
}

export async function consumeInvitationForUser(input: {
  email: string;
  organizationId: string;
  userId: string;
}, now = new Date()) {
  const normalizedEmail = normalizeInvitationEmail(input.email);
  const invitationContext: AccessContext = {
    employeeId: null,
    organizationId: input.organizationId,
    permissions: [],
    roles: [],
    userId: input.userId,
  };

  return withTenantDb(invitationContext, async (transaction) => {
    const [invitation] = await transaction
      .update(accessInvitations)
      .set({
        updatedAt: now,
        usedAt: now,
        usedByUserId: input.userId,
      })
      .where(
        and(
          eq(accessInvitations.email, normalizedEmail),
          eq(accessInvitations.organizationId, input.organizationId),
          isNull(accessInvitations.usedAt),
          gt(accessInvitations.expiresAt, now),
        ),
      )
      .returning();

    if (!invitation) {
      throw new AccessInvitationAuthError(invitationAuthErrorCodes.required);
    }

    const parsedRoleKeys = invitationRoleKeysSchema.safeParse(invitation.roleKeys);

    if (!parsedRoleKeys.success) {
      throw new AccessInvitationAuthError(invitationAuthErrorCodes.invalidRoles);
    }

    const roleRows = await transaction
      .select({ id: roles.id, key: roles.key })
      .from(roles);
    const selectedRoles = roleRows.filter((role) =>
      parsedRoleKeys.data.includes(role.key as (typeof parsedRoleKeys.data)[number]),
    );

    if (selectedRoles.length !== parsedRoleKeys.data.length) {
      throw new AccessInvitationAuthError(invitationAuthErrorCodes.invalidRoles);
    }

    await transaction
      .update(users)
      .set({
        organizationId: input.organizationId,
        updatedAt: now,
      })
      .where(eq(users.id, input.userId));

    await transaction.insert(userRoles).values(
      selectedRoles.map((role) => ({
        assignedByUserId: invitation.invitedByUserId,
        roleId: role.id,
        userId: input.userId,
      })),
    );

    await transaction.insert(auditLogs).values(
      createAuditLogValues(invitationContext, {
        action: "status_change",
        entityId: invitation.id,
        entityType: "access_invitation",
        before: {
          usedAt: null,
          usedByUserId: null,
        },
        after: {
          usedAt: now,
          usedByUserId: input.userId,
        },
        metadata: {
          event: "accepted",
        },
      }),
    );

    return invitation;
  });
}

export async function assertSessionUserIsAuthorized(userId: string) {
  const [authorization] = await db
    .select({
      organizationId: users.organizationId,
      roleId: userRoles.roleId,
    })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);

  if (!authorization?.organizationId || !authorization.roleId) {
    throw new AccessInvitationAuthError(
      invitationAuthErrorCodes.unauthorizedSession,
    );
  }
}

export async function findSessionUserIdentity(userId: string) {
  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return user ?? null;
}

async function withInvitationEmailDb<Result>(
  email: string,
  operation: (transaction: TenantTransaction) => Promise<Result>,
) {
  return db.transaction(async (transaction) => {
    await transaction.execute(sql`
      select set_config('app.invitation_email', ${email}, true)
    `);

    return operation(transaction);
  });
}
