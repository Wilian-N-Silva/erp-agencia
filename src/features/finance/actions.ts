"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  clients,
  costCenters,
  financialCategories,
  financialEntries,
  financialExpenses,
  provisions,
  suppliers,
} from "@/lib/db/schema";
import { bindCurrentTenantContext, getCurrentAccessContext } from "@/lib/dal";
import {
  enforceAuthenticatedRateLimit,
  withRateLimitActionResult,
} from "@/lib/rate-limit";
import { AccessDeniedError, assertCan } from "@/lib/rbac";
import { formDataToObject, isoDateSchema, isoMonthSchema } from "@/lib/validation";

import {
  buildFinancialExpenseUpdateValues,
  normalizeMoneyInput,
  toDateKey,
  type FinancialExpenseMasterDataUpdate,
} from "./rules";

const dateSchema = isoDateSchema;
const competenceSchema = isoMonthSchema;
const optionalTextSchema = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .optional()
    .transform((value) => value || null);
const optionalIdSchema = () =>
  z
    .string()
    .trim()
    .optional()
    .transform((value) => value || null)
    .refine((value) => value === null || z.string().uuid().safeParse(value).success, {
      message: "Invalid id.",
    });

const createEntrySchema = z.strictObject({
  clientId: optionalIdSchema(),
  description: z.string().trim().min(1).max(180),
  amount: z.string().trim().min(1).transform(normalizeMoneyInput),
  dueDate: dateSchema,
  paymentMethod: optionalTextSchema(80),
  competence: competenceSchema,
  recurring: z
    .string()
    .optional()
    .transform((value) => value === "on"),
  notes: optionalTextSchema(1000),
});

const updateEntrySchema = createEntrySchema.extend({
  id: z.string().uuid(),
});

const createExpenseSchema = z.strictObject({
  supplierId: z.string().uuid(),
  categoryId: z.string().uuid(),
  costCenterId: optionalIdSchema(),
  subcategory: optionalTextSchema(80),
  description: z.string().trim().min(1).max(180),
  amount: z.string().trim().min(1).transform(normalizeMoneyInput),
  dueDate: dateSchema,
  competence: competenceSchema,
  recurring: z
    .string()
    .optional()
    .transform((value) => value === "on"),
  notes: optionalTextSchema(1000),
});

const updateExpenseSchema = createExpenseSchema.extend({
  id: z.string().uuid(),
  supplierId: optionalIdSchema(),
  categoryId: optionalIdSchema(),
});

const createProvisionSchema = z.strictObject({
  name: z.string().trim().min(1).max(160),
  category: z.string().trim().min(1).max(80),
  estimatedMonthlyAmount: z.string().trim().min(1).transform(normalizeMoneyInput),
  expectedDay: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? Number(value) : null))
    .refine((value) => value === null || (Number.isInteger(value) && value >= 1 && value <= 31), {
      message: "Invalid expected day.",
    }),
  recurring: z
    .string()
    .optional()
    .transform((value) => value === "on"),
  notes: optionalTextSchema(1000),
});

const idSchema = z.strictObject({
  id: z.string().uuid(),
});

async function createFinancialEntryAction(formData: FormData) {
  const { context, organizationId } = await requireFinanceWriterContext();
  const input = createEntrySchema.parse(formDataToObject(formData));
  const clientId = await resolveClientId(input.clientId, organizationId);

  const [entry] = await db
    .insert(financialEntries)
    .values({
      organizationId,
      clientId,
      description: input.description,
      amount: input.amount,
      dueDate: input.dueDate,
      paymentMethod: input.paymentMethod,
      competence: input.competence,
      recurring: input.recurring,
      notes: input.notes,
      responsibleUserId: context.userId,
    })
    .returning();

  await writeAuditLog(context, {
    action: "create",
    entityType: "financial_entry",
    entityId: entry.id,
    after: entry,
  });

  revalidatePath("/app/financeiro");
}

async function updateFinancialEntryAction(formData: FormData) {
  const { context, organizationId } = await requireFinanceWriterContext();
  const input = updateEntrySchema.parse(formDataToObject(formData));
  const before = await getEntryForWrite(input.id, organizationId);
  const clientId = await resolveClientId(input.clientId, organizationId);

  const [after] = await db
    .update(financialEntries)
    .set({
      clientId,
      description: input.description,
      amount: input.amount,
      dueDate: input.dueDate,
      paymentMethod: input.paymentMethod,
      competence: input.competence,
      recurring: input.recurring,
      notes: input.notes,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(financialEntries.id, input.id),
        eq(financialEntries.organizationId, organizationId),
        isNull(financialEntries.deletedAt),
      ),
    )
    .returning();

  await writeAuditLog(context, {
    action: "update",
    entityType: "financial_entry",
    entityId: input.id,
    before,
    after,
  });

  revalidatePath("/app/financeiro");
}

async function markFinancialEntryReceivedAction(formData: FormData) {
  const { context, organizationId } = await requireFinanceWriterContext();
  await enforceAuthenticatedRateLimit("reconciliation", context);
  const input = idSchema.parse(formDataToObject(formData));
  const before = await getEntryForWrite(input.id, organizationId);

  if (before.status === "cancelled") {
    throw new Error("Cancelled entries cannot be received.");
  }

  const [after] = await db
    .update(financialEntries)
    .set({
      receivedAmount: before.amount,
      receivedDate: toDateKey(new Date()),
      status: "received",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(financialEntries.id, input.id),
        eq(financialEntries.organizationId, organizationId),
        isNull(financialEntries.deletedAt),
      ),
    )
    .returning();

  await writeAuditLog(context, {
    action: "status_change",
    entityType: "financial_entry",
    entityId: input.id,
    before,
    after,
    metadata: {
      status: "received",
    },
  });

  revalidatePath("/app/financeiro");
  if (before.clientId) {
    revalidatePath("/app");
    revalidatePath(`/app/clientes/${before.clientId}`);
  }
}

async function cancelFinancialEntryAction(formData: FormData) {
  const { context, organizationId } = await requireFinanceWriterContext();
  await enforceAuthenticatedRateLimit("reconciliation", context);
  const input = idSchema.parse(formDataToObject(formData));
  const before = await getEntryForWrite(input.id, organizationId);

  const [after] = await db
    .update(financialEntries)
    .set({
      status: "cancelled",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(financialEntries.id, input.id),
        eq(financialEntries.organizationId, organizationId),
        isNull(financialEntries.deletedAt),
      ),
    )
    .returning();

  await writeAuditLog(context, {
    action: "status_change",
    entityType: "financial_entry",
    entityId: input.id,
    before,
    after,
    metadata: {
      status: "cancelled",
    },
  });

  revalidatePath("/app/financeiro");
}

async function createFinancialExpenseAction(formData: FormData) {
  const { context, organizationId } = await requireFinanceWriterContext();
  const input = createExpenseSchema.parse(formDataToObject(formData));
  const masterData = await resolveExpenseMasterData(input, organizationId);

  const [expense] = await db
    .insert(financialExpenses)
    .values({
      organizationId,
      supplierId: masterData.supplier!.id,
      supplier: masterData.supplier!.name,
      categoryId: masterData.category!.id,
      category: masterData.category!.name,
      costCenterId: masterData.costCenter?.id ?? null,
      subcategory: input.subcategory,
      description: input.description,
      amount: input.amount,
      dueDate: input.dueDate,
      competence: input.competence,
      costCenter: masterData.costCenter?.name ?? null,
      recurring: input.recurring,
      notes: input.notes,
      responsibleUserId: context.userId,
    })
    .returning();

  await writeAuditLog(context, {
    action: "create",
    entityType: "financial_expense",
    entityId: expense.id,
    after: expense,
  });

  revalidatePath("/app/financeiro");
}

async function updateFinancialExpenseAction(formData: FormData) {
  const { context, organizationId } = await requireFinanceWriterContext();
  const input = updateExpenseSchema.parse(formDataToObject(formData));
  const before = await getExpenseForWrite(input.id, organizationId);
  const masterData = await resolveExpenseMasterData(input, organizationId, before);

  const [after] = await db
    .update(financialExpenses)
    .set(buildFinancialExpenseUpdateValues(input, masterData))
    .where(
      and(
        eq(financialExpenses.id, input.id),
        eq(financialExpenses.organizationId, organizationId),
        isNull(financialExpenses.deletedAt),
      ),
    )
    .returning();

  await writeAuditLog(context, {
    action: "update",
    entityType: "financial_expense",
    entityId: input.id,
    before,
    after,
  });

  revalidatePath("/app/financeiro");
}

async function markFinancialExpensePaidAction(formData: FormData) {
  const { context, organizationId } = await requireFinanceWriterContext();
  await enforceAuthenticatedRateLimit("reconciliation", context);
  const input = idSchema.parse(formDataToObject(formData));
  const before = await getExpenseForWrite(input.id, organizationId);

  if (before.status === "cancelled") {
    throw new Error("Cancelled expenses cannot be paid.");
  }

  const [after] = await db
    .update(financialExpenses)
    .set({
      paidDate: toDateKey(new Date()),
      status: "paid",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(financialExpenses.id, input.id),
        eq(financialExpenses.organizationId, organizationId),
        isNull(financialExpenses.deletedAt),
      ),
    )
    .returning();

  await writeAuditLog(context, {
    action: "status_change",
    entityType: "financial_expense",
    entityId: input.id,
    before,
    after,
    metadata: {
      status: "paid",
    },
  });

  revalidatePath("/app/financeiro");
}

async function cancelFinancialExpenseAction(formData: FormData) {
  const { context, organizationId } = await requireFinanceWriterContext();
  await enforceAuthenticatedRateLimit("reconciliation", context);
  const input = idSchema.parse(formDataToObject(formData));
  const before = await getExpenseForWrite(input.id, organizationId);

  const [after] = await db
    .update(financialExpenses)
    .set({
      status: "cancelled",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(financialExpenses.id, input.id),
        eq(financialExpenses.organizationId, organizationId),
        isNull(financialExpenses.deletedAt),
      ),
    )
    .returning();

  await writeAuditLog(context, {
    action: "status_change",
    entityType: "financial_expense",
    entityId: input.id,
    before,
    after,
    metadata: {
      status: "cancelled",
    },
  });

  revalidatePath("/app/financeiro");
}

async function createProvisionAction(formData: FormData) {
  const { context, organizationId } = await requireFinanceWriterContext();
  const input = createProvisionSchema.parse(formDataToObject(formData));

  const [provision] = await db
    .insert(provisions)
    .values({
      organizationId,
      name: input.name,
      category: input.category,
      estimatedMonthlyAmount: input.estimatedMonthlyAmount,
      expectedDay: input.expectedDay,
      recurring: input.recurring,
      notes: input.notes,
    })
    .returning();

  await writeAuditLog(context, {
    action: "create",
    entityType: "provision",
    entityId: provision.id,
    after: provision,
  });

  revalidatePath("/app/financeiro");
}

async function deactivateProvisionAction(formData: FormData) {
  const { context, organizationId } = await requireFinanceWriterContext();
  const input = idSchema.parse(formDataToObject(formData));
  const before = await getProvisionForWrite(input.id, organizationId);

  const [after] = await db
    .update(provisions)
    .set({
      status: "inactive",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(provisions.id, input.id),
        eq(provisions.organizationId, organizationId),
        isNull(provisions.deletedAt),
      ),
    )
    .returning();

  await writeAuditLog(context, {
    action: "status_change",
    entityType: "provision",
    entityId: input.id,
    before,
    after,
    metadata: {
      status: "inactive",
    },
  });

  revalidatePath("/app/financeiro");
}

async function requireFinanceWriterContext() {
  const context = await getCurrentAccessContext();

  if (!context) {
    redirect("/login");
  }

  assertCan("finance.write", context);

  if (!context.organizationId) {
    throw new AccessDeniedError();
  }

  return {
    context,
    organizationId: context.organizationId,
  };
}

async function resolveClientId(clientId: string | null, organizationId: string) {
  if (!clientId) {
    return null;
  }

  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.organizationId, organizationId), isNull(clients.deletedAt)))
    .limit(1);

  if (!client) {
    throw new AccessDeniedError();
  }

  return client.id;
}

async function getEntryForWrite(id: string, organizationId: string) {
  const [entry] = await db
    .select()
    .from(financialEntries)
    .where(
      and(
        eq(financialEntries.id, id),
        eq(financialEntries.organizationId, organizationId),
        isNull(financialEntries.deletedAt),
      ),
    )
    .limit(1);

  if (!entry) {
    throw new AccessDeniedError();
  }

  return entry;
}

async function getExpenseForWrite(id: string, organizationId: string) {
  const [expense] = await db
    .select()
    .from(financialExpenses)
    .where(
      and(
        eq(financialExpenses.id, id),
        eq(financialExpenses.organizationId, organizationId),
        isNull(financialExpenses.deletedAt),
      ),
    )
    .limit(1);

  if (!expense) {
    throw new AccessDeniedError();
  }

  return expense;
}

type ResolvedExpenseMasterData = {
  supplier: { id: string; name: string };
  category: { id: string; name: string };
  costCenter: { id: string; name: string } | null;
};

async function resolveExpenseMasterData(
  input: { supplierId: string | null; categoryId: string | null; costCenterId: string | null },
  organizationId: string,
): Promise<ResolvedExpenseMasterData>;
async function resolveExpenseMasterData(
  input: { supplierId: string | null; categoryId: string | null; costCenterId: string | null },
  organizationId: string,
  legacy: typeof financialExpenses.$inferSelect,
): Promise<FinancialExpenseMasterDataUpdate>;
async function resolveExpenseMasterData(
  input: { supplierId: string | null; categoryId: string | null; costCenterId: string | null },
  organizationId: string,
  legacy?: typeof financialExpenses.$inferSelect,
): Promise<ResolvedExpenseMasterData | FinancialExpenseMasterDataUpdate> {
  const [supplier, category, costCenter] = await Promise.all([
    input.supplierId
      ? getMasterDataRow(suppliers, input.supplierId, organizationId, legacy?.supplierId)
      : null,
    input.categoryId
      ? getMasterDataRow(financialCategories, input.categoryId, organizationId, legacy?.categoryId)
      : null,
    input.costCenterId
      ? getMasterDataRow(costCenters, input.costCenterId, organizationId, legacy?.costCenterId)
      : null,
  ]);

  if (!legacy) {
    if (!supplier || !category) throw new AccessDeniedError();
    return { supplier, category, costCenter };
  }

  if ((!supplier && !legacy.supplier) || (!category && !legacy.category)) {
    throw new AccessDeniedError();
  }

  return {
    supplierId: supplier?.id ?? legacy.supplierId,
    ...(supplier && supplier.id !== legacy.supplierId ? { supplier: supplier.name } : {}),
    categoryId: category?.id ?? legacy.categoryId,
    ...(category && category.id !== legacy.categoryId ? { category: category.name } : {}),
    costCenterId: input.costCenterId ? costCenter?.id ?? null : null,
    ...(costCenter && costCenter.id !== legacy.costCenterId
      ? { costCenter: costCenter.name }
      : legacy.costCenterId && !input.costCenterId
        ? { costCenter: null }
        : {}),
  };
}

async function getMasterDataRow(
  table: typeof suppliers | typeof financialCategories | typeof costCenters,
  id: string,
  organizationId: string,
  currentlyLinkedId?: string | null,
) {
  const [row] = await db
    .select({ id: table.id, name: table.name })
    .from(table)
    .where(
      and(
        eq(table.id, id),
        eq(table.organizationId, organizationId),
        currentlyLinkedId === id ? undefined : eq(table.isActive, true),
      ),
    )
    .limit(1);

  if (!row) throw new AccessDeniedError();
  return row;
}

async function getProvisionForWrite(id: string, organizationId: string) {
  const [provision] = await db
    .select()
    .from(provisions)
    .where(
      and(
        eq(provisions.id, id),
        eq(provisions.organizationId, organizationId),
        isNull(provisions.deletedAt),
      ),
    )
    .limit(1);

  if (!provision) {
    throw new AccessDeniedError();
  }

  return provision;
}

export {
  tenantCreateFinancialEntryAction as createFinancialEntryAction,
  tenantUpdateFinancialEntryAction as updateFinancialEntryAction,
  tenantMarkFinancialEntryReceivedAction as markFinancialEntryReceivedAction,
  tenantCancelFinancialEntryAction as cancelFinancialEntryAction,
  tenantCreateFinancialExpenseAction as createFinancialExpenseAction,
  tenantUpdateFinancialExpenseAction as updateFinancialExpenseAction,
  tenantMarkFinancialExpensePaidAction as markFinancialExpensePaidAction,
  tenantCancelFinancialExpenseAction as cancelFinancialExpenseAction,
  tenantCreateProvisionAction as createProvisionAction,
  tenantDeactivateProvisionAction as deactivateProvisionAction,
};

const tenantCreateFinancialEntryAction = bindCurrentTenantContext(
  createFinancialEntryAction,
);
const tenantUpdateFinancialEntryAction = bindCurrentTenantContext(
  updateFinancialEntryAction,
);
const tenantMarkFinancialEntryReceivedAction = withRateLimitActionResult(
  bindCurrentTenantContext(markFinancialEntryReceivedAction),
);
const tenantCancelFinancialEntryAction = withRateLimitActionResult(
  bindCurrentTenantContext(cancelFinancialEntryAction),
);
const tenantCreateFinancialExpenseAction = bindCurrentTenantContext(
  createFinancialExpenseAction,
);
const tenantUpdateFinancialExpenseAction = bindCurrentTenantContext(
  updateFinancialExpenseAction,
);
const tenantMarkFinancialExpensePaidAction = withRateLimitActionResult(
  bindCurrentTenantContext(markFinancialExpensePaidAction),
);
const tenantCancelFinancialExpenseAction = withRateLimitActionResult(
  bindCurrentTenantContext(cancelFinancialExpenseAction),
);
const tenantCreateProvisionAction = bindCurrentTenantContext(createProvisionAction);
const tenantDeactivateProvisionAction = bindCurrentTenantContext(
  deactivateProvisionAction,
);
