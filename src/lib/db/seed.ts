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
  clientBillingProfiles,
  clients,
  compensationHistory,
  documents,
  employeeBenefits,
  employees,
  files,
  financialEntries,
  financialExpenses,
  invoiceRequestItems,
  invoiceRequests,
  permissions,
  positions,
  provisions,
  reimbursementRequests,
  rolePermissions,
  roles,
  timeOffRequests,
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

  await seedPeopleDemoData(organization.id, adminUser?.id, ownerEmployeeId);
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
) {
  if (!responsibleUserId) {
    return;
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

function typedEntries<T extends Record<string, unknown>>(value: T) {
  return Object.entries(value) as {
    [K in keyof T]: [K, T[K]];
  }[keyof T][];
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
