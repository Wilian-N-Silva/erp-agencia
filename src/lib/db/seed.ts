const seedSteps = [
  "organization",
  "roles",
  "permissions",
  "role_permissions",
  "initial_admin",
] as const;

async function main() {
  console.log("Seed scaffold ready:", seedSteps.join(", "));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
