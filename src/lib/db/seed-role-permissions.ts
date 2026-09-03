import {
  permissionKeys,
  type PermissionKey,
  type RoleKey,
} from "@/lib/rbac/permissions";

const allPermissions = [...permissionKeys];

/**
 * Bootstrap grants used only by the administrative seed. Runtime authorization
 * must resolve grants from role_permissions.
 */
export const defaultRolePermissions: Record<
  RoleKey,
  readonly PermissionKey[]
> = {
  technical_admin: [
    "dashboard.configure",
    "clients.configure",
    "graphics.read",
    "graphics.write",
    "people.configure",
    "equipment.configure",
    "access_records.configure",
    "saas.configure",
    "lifecycle.read",
    "alerts.read",
    "audit.read",
    "settings.manage",
    "settings.read",
  ],
  director: allPermissions.filter((permission) => permission !== "settings.manage"),
  finance: [
    "dashboard.read",
    "finance.read",
    "finance.write",
    "finance.export",
    "finance.configure",
    "clients.read",
    "clients.write",
    "graphics.read",
    "people.read",
    "compensation.read",
    "compensation.write",
    "invoices.read",
    "invoices.write",
    "invoices.approve",
    "reimbursements.read",
    "reimbursements.write",
    "reimbursements.approve_finance",
    "lifecycle.read",
    "equipment.read",
    "access_records.read",
    "saas.read",
    "saas.write",
    "alerts.read",
    "audit.read_limited",
  ],
  hr_admin: [
    "dashboard.read",
    "clients.read_limited",
    "people.read",
    "people.write",
    "compensation.read",
    "compensation.write",
    "documents.read_sensitive",
    "documents.write",
    "timeoff.read",
    "timeoff.write",
    "invoices.read",
    "reimbursements.read",
    "lifecycle.read",
    "lifecycle.write",
    "alerts.read",
    "alerts.write",
    "equipment.read",
    "access_records.read",
    "saas.read",
    "audit.read_limited",
  ],
  it_governance: [
    "dashboard.read",
    "people.read",
    "equipment.read",
    "equipment.write",
    "access_records.read",
    "access_records.write",
    "saas.read",
    "saas.write",
    "lifecycle.read",
    "lifecycle.write",
    "alerts.read",
    "alerts.write",
    "audit.read_limited",
    "settings.read",
  ],
  leadership: [
    "dashboard.read",
    "clients.read_limited",
    "people.read_team",
    "timeoff.read_team",
    "reimbursements.approve_team",
    "equipment.read_team",
    "access_records.read_team",
    "saas.read_linked",
  ],
  employee: [
    "people.read_own",
    "compensation.read_own",
    "documents.read_own",
    "timeoff.read_own",
    "invoices.read_own",
    "reimbursements.read_own",
    "equipment.read_own",
    "access_records.read_own",
    "saas.read_linked",
  ],
};

export function getSeedPermissionsForRoles(roles: readonly RoleKey[]) {
  return [
    ...new Set(
      roles.flatMap((role) => defaultRolePermissions[role]),
    ),
  ].sort();
}
