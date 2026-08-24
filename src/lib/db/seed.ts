import { hashPassword } from "better-auth/crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { createRequire } from "node:module";

import { getOptionalEnv, getRequiredEnv } from "@/lib/env";
import {
  defaultRolePermissions,
  permissionDescriptions,
  roleKeys,
  roleLabels,
  type PermissionKey,
  type RoleKey,
} from "@/lib/rbac";

import { createDatabase } from "./index";
import {
  accounts,
  accessRecords,
  appSettings,
  areas,
  clientBillingProfiles,
  clients,
  compensationHistory,
  documents,
  employeeBenefits,
  employees,
  equipment,
  files,
  financialEntries,
  financialExpenses,
  invoiceRequestItems,
  invoiceRequests,
  lifecycleChecklistItems,
  lifecycleChecklists,
  permissions,
  positions,
  provisions,
  reimbursementRequests,
  rolePermissions,
  roles,
  saasSubscriptionUsers,
  saasSubscriptions,
  timeOffRequests,
  userRoles,
  users,
  organizations,
  vacationBalances,
} from "./schema";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env") as typeof import("@next/env");

loadEnvConfig(process.cwd());

const db = createDatabase(getRequiredEnv("DATABASE_DIRECT_URL"));

const organizationSeed = {
  name: "Formula Group",
  slug: "formula-group",
};

type DemoUserKey = RoleKey | "all_roles";

async function main() {
  await assertAdministrativeSeedCredential();
  const organization = await seedOrganization();
  const roleByKey = await seedRoles();
  const permissionByKey = await seedPermissions();

  await seedRolePermissions(roleByKey, permissionByKey);
  const adminUser = await seedInitialAdmin(organization.id, roleByKey);
  const shouldSeedDemo = shouldSeedDemoData();
  const demoUsers = shouldSeedDemo
    ? await seedRoleTestUsers(organization.id, roleByKey, adminUser?.id)
    : {};
  const seedActorUserId = adminUser?.id ?? demoUsers.all_roles?.id;
  await seedAppSettings(organization.id, seedActorUserId);
  const ownerEmployeeId = adminUser
    ? await seedInitialEmployee(organization.id, adminUser.id)
    : null;

  if (shouldSeedDemo) {
    const leadershipEmployeeId = await seedLeadershipDemoEmployee(
      organization.id,
      demoUsers.leadership?.id,
    );

    const demoEmployeeId = await seedPeopleDemoData(
      organization.id,
      seedActorUserId,
      leadershipEmployeeId ?? ownerEmployeeId,
      demoUsers.employee?.id,
    );
    await seedFinanceClientDemoData(
      organization.id,
      seedActorUserId,
      ownerEmployeeId ?? leadershipEmployeeId,
    );
    await seedGovernanceDemoData(
      organization.id,
      seedActorUserId,
      ownerEmployeeId ?? leadershipEmployeeId,
      demoEmployeeId,
    );
    await seedLifecycleDemoData(organization.id, seedActorUserId, demoEmployeeId);
    await seedCltVacationDemoData(organization.id, seedActorUserId, leadershipEmployeeId ?? ownerEmployeeId);
  }

  console.log("Seed complete:");
  console.log(`- organization: ${organization.name}`);
  console.log(`- roles: ${Object.keys(roleByKey).length}`);
  console.log(`- permissions: ${Object.keys(permissionByKey).length}`);
  console.log(`- admin: ${adminUser?.email ?? "skipped"}`);
  console.log(
    shouldSeedDemo
      ? `- demo users: ${Object.keys(demoUsers).length} (password configured via DEMO_USER_PASSWORD)`
      : "- demo data: skipped (set SEED_DEMO_DATA=true to enable)",
  );
}

async function assertAdministrativeSeedCredential() {
  const result = await db.execute<{
    currentUser: string;
    isSuperuser: boolean;
    bypassesRls: boolean;
  }>(sql`
    select
      current_user as "currentUser",
      rolsuper as "isSuperuser",
      rolbypassrls as "bypassesRls"
    from pg_roles
    where rolname = current_user
  `);
  const credential = result.rows[0];

  if (!credential || (!credential.bypassesRls && !credential.isSuperuser)) {
    throw new Error(
      "DATABASE_DIRECT_URL must use the controlled migration/seed role with BYPASSRLS (preferred) or, only when unavoidable, SUPERUSER. The runtime DATABASE_URL role must not be used for seed.",
    );
  }
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
      accessStatus: "active",
      isActive: true,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        organizationId,
        name,
        emailVerified: true,
        accessStatus: "active",
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

async function seedRoleTestUsers(
  organizationId: string,
  roleByKey: Record<RoleKey, typeof roles.$inferSelect>,
  assignedByUserId?: string,
) {
  const fixtures: {
    key: DemoUserKey;
    id: string;
    email: string;
    name: string;
    roles: readonly RoleKey[];
  }[] = [
    {
      key: "all_roles",
      id: "demo-all-roles",
      email: "todos.perfis@formula.local",
      name: "Todos Perfis Demo",
      roles: roleKeys,
    },
    {
      key: "technical_admin",
      id: "demo-technical-admin",
      email: "admin.tecnico@formula.local",
      name: "Admin Tecnico Demo",
      roles: ["technical_admin"],
    },
    {
      key: "director",
      id: "demo-director",
      email: "diretoria@formula.local",
      name: "Diretoria Demo",
      roles: ["director"],
    },
    {
      key: "finance",
      id: "demo-finance",
      email: "financeiro@formula.local",
      name: "Financeiro Demo",
      roles: ["finance"],
    },
    {
      key: "hr_admin",
      id: "demo-hr-admin",
      email: "rh@formula.local",
      name: "RH Demo",
      roles: ["hr_admin"],
    },
    {
      key: "it_governance",
      id: "demo-it-governance",
      email: "ti@formula.local",
      name: "TI Governanca Demo",
      roles: ["it_governance"],
    },
    {
      key: "leadership",
      id: "demo-leadership",
      email: "lideranca@formula.local",
      name: "Lideranca Demo",
      roles: ["leadership"],
    },
    {
      key: "employee",
      id: "demo-employee",
      email: "pj.exemplo@formula.local",
      name: "Colaborador PJ Exemplo",
      roles: ["employee"],
    },
  ];
  const passwordHash = await hashPassword(getDemoUserPassword());
  const usersByKey: Partial<Record<DemoUserKey, typeof users.$inferSelect>> = {};

  for (const fixture of fixtures) {
    const [user] = await db
      .insert(users)
      .values({
        id: fixture.id,
        organizationId,
        name: fixture.name,
        email: fixture.email,
        emailVerified: true,
        accessStatus: "active",
        isActive: true,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          organizationId,
          name: fixture.name,
          emailVerified: true,
          accessStatus: "active",
          isActive: true,
          updatedAt: new Date(),
        },
      })
      .returning();

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
        fixture.roles.map((roleKey) => ({
          userId: user.id,
          roleId: roleByKey[roleKey].id,
          assignedByUserId: assignedByUserId ?? user.id,
        })),
      )
      .onConflictDoNothing();

    usersByKey[fixture.key] = user;
  }

  return usersByKey;
}

async function seedAppSettings(organizationId: string, updatedByUserId?: string) {
  await ensureAppSetting("storage", {
    organizationId,
    key: "storage",
    value: {
      localPath: getOptionalEnv("LOCAL_UPLOAD_DIR") ?? "uploads",
      provider: hasR2Config() ? "r2" : "local",
      r2Bucket: getOptionalEnv("STORAGE_BUCKET") ?? null,
      r2Region: getOptionalEnv("STORAGE_REGION") ?? "auto",
    },
    description: "Provedor de armazenamento de documentos e anexos.",
    updatedByUserId,
  });
  await ensureAppSetting("upload_max_bytes", {
    organizationId,
    key: "upload_max_bytes",
    value: {
      bytes: Number(getOptionalEnv("UPLOAD_MAX_BYTES") ?? 10_485_760),
    },
    description: "Limite maximo de bytes por upload.",
    updatedByUserId,
  });
  await ensureAppSetting("allowed_email_domain", {
    organizationId,
    key: "allowed_email_domain",
    value: {
      domain: getOptionalEnv("ALLOWED_EMAIL_DOMAIN") ?? null,
    },
    description: "Dominio permitido para login corporativo.",
    updatedByUserId,
  });
}

function hasR2Config() {
  return Boolean(
    getOptionalEnv("STORAGE_BUCKET") &&
      getOptionalEnv("STORAGE_ACCESS_KEY_ID") &&
      getOptionalEnv("STORAGE_SECRET_ACCESS_KEY"),
  );
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

async function seedLeadershipDemoEmployee(
  organizationId: string,
  userId?: string | null,
) {
  if (!userId) {
    return null;
  }

  const [area] = await db
    .insert(areas)
    .values({
      organizationId,
      name: "Operacoes",
    })
    .onConflictDoUpdate({
      target: [areas.organizationId, areas.name],
      set: {
        name: "Operacoes",
      },
    })
    .returning();
  const [position] = await db
    .insert(positions)
    .values({
      organizationId,
      name: "Lider de Operacoes",
    })
    .onConflictDoUpdate({
      target: [positions.organizationId, positions.name],
      set: {
        name: "Lider de Operacoes",
      },
    })
    .returning();
  const [employee] = await db
    .insert(employees)
    .values({
      organizationId,
      userId,
      registrationNumber: "FG-00003",
      fullName: "Lideranca Demo",
      corporateEmail: "lideranca@formula.local",
      positionId: position.id,
      areaId: area.id,
      employmentType: "clt",
      startDate: "2026-05-01",
      status: "active",
      workModel: "Hibrido",
      location: "Sao Paulo",
      currentCompensation: "9000.00",
    })
    .onConflictDoUpdate({
      target: [employees.organizationId, employees.registrationNumber],
      set: {
        userId,
        fullName: "Lideranca Demo",
        corporateEmail: "lideranca@formula.local",
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
  await upsertClientBillingProfile({
    organizationId,
    clientId: activeClient.id,
    monthlyFee: "8500.00",
    billingDay: 10,
    paymentMethod: "Pix",
    paymentTermsDays: 0,
    recurrence: "monthly",
    autoGenerateEntries: true,
    financialContactName: "Financeiro Cliente",
    financialEmail: "financeiro@cliente.local",
    financialPhone: "+55 11 99999-0000",
    billingOwnerEmployeeId: ownerEmployeeId ?? null,
    reminderBeforeDays: 3,
    reminderAfterDays: 1,
    notes: "Cliente de exemplo para cobranca recorrente.",
  });

  const [pausedClient] = await upsertClient({
    organizationId,
    code: "CLI-00002",
    name: "Cliente Exemplo Pausado",
    status: "paused",
    monthlyFee: "4200.00",
    billingDay: 20,
    internalOwnerEmployeeId: ownerEmployeeId ?? null,
  });
  await upsertClientBillingProfile({
    organizationId,
    clientId: pausedClient.id,
    monthlyFee: "4200.00",
    billingDay: 20,
    paymentMethod: "Boleto",
    paymentTermsDays: 5,
    recurrence: "monthly",
    autoGenerateEntries: false,
    billingOwnerEmployeeId: ownerEmployeeId ?? null,
    reminderBeforeDays: 5,
    reminderAfterDays: 2,
  });

  await ensureFinancialEntry("Fee maio - Cliente Exemplo Ativo", {
    organizationId,
    clientId: activeClient.id,
    description: "Fee maio - Cliente Exemplo Ativo",
    amount: "8500.00",
    receivedAmount: "8500.00",
    dueDate: "2026-05-10",
    receivedDate: "2026-05-10",
    paymentMethod: "Pix",
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
    paymentMethod: "Pix",
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

async function seedPeopleDemoData(
  organizationId: string,
  responsibleUserId?: string,
  managerEmployeeId?: string | null,
  employeeUserId?: string | null,
) {
  if (!responsibleUserId) {
    return null;
  }

  const [area] = await db
    .insert(areas)
    .values({
      organizationId,
      name: "Operacoes",
    })
    .onConflictDoUpdate({
      target: [areas.organizationId, areas.name],
      set: {
        name: "Operacoes",
      },
    })
    .returning();
  const [position] = await db
    .insert(positions)
    .values({
      organizationId,
      name: "Analista de Operacoes",
    })
    .onConflictDoUpdate({
      target: [positions.organizationId, positions.name],
      set: {
        name: "Analista de Operacoes",
      },
    })
    .returning();
  const [employee] = await db
    .insert(employees)
    .values({
      organizationId,
      userId: employeeUserId ?? null,
      registrationNumber: "FG-00002",
      fullName: "Colaborador PJ Exemplo",
      corporateEmail: "pj.exemplo@formula.local",
      positionId: position.id,
      areaId: area.id,
      managerEmployeeId: managerEmployeeId ?? null,
      employmentType: "pj",
      startDate: "2026-05-01",
      status: "active",
      workModel: "Remoto",
      location: "Sao Paulo",
      currentCompensation: "6500.00",
      recurringCostAllowance: "450.00",
      recurringTransport: "0.00",
    })
    .onConflictDoUpdate({
      target: [employees.organizationId, employees.registrationNumber],
      set: {
        userId: employeeUserId ?? null,
        fullName: "Colaborador PJ Exemplo",
        corporateEmail: "pj.exemplo@formula.local",
        positionId: position.id,
        areaId: area.id,
        managerEmployeeId: managerEmployeeId ?? null,
        employmentType: "pj",
        status: "active",
        currentCompensation: "6500.00",
        recurringCostAllowance: "450.00",
        recurringTransport: "0.00",
        updatedAt: new Date(),
      },
    })
    .returning();

  await ensureCompensationHistory(employee.id, {
    organizationId,
    employeeId: employee.id,
    previousAmount: "6000.00",
    newAmount: "6500.00",
    differenceAmount: "500.00",
    effectiveDate: "2026-05-01",
    reason: "Ajuste inicial de demonstracao",
    approvedByUserId: responsibleUserId,
    createdByUserId: responsibleUserId,
  });
  await ensureEmployeeBenefit(employee.id, "Ajuda de custo internet", {
    organizationId,
    employeeId: employee.id,
    benefitType: "ajuda_custo",
    name: "Ajuda de custo internet",
    amount: "150.00",
    recurring: true,
    startDate: "2026-05-01",
    status: "active",
    createdByUserId: responsibleUserId,
  });
  await ensureInvoiceRequest(employee.id, {
    organizationId,
    employeeId: employee.id,
    competence: "2026-05",
    dueDate: "2026-05-25",
    expectedAmount: "6950.00",
    suggestedDescription:
      "Prestacao de servicos de Analista de Operacoes/Operacoes referente a competencia de 05/2026, incluindo remuneracao contratada, ajuda de custo e transporte.",
    status: "published",
    createdByUserId: responsibleUserId,
  });
  await ensureReimbursementRequest(employee.id, "Internet home office", {
    organizationId,
    employeeId: employee.id,
    title: "Internet home office",
    category: "Internet/home office",
    amount: "120.00",
    expenseDate: "2026-05-12",
    status: "submitted",
    notes: "Reembolso de demonstracao.",
  });
  await ensureTimeOffRequest(employee.id, "2026-06-03", "2026-06-05", {
    organizationId,
    employeeId: employee.id,
    type: "planned_pause",
    startDate: "2026-06-03",
    endDate: "2026-06-05",
    businessDays: 3,
    status: "requested",
    requestedByUserId: responsibleUserId,
    notes: "Pausa programada de demonstracao.",
  });
  await ensureDocument(
    {
      organizationId,
      ownerType: "employee",
      ownerId: employee.id,
      documentType: "contract",
      visibility: "employee_visible",
      version: 1,
      status: "active",
      uploadedByUserId: responsibleUserId,
    },
    {
      organizationId,
      ownerEmployeeId: employee.id,
      storageProvider: getOptionalEnv("STORAGE_PROVIDER") ?? "metadata",
      bucket: getOptionalEnv("STORAGE_BUCKET") ?? "seed",
      storageKey: `seed/documents/${employee.registrationNumber}/contrato-pj-exemplo.pdf`,
      originalName: "contrato-pj-exemplo.pdf",
      mimeType: "application/pdf",
      extension: "pdf",
      byteSize: 245760,
      sensitivity: "restricted",
      uploadedByUserId: responsibleUserId,
    },
  );

  return employee.id;
}

async function seedCltVacationDemoData(
  organizationId: string,
  responsibleUserId?: string,
  managerEmployeeId?: string | null,
) {
  if (!responsibleUserId) {
    return null;
  }

  const [area] = await db
    .insert(areas)
    .values({ organizationId, name: "Estrategia" })
    .onConflictDoUpdate({
      target: [areas.organizationId, areas.name],
      set: { name: "Estrategia" },
    })
    .returning();
  const [position] = await db
    .insert(positions)
    .values({ organizationId, name: "Coordenador" })
    .onConflictDoUpdate({
      target: [positions.organizationId, positions.name],
      set: { name: "Coordenador" },
    })
    .returning();
  const employmentStartDate = "2024-04-01";
  const [employee] = await db
    .insert(employees)
    .values({
      organizationId,
      registrationNumber: "FG-00003",
      fullName: "Colaborador CLT Exemplo",
      corporateEmail: "clt.exemplo@formula.local",
      positionId: position.id,
      areaId: area.id,
      managerEmployeeId: managerEmployeeId ?? null,
      employmentType: "clt",
      startDate: employmentStartDate,
      status: "active",
      workModel: "Hibrido",
      location: "Sao Paulo",
      currentCompensation: "8500.00",
      recurringCostAllowance: "0.00",
      recurringTransport: "0.00",
    })
    .onConflictDoUpdate({
      target: [employees.organizationId, employees.registrationNumber],
      set: {
        fullName: "Colaborador CLT Exemplo",
        corporateEmail: "clt.exemplo@formula.local",
        positionId: position.id,
        areaId: area.id,
        managerEmployeeId: managerEmployeeId ?? null,
        employmentType: "clt",
        status: "active",
        updatedAt: new Date(),
      },
    })
    .returning();

  await ensureVacationBalance(employee.id, "2024-04-01", {
    organizationId,
    employeeId: employee.id,
    periodStart: "2024-04-01",
    periodEnd: "2025-03-31",
    concessionDeadline: "2026-03-31",
    daysAcquired: 30,
    daysSold: 0,
    status: "active",
    notes: "Primeiro periodo aquisitivo (demonstracao).",
    createdByUserId: responsibleUserId,
  });

  return employee.id;
}

async function seedGovernanceDemoData(
  organizationId: string,
  responsibleUserId?: string,
  ownerEmployeeId?: string | null,
  demoEmployeeId?: string | null,
) {
  const linkedEmployeeId = demoEmployeeId ?? ownerEmployeeId;

  if (!responsibleUserId || !linkedEmployeeId) {
    return;
  }

  await ensureEquipment("EQ-00001", {
    organizationId,
    assetNumber: "EQ-00001",
    type: "Notebook",
    brand: "Dell",
    model: "Latitude",
    serialNumber: "DEMO-NOTE-001",
    status: "in_use",
    currentEmployeeId: linkedEmployeeId,
    notes: "Equipamento de demonstracao vinculado ao colaborador.",
  });
  await ensureEquipment("EQ-00002", {
    organizationId,
    assetNumber: "EQ-00002",
    type: "Monitor",
    brand: "LG",
    model: "UltraWide",
    serialNumber: "DEMO-MON-002",
    status: "available",
    currentEmployeeId: null,
    notes: "Equipamento disponivel para nova atribuicao.",
  });
  await ensureAccessRecord(linkedEmployeeId, "Google Workspace", {
    organizationId,
    employeeId: linkedEmployeeId,
    platform: "Google Workspace",
    accountIdentifier: "pj.exemplo@formula.local",
    accessLevel: "Usuario padrao",
    critical: true,
    status: "active",
    reviewDueDate: "2026-05-20",
    responsibleUserId,
    notes: "Acesso critico de demonstracao com revisao proxima.",
  });
  await ensureAccessRecord(linkedEmployeeId, "Figma", {
    organizationId,
    employeeId: linkedEmployeeId,
    platform: "Figma",
    accountIdentifier: "pj.exemplo@formula.local",
    accessLevel: "Editor",
    critical: false,
    status: "active",
    responsibleUserId,
    notes: "Acesso operacional de demonstracao.",
  });

  const subscription = await ensureSaasSubscription("Google Workspace", {
    organizationId,
    name: "Google Workspace",
    category: "Produtividade",
    provider: "Google",
    monthlyCost: "1200.00",
    renewalDate: "2026-06-01",
    status: "active",
    responsibleUserId,
    notes: "Assinatura recorrente de demonstracao.",
  });

  await ensureSaasSubscriptionUser(subscription.id, linkedEmployeeId);
}

async function seedLifecycleDemoData(
  organizationId: string,
  responsibleUserId?: string,
  demoEmployeeId?: string | null,
) {
  if (!responsibleUserId || !demoEmployeeId) {
    return;
  }

  await ensureLifecycleChecklist(
    {
      organizationId,
      employeeId: demoEmployeeId,
      type: "offboarding",
      status: "open",
      dueDate: "2026-06-10",
      createdByUserId: responsibleUserId,
      notes: "Checklist de desligamento de demonstracao.",
    },
    [
      { key: "final_date", title: "Data final definida", required: true, status: "done" },
      { key: "reason_registered", title: "Motivo registrado", required: true, status: "done" },
      {
        key: "finance_reviewed",
        title: "Pendencias financeiras revisadas",
        required: true,
        status: "pending",
      },
      {
        key: "equipment_returned",
        title: "Equipamentos devolvidos",
        required: true,
        status: "pending",
      },
      { key: "accesses_removed", title: "Acessos removidos", required: true, status: "pending" },
      { key: "saas_reviewed", title: "SaaS/licencas revisados", required: true, status: "pending" },
      {
        key: "offboarding_completed",
        title: "Desligamento concluido",
        required: true,
        status: "pending",
      },
    ].map((item, index) => ({
      ...item,
      responsibleUserId,
      dueDate: "2026-06-10",
      sortOrder: index,
    })),
  );
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

async function upsertClientBillingProfile(values: typeof clientBillingProfiles.$inferInsert) {
  return db
    .insert(clientBillingProfiles)
    .values(values)
    .onConflictDoUpdate({
      target: clientBillingProfiles.clientId,
      set: {
        monthlyFee: values.monthlyFee,
        billingDay: values.billingDay,
        paymentMethod: values.paymentMethod,
        paymentTermsDays: values.paymentTermsDays ?? 0,
        recurrence: values.recurrence ?? "monthly",
        autoGenerateEntries: values.autoGenerateEntries ?? false,
        financialContactName: values.financialContactName,
        financialEmail: values.financialEmail,
        financialPhone: values.financialPhone,
        billingOwnerEmployeeId: values.billingOwnerEmployeeId,
        reminderBeforeDays: values.reminderBeforeDays ?? 3,
        reminderAfterDays: values.reminderAfterDays ?? 1,
        notes: values.notes,
        deletedAt: null,
        updatedAt: new Date(),
      },
    })
    .returning();
}

async function ensureCompensationHistory(
  employeeId: string,
  values: typeof compensationHistory.$inferInsert,
) {
  const [existing] = await db
    .select({ id: compensationHistory.id })
    .from(compensationHistory)
    .where(
      and(
        eq(compensationHistory.employeeId, employeeId),
        eq(compensationHistory.effectiveDate, values.effectiveDate),
        eq(compensationHistory.reason, values.reason),
      ),
    )
    .limit(1);

  if (existing) {
    return;
  }

  await db.insert(compensationHistory).values(values);
}

async function ensureEmployeeBenefit(
  employeeId: string,
  name: string,
  values: typeof employeeBenefits.$inferInsert,
) {
  const [existing] = await db
    .select({ id: employeeBenefits.id })
    .from(employeeBenefits)
    .where(
      and(
        eq(employeeBenefits.employeeId, employeeId),
        eq(employeeBenefits.name, name),
        isNull(employeeBenefits.deletedAt),
      ),
    )
    .limit(1);

  if (existing) {
    return;
  }

  await db.insert(employeeBenefits).values(values);
}

async function ensureInvoiceRequest(
  employeeId: string,
  values: typeof invoiceRequests.$inferInsert,
) {
  const [existing] = await db
    .select({ id: invoiceRequests.id })
    .from(invoiceRequests)
    .where(
      and(
        eq(invoiceRequests.employeeId, employeeId),
        eq(invoiceRequests.competence, values.competence),
        isNull(invoiceRequests.deletedAt),
      ),
    )
    .limit(1);

  if (existing) {
    return;
  }

  const [invoice] = await db.insert(invoiceRequests).values(values).returning();

  await db.insert(invoiceRequestItems).values([
    {
      invoiceRequestId: invoice.id,
      label: "Remuneracao base",
      amount: "6500.00",
      kind: "base",
      sortOrder: 0,
    },
    {
      invoiceRequestId: invoice.id,
      label: "Ajuda de custo",
      amount: "450.00",
      kind: "allowance",
      sortOrder: 1,
    },
  ]);
}

async function ensureReimbursementRequest(
  employeeId: string,
  title: string,
  values: typeof reimbursementRequests.$inferInsert,
) {
  const [existing] = await db
    .select({ id: reimbursementRequests.id })
    .from(reimbursementRequests)
    .where(
      and(
        eq(reimbursementRequests.employeeId, employeeId),
        eq(reimbursementRequests.title, title),
      ),
    )
    .limit(1);

  if (existing) {
    return;
  }

  await db.insert(reimbursementRequests).values(values);
}

async function ensureVacationBalance(
  employeeId: string,
  periodStart: string,
  values: typeof vacationBalances.$inferInsert,
) {
  const [existing] = await db
    .select({ id: vacationBalances.id })
    .from(vacationBalances)
    .where(
      and(
        eq(vacationBalances.employeeId, employeeId),
        eq(vacationBalances.periodStart, periodStart),
      ),
    )
    .limit(1);

  if (existing) {
    return;
  }

  await db.insert(vacationBalances).values(values);
}

async function ensureTimeOffRequest(
  employeeId: string,
  startDate: string,
  endDate: string,
  values: typeof timeOffRequests.$inferInsert,
) {
  const [existing] = await db
    .select({ id: timeOffRequests.id })
    .from(timeOffRequests)
    .where(
      and(
        eq(timeOffRequests.employeeId, employeeId),
        eq(timeOffRequests.startDate, startDate),
        eq(timeOffRequests.endDate, endDate),
      ),
    )
    .limit(1);

  if (existing) {
    return;
  }

  await db.insert(timeOffRequests).values(values);
}

async function ensureDocument(
  values: Omit<typeof documents.$inferInsert, "fileId">,
  fileValues: typeof files.$inferInsert,
) {
  const [existing] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(
        eq(documents.organizationId, values.organizationId),
        eq(documents.ownerType, values.ownerType),
        eq(documents.ownerId, values.ownerId),
        eq(documents.documentType, values.documentType),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(documents)
      .set({
        deletedAt: null,
        status: values.status ?? "active",
        updatedAt: new Date(),
        visibility: values.visibility ?? "restricted",
      })
      .where(eq(documents.id, existing.id));
    return;
  }

  const file = await ensureFile(fileValues.storageProvider, fileValues.storageKey, fileValues);

  await db.insert(documents).values({
    ...values,
    fileId: file.id,
  });
}

async function ensureEquipment(
  assetNumber: string,
  values: typeof equipment.$inferInsert,
) {
  const [existing] = await db
    .select({ id: equipment.id })
    .from(equipment)
    .where(
      and(
        eq(equipment.organizationId, values.organizationId),
        eq(equipment.assetNumber, assetNumber),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(equipment)
      .set({
        brand: values.brand,
        currentEmployeeId: values.currentEmployeeId,
        deletedAt: null,
        model: values.model,
        notes: values.notes,
        serialNumber: values.serialNumber,
        status: values.status ?? "available",
        type: values.type,
        updatedAt: new Date(),
      })
      .where(eq(equipment.id, existing.id));
    return;
  }

  await db.insert(equipment).values(values);
}

async function ensureAccessRecord(
  employeeId: string,
  platform: string,
  values: typeof accessRecords.$inferInsert,
) {
  const [existing] = await db
    .select({ id: accessRecords.id })
    .from(accessRecords)
    .where(and(eq(accessRecords.employeeId, employeeId), eq(accessRecords.platform, platform)))
    .limit(1);

  if (existing) {
    await db
      .update(accessRecords)
      .set({
        accessLevel: values.accessLevel,
        accountIdentifier: values.accountIdentifier,
        critical: values.critical ?? false,
        notes: values.notes,
        removedAt: values.removedAt,
        responsibleUserId: values.responsibleUserId,
        reviewDueDate: values.reviewDueDate,
        status: values.status ?? "active",
        updatedAt: new Date(),
      })
      .where(eq(accessRecords.id, existing.id));
    return;
  }

  await db.insert(accessRecords).values(values);
}

async function ensureSaasSubscription(
  name: string,
  values: typeof saasSubscriptions.$inferInsert,
) {
  const [existing] = await db
    .select()
    .from(saasSubscriptions)
    .where(
      and(
        eq(saasSubscriptions.organizationId, values.organizationId),
        eq(saasSubscriptions.name, name),
      ),
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(saasSubscriptions)
      .set({
        category: values.category,
        deletedAt: null,
        monthlyCost: values.monthlyCost,
        notes: values.notes,
        provider: values.provider,
        renewalDate: values.renewalDate,
        responsibleUserId: values.responsibleUserId,
        status: values.status ?? "active",
        updatedAt: new Date(),
      })
      .where(eq(saasSubscriptions.id, existing.id))
      .returning();

    return updated;
  }

  const [created] = await db.insert(saasSubscriptions).values(values).returning();

  return created;
}

async function ensureSaasSubscriptionUser(subscriptionId: string, employeeId: string) {
  const [existing] = await db
    .select()
    .from(saasSubscriptionUsers)
    .where(
      and(
        eq(saasSubscriptionUsers.subscriptionId, subscriptionId),
        eq(saasSubscriptionUsers.employeeId, employeeId),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(saasSubscriptionUsers)
      .set({
        status: "active",
        unlinkedAt: null,
      })
      .where(
        and(
          eq(saasSubscriptionUsers.subscriptionId, subscriptionId),
          eq(saasSubscriptionUsers.employeeId, employeeId),
        ),
      );
    return;
  }

  await db.insert(saasSubscriptionUsers).values({
    subscriptionId,
    employeeId,
    status: "active",
  });
}

async function ensureLifecycleChecklist(
  values: typeof lifecycleChecklists.$inferInsert,
  items: (Omit<typeof lifecycleChecklistItems.$inferInsert, "checklistId"> & {
    key: string;
  })[],
) {
  const [existing] = await db
    .select()
    .from(lifecycleChecklists)
    .where(
      and(
        eq(lifecycleChecklists.organizationId, values.organizationId),
        eq(lifecycleChecklists.employeeId, values.employeeId),
        eq(lifecycleChecklists.type, values.type),
        eq(lifecycleChecklists.status, values.status ?? "open"),
        isNull(lifecycleChecklists.deletedAt),
      ),
    )
    .limit(1);
  const checklist =
    existing ??
    (
      await db
        .insert(lifecycleChecklists)
        .values(values)
        .returning()
    )[0];

  if (existing) {
    await db
      .update(lifecycleChecklists)
      .set({
        dueDate: values.dueDate,
        notes: values.notes,
        updatedAt: new Date(),
      })
      .where(eq(lifecycleChecklists.id, checklist.id));
  }

  for (const item of items) {
    await db
      .insert(lifecycleChecklistItems)
      .values({
        ...item,
        checklistId: checklist.id,
      })
      .onConflictDoUpdate({
        target: [lifecycleChecklistItems.checklistId, lifecycleChecklistItems.key],
        set: {
          dueDate: item.dueDate,
          notes: item.notes,
          required: item.required ?? true,
          responsibleUserId: item.responsibleUserId,
          sortOrder: item.sortOrder ?? 0,
          status: item.status ?? "pending",
          title: item.title,
          updatedAt: new Date(),
        },
      });
  }
}

async function ensureFile(
  storageProvider: string,
  storageKey: string,
  values: typeof files.$inferInsert,
) {
  const [existing] = await db
    .select()
    .from(files)
    .where(and(eq(files.storageProvider, storageProvider), eq(files.storageKey, storageKey)))
    .limit(1);

  if (existing) {
    return existing;
  }

  const [file] = await db.insert(files).values(values).returning();

  return file;
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

async function ensureAppSetting(key: string, values: typeof appSettings.$inferInsert) {
  await db
    .insert(appSettings)
    .values(values)
    .onConflictDoUpdate({
      target: [appSettings.organizationId, appSettings.key],
      set: {
        description: values.description,
        updatedAt: new Date(),
        updatedByUserId: values.updatedByUserId,
        value: values.value,
      },
    });
}

function typedEntries<T extends Record<string, unknown>>(value: T) {
  return Object.entries(value) as {
    [K in keyof T]: [K, T[K]];
  }[keyof T][];
}

function getDemoUserPassword() {
  const password = getOptionalEnv("DEMO_USER_PASSWORD");
  if (!password) {
    throw new Error("DEMO_USER_PASSWORD is required when SEED_DEMO_DATA=true");
  }
  return password;
}

function shouldSeedDemoData() {
  return getOptionalEnv("SEED_DEMO_DATA") === "true";
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
