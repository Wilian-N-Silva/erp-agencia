import { hashPassword } from "better-auth/crypto";
import { and, eq, isNull } from "drizzle-orm";
import { createRequire } from "node:module";

import { getOptionalEnv } from "@/lib/env";
import {
  defaultRolePermissions,
  permissionDescriptions,
  roleLabels,
  type PermissionKey,
  type RoleKey,
} from "@/lib/rbac";

import { db } from "./index";
import {
  accounts,
  areas,
  clients,
  employees,
  financialEntries,
  financialExpenses,
  permissions,
  positions,
  provisions,
  rolePermissions,
  roles,
  userRoles,
  users,
  organizations,
} from "./schema";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env") as typeof import("@next/env");

loadEnvConfig(process.cwd());

const organizationSeed = {
  name: "Formula Group",
  slug: "formula-group",
};

async function main() {
  const organization = await seedOrganization();
  const roleByKey = await seedRoles();
  const permissionByKey = await seedPermissions();

  await seedRolePermissions(roleByKey, permissionByKey);
  const adminUser = await seedInitialAdmin(organization.id, roleByKey);
  const ownerEmployeeId = adminUser
    ? await seedInitialEmployee(organization.id, adminUser.id)
    : null;

  await seedFinanceClientDemoData(organization.id, adminUser?.id, ownerEmployeeId);

  console.log("Seed complete:");
  console.log(`- organization: ${organization.name}`);
  console.log(`- roles: ${Object.keys(roleByKey).length}`);
  console.log(`- permissions: ${Object.keys(permissionByKey).length}`);
  console.log(`- admin: ${adminUser?.email ?? "skipped"}`);
}

async function seedOrganization() {
  const [organization] = await db
    .insert(organizations)
    .values(organizationSeed)
    .onConflictDoUpdate({
      target: organizations.slug,
      set: {
        name: organizationSeed.name,
        updatedAt: new Date(),
      },
    })
    .returning();

  return organization;
}

async function seedRoles() {
  await db
    .insert(roles)
    .values(
      typedEntries(roleLabels).map(([key, name]) => ({
        key,
        name,
        description: `Perfil ${name}`,
      })),
    )
    .onConflictDoUpdate({
      target: roles.key,
      set: {
        name: roles.name,
        description: roles.description,
      },
    });

  const rows = await db.select().from(roles);

  return Object.fromEntries(rows.map((role) => [role.key, role])) as Record<
    RoleKey,
    (typeof rows)[number]
  >;
}

async function seedPermissions() {
  await db
    .insert(permissions)
    .values(
      typedEntries(permissionDescriptions).map(([key, description]) => ({
        key,
        description,
      })),
    )
    .onConflictDoUpdate({
      target: permissions.key,
      set: {
        description: permissions.description,
      },
    });

  const rows = await db.select().from(permissions);

  return Object.fromEntries(rows.map((permission) => [permission.key, permission])) as Record<
    PermissionKey,
    (typeof rows)[number]
  >;
}

async function seedRolePermissions(
  roleByKey: Record<RoleKey, typeof roles.$inferSelect>,
  permissionByKey: Record<PermissionKey, typeof permissions.$inferSelect>,
) {
  const grants = typedEntries(defaultRolePermissions).flatMap(([roleKey, rolePermissions]) =>
    rolePermissions.map((permissionKey) => ({
      roleId: roleByKey[roleKey].id,
      permissionId: permissionByKey[permissionKey].id,
    })),
  );

  if (grants.length === 0) {
    return;
  }

  await db.insert(rolePermissions).values(grants).onConflictDoNothing();
}

async function seedInitialAdmin(
  organizationId: string,
  roleByKey: Record<RoleKey, typeof roles.$inferSelect>,
) {
  const email = getOptionalEnv("INITIAL_ADMIN_EMAIL")?.trim().toLowerCase();
  const name = getOptionalEnv("INITIAL_ADMIN_NAME")?.trim() || "Admin Local";
  const password = getOptionalEnv("INITIAL_ADMIN_PASSWORD");

  if (!email || !password) {
    console.log("Initial admin skipped: set INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD.");
    return null;
  }

  const [user] = await db
    .insert(users)
    .values({
      id: "initial-admin",
      organizationId,
      name,
      email,
      emailVerified: true,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        organizationId,
        name,
        emailVerified: true,
        isActive: true,
        updatedAt: new Date(),
      },
    })
    .returning();

  const passwordHash = await hashPassword(password);

  await db
    .insert(accounts)
    .values({
      id: `credential:${user.id}`,
      userId: user.id,
      accountId: user.id,
      providerId: "credential",
      password: passwordHash,
    })
    .onConflictDoUpdate({
      target: [accounts.providerId, accounts.accountId],
      set: {
        password: passwordHash,
        updatedAt: new Date(),
      },
    });

  await db
    .insert(userRoles)
    .values(
      (["technical_admin", "director", "finance"] satisfies RoleKey[]).map((roleKey) => ({
        userId: user.id,
        roleId: roleByKey[roleKey].id,
        assignedByUserId: user.id,
      })),
    )
    .onConflictDoNothing();

  return user;
}

async function seedInitialEmployee(organizationId: string, userId: string) {
  const [area] = await db
    .insert(areas)
    .values({
      organizationId,
      name: "Diretoria",
    })
    .onConflictDoUpdate({
      target: [areas.organizationId, areas.name],
      set: {
        name: "Diretoria",
      },
    })
    .returning();

  const [position] = await db
    .insert(positions)
    .values({
      organizationId,
      name: "Admin Local",
    })
    .onConflictDoUpdate({
      target: [positions.organizationId, positions.name],
      set: {
        name: "Admin Local",
      },
    })
    .returning();

  const [employee] = await db
    .insert(employees)
    .values({
      organizationId,
      userId,
      registrationNumber: "FG-00001",
      fullName: getOptionalEnv("INITIAL_ADMIN_NAME") ?? "Admin Local",
      corporateEmail: getOptionalEnv("INITIAL_ADMIN_EMAIL")?.trim().toLowerCase(),
      positionId: position.id,
      areaId: area.id,
      employmentType: "partner",
      startDate: "2026-05-01",
      status: "active",
      currentCompensation: "0.00",
    })
    .onConflictDoUpdate({
      target: [employees.organizationId, employees.registrationNumber],
      set: {
        userId,
        fullName: getOptionalEnv("INITIAL_ADMIN_NAME") ?? "Admin Local",
        corporateEmail: getOptionalEnv("INITIAL_ADMIN_EMAIL")?.trim().toLowerCase(),
        positionId: position.id,
        areaId: area.id,
        status: "active",
        updatedAt: new Date(),
      },
    })
    .returning();

  return employee.id;
}

async function seedFinanceClientDemoData(
  organizationId: string,
  responsibleUserId?: string,
  ownerEmployeeId?: string | null,
) {
  if (!responsibleUserId) {
    return;
  }

  const [activeClient] = await upsertClient({
    organizationId,
    code: "CLI-00001",
    name: "Cliente Exemplo Ativo",
    monthlyFee: "8500.00",
    billingDay: 10,
    internalOwnerEmployeeId: ownerEmployeeId ?? null,
  });

  await upsertClient({
    organizationId,
    code: "CLI-00002",
    name: "Cliente Exemplo Pausado",
    status: "paused",
    monthlyFee: "4200.00",
    billingDay: 20,
    internalOwnerEmployeeId: ownerEmployeeId ?? null,
  });

  await ensureFinancialEntry("Fee maio - Cliente Exemplo Ativo", {
    organizationId,
    clientId: activeClient.id,
    description: "Fee maio - Cliente Exemplo Ativo",
    amount: "8500.00",
    dueDate: "2026-05-10",
    receivedDate: "2026-05-10",
    competence: "2026-05",
    status: "received",
    recurring: true,
    responsibleUserId,
  });

  await ensureFinancialEntry("Fee atrasado - Cliente Exemplo Ativo", {
    organizationId,
    clientId: activeClient.id,
    description: "Fee atrasado - Cliente Exemplo Ativo",
    amount: "2500.00",
    dueDate: "2026-05-05",
    competence: "2026-05",
    status: "planned",
    recurring: false,
    responsibleUserId,
  });

  await ensureFinancialExpense("Software operacional", {
    organizationId,
    supplier: "Fornecedor SaaS",
    category: "software",
    description: "Software operacional",
    amount: "780.00",
    dueDate: "2026-05-18",
    competence: "2026-05",
    status: "planned",
    recurring: true,
    responsibleUserId,
  });

  await ensureFinancialExpense("Despesa paga exemplo", {
    organizationId,
    supplier: "Fornecedor Administrativo",
    category: "administrativo",
    description: "Despesa paga exemplo",
    amount: "320.00",
    dueDate: "2026-05-08",
    paidDate: "2026-05-08",
    competence: "2026-05",
    status: "paid",
    recurring: false,
    responsibleUserId,
  });

  await ensureProvision("Folha mensal", {
    organizationId,
    name: "Folha mensal",
    category: "folha",
    estimatedMonthlyAmount: "12000.00",
    expectedDay: 30,
    recurring: true,
    status: "active",
  });
}

async function upsertClient(values: typeof clients.$inferInsert) {
  return db
    .insert(clients)
    .values(values)
    .onConflictDoUpdate({
      target: [clients.organizationId, clients.code],
      set: {
        name: values.name,
        monthlyFee: values.monthlyFee,
        billingDay: values.billingDay,
        status: values.status ?? "active",
        internalOwnerEmployeeId: values.internalOwnerEmployeeId,
        updatedAt: new Date(),
      },
    })
    .returning();
}

async function ensureFinancialEntry(
  description: string,
  values: typeof financialEntries.$inferInsert,
) {
  const [existing] = await db
    .select({ id: financialEntries.id })
    .from(financialEntries)
    .where(
      and(
        eq(financialEntries.organizationId, values.organizationId),
        eq(financialEntries.description, description),
        isNull(financialEntries.deletedAt),
      ),
    )
    .limit(1);

  if (existing) {
    return;
  }

  await db.insert(financialEntries).values(values);
}

async function ensureFinancialExpense(
  description: string,
  values: typeof financialExpenses.$inferInsert,
) {
  const [existing] = await db
    .select({ id: financialExpenses.id })
    .from(financialExpenses)
    .where(
      and(
        eq(financialExpenses.organizationId, values.organizationId),
        eq(financialExpenses.description, description),
        isNull(financialExpenses.deletedAt),
      ),
    )
    .limit(1);

  if (existing) {
    return;
  }

  await db.insert(financialExpenses).values(values);
}

async function ensureProvision(name: string, values: typeof provisions.$inferInsert) {
  const [existing] = await db
    .select({ id: provisions.id })
    .from(provisions)
    .where(
      and(
        eq(provisions.organizationId, values.organizationId),
        eq(provisions.name, name),
        isNull(provisions.deletedAt),
      ),
    )
    .limit(1);

  if (existing) {
    return;
  }

  await db.insert(provisions).values(values);
}

function typedEntries<T extends Record<string, unknown>>(value: T) {
  return Object.entries(value) as {
    [K in keyof T]: [K, T[K]];
  }[keyof T][];
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
