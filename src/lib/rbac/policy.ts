import { permissionKeys, roleKeys, type PermissionKey, type RoleKey } from "./permissions";

export function isRoleKey(value: string): value is RoleKey {
  return (roleKeys as readonly string[]).includes(value);
}

export function isPermissionKey(value: string): value is PermissionKey {
  return (permissionKeys as readonly string[]).includes(value);
}

export function hasPermission(
  permissions: readonly PermissionKey[],
  permission: PermissionKey,
) {
  return permissions.includes(permission);
}

export function hasAnyPermission(
  permissions: readonly PermissionKey[],
  requiredPermissions: readonly PermissionKey[],
) {
  return requiredPermissions.some((permission) => permissions.includes(permission));
}

const portalOnlyPermissions: ReadonlySet<PermissionKey> = new Set([
  "people.read_own",
  "compensation.read_own",
  "documents.read_own",
  "timeoff.read_own",
  "invoices.read_own",
  "reimbursements.read_own",
  "equipment.read_own",
  "access_records.read_own",
  "saas.read_linked",
]);

export function canAccessBackoffice(permissions: readonly PermissionKey[]) {
  return permissions.some((permission) => !portalOnlyPermissions.has(permission));
}
