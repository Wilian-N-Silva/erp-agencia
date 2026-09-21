import { getSeedPermissionsForRoles } from "@/lib/db/seed-role-permissions";
import {
  createAccessContext as createRuntimeAccessContext,
} from "@/lib/dal";
import type { PermissionKey, RoleKey } from "@/lib/rbac";

export function createAccessContext(input: {
  employeeId?: string | null;
  organizationId?: string | null;
  permissions?: readonly PermissionKey[];
  roles: readonly RoleKey[];
  userId: string;
}) {
  return createRuntimeAccessContext({
    ...input,
    permissions:
      input.permissions ?? getSeedPermissionsForRoles(input.roles),
  });
}
