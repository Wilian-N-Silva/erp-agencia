import type { AccessContext } from "@/lib/dal/context";

import { AccessDeniedError } from "./errors";
import { hasAnyPermission, hasPermission } from "./policy";
import type { PermissionKey } from "./permissions";

export function can(permission: PermissionKey, context: AccessContext) {
  return hasPermission(context.permissions, permission);
}

export function canAny(
  permissions: readonly PermissionKey[],
  context: AccessContext,
) {
  return hasAnyPermission(context.permissions, permissions);
}

export function assertCan(permission: PermissionKey, context: AccessContext) {
  if (!can(permission, context)) {
    throw new AccessDeniedError();
  }
}

export function assertCanAny(
  permissions: readonly PermissionKey[],
  context: AccessContext,
) {
  if (!canAny(permissions, context)) {
    throw new AccessDeniedError();
  }
}
