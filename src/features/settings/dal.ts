import { and, asc, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  appSettings,
  employees,
  permissions,
  rolePermissions,
  roles,
  userRoles,
  users,
} from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import {
  AccessDeniedError,
  assertCanAny,
  isPermissionKey,
  isRoleKey,
  type PermissionKey,
  type RoleKey,
} from "@/lib/rbac";

export type SettingsUserListItem = {
  id: string;
  email: string;
  employeeName: string | null;
  isActive: boolean;
  name: string;
  roles: RoleKey[];
  createdAt: Date;
  updatedAt: Date;
};

export type SettingsRoleItem = {
  id: string;
  key: RoleKey;
  name: string;
  description: string | null;
  permissions: PermissionKey[];
};

export type SettingsPermissionItem = {
  id: string;
  key: PermissionKey;
  description: string;
};

export type AppSettingListItem = {
  id: string;
  key: string;
  value: unknown;
  description: string | null;
  updatedByName: string | null;
  updatedAt: Date;
};

export type SettingsDashboard = {
  appSettings: AppSettingListItem[];
  permissions: SettingsPermissionItem[];
  roles: SettingsRoleItem[];
  users: SettingsUserListItem[];
};

export async function getSettingsDashboard(
  context: AccessContext,
): Promise<SettingsDashboard> {
  assertCanAny(["settings.read", "settings.manage"], context);
  const organizationId = requireOrganizationId(context);
  const [userRows, roleRows, permissionRows, rolePermissionRows, userRoleRows, settingRows] =
    await Promise.all([
      db
        .select({
          id: users.id,
          email: users.email,
          employeeName: employees.fullName,
          isActive: users.isActive,
          name: users.name,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .leftJoin(
          employees,
          and(eq(employees.userId, users.id), isNull(employees.deletedAt)),
        )
        .where(eq(users.organizationId, organizationId))
        .orderBy(asc(users.name), asc(users.email)),
      db.select().from(roles).orderBy(asc(roles.name)),
      db.select().from(permissions).orderBy(asc(permissions.key)),
      db
        .select({
          roleId: rolePermissions.roleId,
          permissionKey: permissions.key,
        })
        .from(rolePermissions)
        .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id)),
      db
        .select({
          userId: userRoles.userId,
          roleKey: roles.key,
        })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id)),
      db
        .select({
          id: appSettings.id,
          key: appSettings.key,
          value: appSettings.value,
          description: appSettings.description,
          updatedByName: users.name,
          updatedAt: appSettings.updatedAt,
        })
        .from(appSettings)
        .leftJoin(users, eq(appSettings.updatedByUserId, users.id))
        .where(eq(appSettings.organizationId, organizationId))
        .orderBy(asc(appSettings.key)),
    ]);
  const rolePermissionsByRoleId = groupRolePermissions(rolePermissionRows);
  const rolesByUserId = groupUserRoles(userRoleRows);

  return {
    appSettings: settingRows,
    permissions: permissionRows.flatMap((permission) => {
      if (!isPermissionKey(permission.key)) {
        return [];
      }

      return [{
        id: permission.id,
        key: permission.key,
        description: permission.description,
      }];
    }),
    roles: roleRows.flatMap((role) => {
      if (!isRoleKey(role.key)) {
        return [];
      }

      return [{
        id: role.id,
        key: role.key,
        name: role.name,
        description: role.description,
        permissions: rolePermissionsByRoleId.get(role.id) ?? [],
      }];
    }),
    users: userRows.map((user) => ({
      ...user,
      roles: rolesByUserId.get(user.id) ?? [],
    })),
  };
}

function groupRolePermissions(
  rows: { permissionKey: string; roleId: string }[],
) {
  const byRoleId = new Map<string, PermissionKey[]>();

  for (const row of rows) {
    if (!isPermissionKey(row.permissionKey)) {
      continue;
    }

    const current = byRoleId.get(row.roleId) ?? [];
    current.push(row.permissionKey);
    byRoleId.set(row.roleId, current);
  }

  return byRoleId;
}

function groupUserRoles(rows: { roleKey: string; userId: string }[]) {
  const byUserId = new Map<string, RoleKey[]>();

  for (const row of rows) {
    if (!isRoleKey(row.roleKey)) {
      continue;
    }

    const current = byUserId.get(row.userId) ?? [];
    current.push(row.roleKey);
    byUserId.set(row.userId, current);
  }

  return byUserId;
}

function requireOrganizationId(context: AccessContext) {
  if (!context.organizationId) {
    throw new AccessDeniedError();
  }

  return context.organizationId;
}
