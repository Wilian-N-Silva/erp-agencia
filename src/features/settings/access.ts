import { and, countDistinct, eq, inArray, sql } from "drizzle-orm";

import { createAuditLogValues } from "@/lib/audit";
import { withTenantDb } from "@/lib/db";
import {
  auditLogs,
  permissions,
  rolePermissions,
  roles,
  type UserAccessStatus,
  userRoles,
  users,
} from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCan, type RoleKey } from "@/lib/rbac";

import { revokeUserSessions } from "../access/session-revocation";
import { assertRoleReplacementKeepsSettingsAdministrator } from "./rules";

const settingsAdministratorLockPrefix = "acc-004:roles";

export async function replaceUserRoles(
  context: AccessContext,
  input: {
    roleKeys: readonly RoleKey[];
    userId: string;
  },
) {
  assertCan("settings.manage", context);

  if (!context.organizationId) {
    throw new AccessDeniedError();
  }
  const organizationId = context.organizationId;

  return withTenantDb(context, async (transaction) => {
    await lockSettingsAdministratorMutations(transaction, organizationId);

    const [targetUser] = await transaction
      .select({
        accessStatus: users.accessStatus,
        id: users.id,
        isActive: users.isActive,
      })
      .from(users)
      .where(
        and(
          eq(users.id, input.userId),
          eq(users.organizationId, organizationId),
        ),
      )
      .limit(1);

    if (!targetUser) {
      throw new AccessDeniedError();
    }

    const selectedRoles = await transaction
      .select({ id: roles.id, key: roles.key })
      .from(roles)
      .where(inArray(roles.key, input.roleKeys));

    if (selectedRoles.length !== input.roleKeys.length) {
      throw new Error("Invalid role selection.");
    }

    const currentRoles = await transaction
      .select({ key: roles.key })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, input.userId));
    const currentRoleKeys = currentRoles.map(({ key }) => key).sort();
    const selectedRoleIds = selectedRoles.map(({ id }) => id);
    const [currentAdminGrant] = await transaction
      .select({ permissionId: permissions.id })
      .from(userRoles)
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
      .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .where(
        and(
          eq(userRoles.userId, input.userId),
          eq(permissions.key, "settings.manage"),
        ),
      )
      .limit(1);
    const [replacementAdminGrant] = await transaction
      .select({ permissionId: permissions.id })
      .from(rolePermissions)
      .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .where(
        and(
          inArray(rolePermissions.roleId, selectedRoleIds),
          eq(permissions.key, "settings.manage"),
        ),
      )
      .limit(1);

    let activeSettingsAdministratorCount = 0;

    if (currentAdminGrant && !replacementAdminGrant) {
      activeSettingsAdministratorCount =
        await countActiveSettingsAdministrators(transaction, organizationId);
    }

    assertRoleReplacementKeepsSettingsAdministrator({
      activeSettingsAdministratorCount,
      replacementHasSettingsManage: Boolean(replacementAdminGrant),
      targetHasSettingsManage: Boolean(currentAdminGrant),
      targetIsActive:
        targetUser.accessStatus === "active" && targetUser.isActive,
    });

    await transaction
      .delete(userRoles)
      .where(eq(userRoles.userId, input.userId));
    await transaction.insert(userRoles).values(
      selectedRoles.map((role) => ({
        assignedByUserId: context.userId,
        roleId: role.id,
        userId: input.userId,
      })),
    );

    const before = {
      roleKeys: currentRoleKeys,
      userId: input.userId,
    };
    const after = {
      roleKeys: selectedRoles.map(({ key }) => key).sort(),
      userId: input.userId,
    };

    await transaction.insert(auditLogs).values(
      createAuditLogValues(context, {
        action: "permission_change",
        after,
        before,
        entityId: input.userId,
        entityType: "user",
      }),
    );

    return { after, before };
  });
}

export async function updateUserAccessStatus(
  context: AccessContext,
  input: {
    accessStatus: UserAccessStatus;
    userId: string;
  },
) {
  assertCan("settings.manage", context);

  if (!context.organizationId) {
    throw new AccessDeniedError();
  }
  if (input.userId === context.userId && input.accessStatus !== "active") {
    throw new Error("User cannot deactivate themselves.");
  }
  const organizationId = context.organizationId;

  return withTenantDb(context, async (transaction) => {
    await lockSettingsAdministratorMutations(transaction, organizationId);

    const [before] = await transaction
      .select({
        accessStatus: users.accessStatus,
        id: users.id,
        email: users.email,
        isActive: users.isActive,
        name: users.name,
      })
      .from(users)
      .where(
        and(
          eq(users.id, input.userId),
          eq(users.organizationId, organizationId),
        ),
      )
      .limit(1);

    if (!before) {
      throw new AccessDeniedError();
    }

    const targetHasSettingsManage = await userHasSettingsManage(
      transaction,
      input.userId,
    );
    const targetIsActive = before.accessStatus === "active" && before.isActive;
    const removesActiveAdministrator =
      targetIsActive &&
      targetHasSettingsManage &&
      input.accessStatus !== "active";
    const activeSettingsAdministratorCount = removesActiveAdministrator
      ? await countActiveSettingsAdministrators(transaction, organizationId)
      : 0;

    assertRoleReplacementKeepsSettingsAdministrator({
      activeSettingsAdministratorCount,
      replacementHasSettingsManage:
        targetHasSettingsManage && input.accessStatus === "active",
      targetHasSettingsManage,
      targetIsActive,
    });

    const [after] = await transaction
      .update(users)
      .set({
        accessStatus: input.accessStatus,
        isActive: input.accessStatus === "active",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(users.id, input.userId),
          eq(users.organizationId, organizationId),
        ),
      )
      .returning();

    if (!after) {
      throw new AccessDeniedError();
    }

    const revokedSessionCount = ["suspended", "revoked"].includes(
      input.accessStatus,
    )
      ? await revokeUserSessions(transaction, {
          organizationId,
          userId: input.userId,
        })
      : 0;

    await transaction.insert(auditLogs).values(
      createAuditLogValues(context, {
        action: "status_change",
        after,
        before,
        entityId: input.userId,
        entityType: "user",
        metadata: {
          accessStatus: input.accessStatus,
          revokedSessionCount,
        },
      }),
    );

    return { after, before };
  });
}

type SettingsTransaction = Parameters<Parameters<typeof withTenantDb>[1]>[0];

async function lockSettingsAdministratorMutations(
  transaction: SettingsTransaction,
  organizationId: string,
) {
  await transaction.execute(sql`
    select pg_advisory_xact_lock(
      hashtextextended(
        ${`${settingsAdministratorLockPrefix}:${organizationId}`},
        0
      )
    )
  `);
}

async function userHasSettingsManage(
  transaction: SettingsTransaction,
  userId: string,
) {
  const [grant] = await transaction
    .select({ permissionId: permissions.id })
    .from(userRoles)
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(
      and(eq(userRoles.userId, userId), eq(permissions.key, "settings.manage")),
    )
    .limit(1);

  return Boolean(grant);
}

async function countActiveSettingsAdministrators(
  transaction: SettingsTransaction,
  organizationId: string,
) {
  const [activeAdminCount] = await transaction
    .select({ count: countDistinct(users.id) })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(
      and(
        eq(users.organizationId, organizationId),
        eq(users.accessStatus, "active"),
        eq(users.isActive, true),
        eq(permissions.key, "settings.manage"),
      ),
    );

  return activeAdminCount?.count ?? 0;
}
