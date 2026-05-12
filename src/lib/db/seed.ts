import {
  defaultRolePermissions,
  permissionDescriptions,
  roleLabels,
} from "@/lib/rbac";

const seedSteps = [
  "organization",
  "roles",
  "permissions",
  "role_permissions",
  "initial_admin",
] as const;

async function main() {
  console.log("Seed scaffold ready:", seedSteps.join(", "));
  console.log("RBAC roles:", Object.keys(roleLabels).length);
  console.log("RBAC permissions:", Object.keys(permissionDescriptions).length);
  console.log("RBAC grants:", Object.values(defaultRolePermissions).flat().length);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
