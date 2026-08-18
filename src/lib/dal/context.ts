import { eq } from "drizzle-orm";

import { db, withTenantDb } from "@/lib/db";
import { employees, roles, userRoles, users } from "@/lib/db/schema";
import { getCurrentSession } from "@/lib/auth/session";
import { getPermissionsForRoles, isRoleKey, type PermissionKey, type RoleKey } from "@/lib/rbac";

export type AccessContext = {
  userId: string;
  organizationId: string | null;
  employeeId: string | null;
  roles: RoleKey[];
  permissions: PermissionKey[];
};

export type EmployeeScopeTarget = {
  employeeId: string;
  managerEmployeeId?: string | null;
};

export function createAccessContext(input: {
  userId: string;
  organizationId?: string | null;
  employeeId?: string | null;
  roles: readonly RoleKey[];
  permissions?: readonly PermissionKey[];
}): AccessContext {
  const roles = [...input.roles];

  return {
    userId: input.userId,
    organizationId: input.organizationId ?? null,
    employeeId: input.employeeId ?? null,
    roles,
    permissions: [...(input.permissions ?? getPermissionsForRoles(roles))],
  };
}

export async function getCurrentAccessContext() {
  const session = await getCurrentSession();

  if (!session) {
    return null;
  }

  const [user] = await db
    .select({
      organizationId: users.organizationId,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  const assignedRoles = await db
    .select({
      key: roles.key,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, session.user.id));

  const roleKeys = assignedRoles
    .map((role) => role.key)
    .filter(isRoleKey);

  const bootstrapContext = createAccessContext({
    userId: session.user.id,
    organizationId: user?.organizationId ?? null,
    roles: roleKeys.length > 0 ? roleKeys : ["employee"],
  });
  const employee = bootstrapContext.organizationId
    ? await withTenantDb(bootstrapContext, async (tenantDb) => {
        const [row] = await tenantDb
          .select({
            id: employees.id,
          })
          .from(employees)
          .where(
            eq(employees.userId, session.user.id),
          )
          .limit(1);

        return row;
      })
    : undefined;

  return createAccessContext({
    userId: session.user.id,
    organizationId: bootstrapContext.organizationId,
    employeeId: employee?.id ?? null,
    roles: bootstrapContext.roles,
  });
}

export async function runWithCurrentTenantDb<Result>(
  operation: () => Promise<Result>,
) {
  const context = await getCurrentAccessContext();

  if (!context?.organizationId) {
    return operation();
  }

  return withTenantDb(context, operation);
}

export function bindCurrentTenantContext<
  Arguments extends unknown[],
  Result,
>(operation: (...args: Arguments) => Promise<Result>) {
  return async (...args: Arguments) =>
    runWithCurrentTenantDb(() => operation(...args));
}

export function isOwnEmployee(context: AccessContext, employeeId: string) {
  return Boolean(context.employeeId && context.employeeId === employeeId);
}

export function canReadEmployeeTarget(
  context: AccessContext,
  target: EmployeeScopeTarget,
) {
  if (context.permissions.includes("people.read")) {
    return true;
  }

  if (
    context.permissions.includes("people.read_own") &&
    isOwnEmployee(context, target.employeeId)
  ) {
    return true;
  }

  return Boolean(
    context.permissions.includes("people.read_team") &&
      context.employeeId &&
      target.managerEmployeeId === context.employeeId,
  );
}
