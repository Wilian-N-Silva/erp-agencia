"use server";

import { and, count, eq, isNull } from "drizzle-orm";
import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  clientBillingProfiles,
  clientPaymentReminders,
  clients,
  employees,
  financialEntries,
} from "@/lib/db/schema";
import {
  bindCurrentTenantContext,
  getCurrentAccessContext,
  runWithCurrentTenantDb,
} from "@/lib/dal";
import { enforceAuthenticatedRateLimit } from "@/lib/rate-limit";
import { AccessDeniedError, assertCan, assertCanAny } from "@/lib/rbac";

import {
  getCompetenceKey,
  normalizeMoneyInput,
  toDateKey,
} from "@/features/finance/rules";

import {
  buildClientBillingDueDate,
  buildClientExpectedEntryDescription,
  buildClientReminderCandidates,
  canGenerateClientExpectedEntry,
  generateClientCode,
  type ClientReminderKind,
} from "./rules";

const clientStatusSchema = z.enum(["active", "paused", "cancelled"]);

const createClientSchema = z.object({
  name: z.string().trim().min(1).max(160),
  monthlyFee: z.string().trim().min(1).transform(normalizeMoneyInput),
  billingDay: z.coerce.number().int().min(1).max(31),
  internalOwnerEmployeeId: optionalIdSchema(),
  billingMethod: optionalTextSchema(80),
  notes: optionalTextSchema(1000),
  startDate: optionalDateSchema(),
});

const updateClientSchema = createClientSchema.extend({
  id: z.string().uuid(),
});

const updateClientStatusSchema = z.object({
  id: z.string().uuid(),
  status: clientStatusSchema,
});

const updateClientBillingProfileSchema = z.object({
  clientId: z.string().uuid(),
  monthlyFee: z.string().trim().min(1).transform(normalizeMoneyInput),
  billingDay: z.coerce.number().int().min(1).max(31),
  paymentMethod: optionalTextSchema(80),
  paymentTermsDays: integerInputSchema({ min: 0, max: 90, defaultValue: 0 }),
  recurrence: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || "monthly")
    .refine((value) => value === "monthly", {
      message: "Invalid recurrence.",
    }),
  autoGenerateEntries: z
    .string()
    .optional()
    .transform((value) => value === "on"),
  financialContactName: optionalTextSchema(160),
  financialEmail: optionalTextSchema(160).refine(
    (value) => value === null || z.string().email().safeParse(value).success,
    { message: "Invalid email." },
  ),
  financialPhone: optionalTextSchema(40),
  billingOwnerEmployeeId: optionalIdSchema(),
  reminderBeforeDays: integerInputSchema({ min: 0, max: 30, defaultValue: 3 }),
  reminderAfterDays: integerInputSchema({ min: 0, max: 30, defaultValue: 1 }),
  notes: optionalTextSchema(1200),
});

const generateExpectedEntrySchema = z.object({
  clientId: z.string().uuid(),
  competence: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || getCompetenceKey(new Date()))
    .refine((value) => /^\d{4}-\d{2}$/.test(value), {
      message: "Invalid competence.",
    }),
});

const markClientPaymentReceivedSchema = z.object({
  id: z.string().uuid(),
  paymentMethod: optionalTextSchema(80),
});

const updateClientInternalNotesSchema = z.object({
  id: z.string().uuid(),
  notes: optionalTextSchema(2000),
});

export async function createClientAction(formData: FormData) {
  const redirectTo = await runWithCurrentTenantDb(() =>
    createClient(formData),
  );

  redirect(redirectTo as Route);
}

async function createClient(formData: FormData) {
  const { context, organizationId } = await requireClientFinancialWriterContext();
  const input = createClientSchema.parse(formDataToObject(formData));
  const internalOwnerEmployeeId = await resolveEmployeeId(
    input.internalOwnerEmployeeId,
    organizationId,
  );
  const [{ total }] = await db
    .select({ total: count() })
    .from(clients)
    .where(eq(clients.organizationId, organizationId));

  const [client] = await db
    .insert(clients)
    .values({
      organizationId,
      name: input.name,
      code: generateClientCode(total + 1),
      monthlyFee: input.monthlyFee,
      billingDay: input.billingDay,
      internalOwnerEmployeeId,
      billingMethod: input.billingMethod,
      notes: input.notes,
      startDate: input.startDate,
    })
    .returning();

  await db.insert(clientBillingProfiles).values({
    organizationId,
    clientId: client.id,
    monthlyFee: input.monthlyFee,
    billingDay: input.billingDay,
    paymentMethod: input.billingMethod,
    billingOwnerEmployeeId: internalOwnerEmployeeId,
  });

  await writeAuditLog(context, {
    action: "create",
    entityType: "client",
    entityId: client.id,
    after: client,
  });

  revalidatePath("/app/clientes");
  return `/app/clientes/${client.id}`;
}

async function updateClientAction(formData: FormData) {
  const { context, organizationId } = await requireClientFinancialWriterContext();
  const input = updateClientSchema.parse(formDataToObject(formData));
  const before = await getClientForWrite(input.id, organizationId);
  const beforeBilling = await getClientBillingProfileForWrite(input.id, organizationId);
  const internalOwnerEmployeeId = await resolveEmployeeId(
    input.internalOwnerEmployeeId,
    organizationId,
  );

  const [after] = await db
    .update(clients)
    .set({
      name: input.name,
      monthlyFee: input.monthlyFee,
      billingDay: input.billingDay,
      internalOwnerEmployeeId,
      billingMethod: input.billingMethod,
      notes: input.notes,
      startDate: input.startDate,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(clients.id, input.id),
        eq(clients.organizationId, organizationId),
        isNull(clients.deletedAt),
      ),
    )
    .returning();

  await upsertClientBillingProfile({
    organizationId,
    clientId: input.id,
    monthlyFee: input.monthlyFee,
    billingDay: input.billingDay,
    paymentMethod: input.billingMethod,
    billingOwnerEmployeeId: internalOwnerEmployeeId,
    paymentTermsDays: beforeBilling.effective.paymentTermsDays,
    recurrence: beforeBilling.profile?.recurrence ?? "monthly",
    autoGenerateEntries: beforeBilling.profile?.autoGenerateEntries ?? false,
    financialContactName: beforeBilling.profile?.financialContactName ?? null,
    financialEmail: beforeBilling.profile?.financialEmail ?? null,
    financialPhone: beforeBilling.profile?.financialPhone ?? null,
    reminderBeforeDays: beforeBilling.profile?.reminderBeforeDays ?? 3,
    reminderAfterDays: beforeBilling.profile?.reminderAfterDays ?? 1,
    notes: beforeBilling.profile?.notes ?? null,
  });

  await writeAuditLog(context, {
    action: "update",
    entityType: "client",
    entityId: input.id,
    before,
    after,
  });

  revalidatePath("/app/clientes");
  revalidatePath(`/app/clientes/${input.id}`);
}

async function updateClientBillingProfileAction(formData: FormData) {
  const { context, organizationId } = await requireClientFinancialWriterContext();
  const input = updateClientBillingProfileSchema.parse(formDataToObject(formData));
  const before = await getClientBillingProfileForWrite(input.clientId, organizationId);
  const billingOwnerEmployeeId = await resolveEmployeeId(
    input.billingOwnerEmployeeId,
    organizationId,
  );

  const [after] = await upsertClientBillingProfile({
    organizationId,
    clientId: input.clientId,
    monthlyFee: input.monthlyFee,
    billingDay: input.billingDay,
    paymentMethod: input.paymentMethod,
    paymentTermsDays: input.paymentTermsDays,
    recurrence: input.recurrence,
    autoGenerateEntries: input.autoGenerateEntries,
    financialContactName: input.financialContactName,
    financialEmail: input.financialEmail,
    financialPhone: input.financialPhone,
    billingOwnerEmployeeId,
    reminderBeforeDays: input.reminderBeforeDays,
    reminderAfterDays: input.reminderAfterDays,
    notes: input.notes,
  });

  await db
    .update(clients)
    .set({
      monthlyFee: input.monthlyFee,
      billingDay: input.billingDay,
      billingMethod: input.paymentMethod,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(clients.id, input.clientId),
        eq(clients.organizationId, organizationId),
        isNull(clients.deletedAt),
      ),
    );

  await writeAuditLog(context, {
    action: "update",
    entityType: "client",
    entityId: input.clientId,
    before,
    after,
    metadata: {
      section: "billing_profile",
    },
  });

  await syncClientPaymentReminders(context, input.clientId);
  revalidatePath("/app");
  revalidatePath("/app/clientes");
  revalidatePath(`/app/clientes/${input.clientId}`);
  revalidatePath("/app/financeiro");
}

async function generateClientExpectedEntryAction(formData: FormData) {
  const { context, organizationId } = await requireClientFinancialWriterContext();
  const input = generateExpectedEntrySchema.parse(formDataToObject(formData));
  const billing = await getClientBillingProfileForWrite(input.clientId, organizationId);

  if (
    !canGenerateClientExpectedEntry({
      billingDay: billing.effective.billingDay,
      clientStatus: billing.client.status,
      monthlyFee: billing.effective.monthlyFee,
      paymentTermsDays: billing.effective.paymentTermsDays,
    })
  ) {
    throw new Error("Client is not eligible for expected entry generation.");
  }

  const description = buildClientExpectedEntryDescription(
    billing.client.name,
    input.competence,
  );
  const [existing] = await db
    .select({ id: financialEntries.id })
    .from(financialEntries)
    .where(
      and(
        eq(financialEntries.organizationId, organizationId),
        eq(financialEntries.clientId, input.clientId),
        eq(financialEntries.competence, input.competence),
        eq(financialEntries.description, description),
        isNull(financialEntries.deletedAt),
      ),
    )
    .limit(1);

  if (existing) {
    throw new Error("Expected entry already exists for this competence.");
  }

  const [entry] = await db
    .insert(financialEntries)
    .values({
      organizationId,
      clientId: input.clientId,
      description,
      amount: billing.effective.monthlyFee,
      dueDate: buildClientBillingDueDate(
        input.competence,
        billing.effective.billingDay,
        billing.effective.paymentTermsDays,
      ),
      paymentMethod: billing.effective.paymentMethod,
      competence: input.competence,
      recurring: true,
      responsibleUserId: context.userId,
    })
    .returning();

  await writeAuditLog(context, {
    action: "create",
    entityType: "financial_entry",
    entityId: entry.id,
    after: entry,
    metadata: {
      clientId: input.clientId,
      source: "client_billing_profile",
    },
  });

  await syncClientPaymentReminders(context, input.clientId);
  revalidatePath("/app");
  revalidatePath("/app/financeiro");
  revalidatePath("/app/clientes");
  revalidatePath(`/app/clientes/${input.clientId}`);
}

async function markClientPaymentReceivedAction(formData: FormData) {
  const { context, organizationId } = await requireClientFinancialWriterContext();
  await enforceAuthenticatedRateLimit("reconciliation", context);
  const input = markClientPaymentReceivedSchema.parse(formDataToObject(formData));
  const before = await getFinancialEntryForWrite(input.id, organizationId);

  if (!before.clientId) {
    throw new AccessDeniedError();
  }

  if (before.status === "cancelled") {
    throw new Error("Cancelled entries cannot be received.");
  }

  const [after] = await db
    .update(financialEntries)
    .set({
      receivedAmount: before.amount,
      receivedDate: toDateKey(new Date()),
      paymentMethod: input.paymentMethod ?? before.paymentMethod,
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

  await db
    .update(clientPaymentReminders)
    .set({
      status: "resolved",
      resolvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(clientPaymentReminders.organizationId, organizationId),
        eq(clientPaymentReminders.financialEntryId, input.id),
        eq(clientPaymentReminders.status, "open"),
      ),
    );

  await writeAuditLog(context, {
    action: "status_change",
    entityType: "financial_entry",
    entityId: input.id,
    before,
    after,
    metadata: {
      status: "received",
      source: "client_detail",
    },
  });

  await syncClientPaymentReminders(context, before.clientId);
  revalidatePath("/app");
  revalidatePath("/app/financeiro");
  revalidatePath(`/app/clientes/${before.clientId}`);
}

async function updateClientInternalNotesAction(formData: FormData) {
  const { context, organizationId } = await requireClientWriterContext();
  const input = updateClientInternalNotesSchema.parse(formDataToObject(formData));
  const before = await getClientForWrite(input.id, organizationId);
  const [after] = await db
    .update(clients)
    .set({
      notes: input.notes,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(clients.id, input.id),
        eq(clients.organizationId, organizationId),
        isNull(clients.deletedAt),
      ),
    )
    .returning();

  await writeAuditLog(context, {
    action: "update",
    entityType: "client",
    entityId: input.id,
    before,
    after,
    metadata: {
      section: "internal_notes",
    },
  });

  revalidatePath("/app/clientes");
  revalidatePath(`/app/clientes/${input.id}`);
}

async function updateClientStatusAction(formData: FormData) {
  const { context, organizationId } = await requireClientWriterContext();
  const input = updateClientStatusSchema.parse(formDataToObject(formData));
  const before = await getClientForWrite(input.id, organizationId);
  const now = new Date();
  const cancellationDate = input.status === "cancelled" ? now.toISOString().slice(0, 10) : null;

  const [after] = await db
    .update(clients)
    .set({
      cancellationDate,
      status: input.status,
      updatedAt: now,
    })
    .where(
      and(
        eq(clients.id, input.id),
        eq(clients.organizationId, organizationId),
        isNull(clients.deletedAt),
      ),
    )
    .returning();

  await writeAuditLog(context, {
    action: "status_change",
    entityType: "client",
    entityId: input.id,
    before,
    after,
    metadata: {
      status: input.status,
    },
  });

  revalidatePath("/app/clientes");
  revalidatePath(`/app/clientes/${input.id}`);
  revalidatePath("/app");
}

async function requireClientWriterContext() {
  const context = await getCurrentAccessContext();

  if (!context) {
    redirect("/login");
  }

  assertCanAny(["clients.write", "clients.configure"], context);

  if (!context.organizationId) {
    throw new AccessDeniedError();
  }

  return {
    context,
    organizationId: context.organizationId,
  };
}

async function requireClientFinancialWriterContext() {
  const result = await requireClientWriterContext();

  assertCan("finance.write", result.context);

  return result;
}

async function getClientForWrite(id: string, organizationId: string) {
  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, id), eq(clients.organizationId, organizationId), isNull(clients.deletedAt)))
    .limit(1);

  if (!client) {
    throw new AccessDeniedError();
  }

  return client;
}

async function getClientBillingProfileForWrite(clientId: string, organizationId: string) {
  const client = await getClientForWrite(clientId, organizationId);
  const [profile] = await db
    .select()
    .from(clientBillingProfiles)
    .where(
      and(
        eq(clientBillingProfiles.organizationId, organizationId),
        eq(clientBillingProfiles.clientId, clientId),
        isNull(clientBillingProfiles.deletedAt),
      ),
    )
    .limit(1);

  return {
    client,
    profile: profile ?? null,
    effective: {
      monthlyFee: profile?.monthlyFee ?? client.monthlyFee,
      billingDay: profile?.billingDay ?? client.billingDay,
      paymentMethod: profile?.paymentMethod ?? client.billingMethod,
      paymentTermsDays: profile?.paymentTermsDays ?? 0,
      reminderBeforeDays: profile?.reminderBeforeDays ?? 3,
    },
  };
}

async function upsertClientBillingProfile(
  values: Pick<
    typeof clientBillingProfiles.$inferInsert,
    | "organizationId"
    | "clientId"
    | "monthlyFee"
    | "billingDay"
    | "paymentMethod"
    | "billingOwnerEmployeeId"
  > &
    Partial<typeof clientBillingProfiles.$inferInsert>,
) {
  return db
    .insert(clientBillingProfiles)
    .values(values)
    .onConflictDoUpdate({
      target: clientBillingProfiles.clientId,
      set: {
        monthlyFee: values.monthlyFee,
        billingDay: values.billingDay,
        paymentMethod: values.paymentMethod ?? null,
        paymentTermsDays: values.paymentTermsDays ?? 0,
        recurrence: values.recurrence ?? "monthly",
        autoGenerateEntries: values.autoGenerateEntries ?? false,
        financialContactName: values.financialContactName ?? null,
        financialEmail: values.financialEmail ?? null,
        financialPhone: values.financialPhone ?? null,
        billingOwnerEmployeeId: values.billingOwnerEmployeeId ?? null,
        reminderBeforeDays: values.reminderBeforeDays ?? 3,
        reminderAfterDays: values.reminderAfterDays ?? 1,
        notes: values.notes ?? null,
        deletedAt: null,
        updatedAt: new Date(),
      },
    })
    .returning();
}

async function getFinancialEntryForWrite(id: string, organizationId: string) {
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

async function syncClientPaymentReminders(
  context: Awaited<ReturnType<typeof requireClientWriterContext>>["context"],
  clientId: string,
) {
  if (!context.organizationId) {
    throw new AccessDeniedError();
  }

  const billing = await getClientBillingProfileForWrite(clientId, context.organizationId);
  const rows = await db
    .select({
      id: financialEntries.id,
      amount: financialEntries.amount,
      receivedAmount: financialEntries.receivedAmount,
      dueDate: financialEntries.dueDate,
      receivedDate: financialEntries.receivedDate,
      status: financialEntries.status,
    })
    .from(financialEntries)
    .where(
      and(
        eq(financialEntries.organizationId, context.organizationId),
        eq(financialEntries.clientId, clientId),
        isNull(financialEntries.deletedAt),
      ),
    );
  const candidates = buildClientReminderCandidates({
    reminderBeforeDays: billing.effective.reminderBeforeDays,
    payments: rows.map((row) => ({
      ...row,
      clientName: billing.client.name,
    })),
  });
  const existing = await db
    .select({
      id: clientPaymentReminders.id,
      financialEntryId: clientPaymentReminders.financialEntryId,
      kind: clientPaymentReminders.kind,
    })
    .from(clientPaymentReminders)
    .where(
      and(
        eq(clientPaymentReminders.organizationId, context.organizationId),
        eq(clientPaymentReminders.clientId, clientId),
        eq(clientPaymentReminders.status, "open"),
      ),
    );
  const activeKeys = new Set<string>();

  for (const candidate of candidates) {
    const key = reminderKey(candidate.financialEntryId, candidate.kind);
    const current = existing.find(
      (reminder) =>
        reminder.financialEntryId === candidate.financialEntryId &&
        reminder.kind === candidate.kind,
    );

    activeKeys.add(key);

    if (current) {
      await db
        .update(clientPaymentReminders)
        .set({
          title: candidate.title,
          description: candidate.description,
          dueDate: candidate.dueDate,
          updatedAt: new Date(),
        })
        .where(eq(clientPaymentReminders.id, current.id));
      continue;
    }

    await db.insert(clientPaymentReminders).values({
      organizationId: context.organizationId,
      clientId,
      financialEntryId: candidate.financialEntryId,
      kind: candidate.kind,
      title: candidate.title,
      description: candidate.description,
      dueDate: candidate.dueDate,
    });
  }

  for (const reminder of existing) {
    if (
      !activeKeys.has(
        reminderKey(reminder.financialEntryId, reminder.kind as ClientReminderKind),
      )
    ) {
      await db
        .update(clientPaymentReminders)
        .set({
          status: "resolved",
          resolvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(clientPaymentReminders.id, reminder.id));
    }
  }
}

async function resolveEmployeeId(employeeId: string | null, organizationId: string) {
  if (!employeeId) {
    return null;
  }

  const [employee] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(
      and(
        eq(employees.id, employeeId),
        eq(employees.organizationId, organizationId),
        isNull(employees.deletedAt),
      ),
    )
    .limit(1);

  if (!employee) {
    throw new AccessDeniedError();
  }

  return employee.id;
}

function formDataToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function optionalTextSchema(maxLength: number) {
  return z
    .string()
    .trim()
    .max(maxLength)
    .optional()
    .transform((value) => value || null);
}

function optionalDateSchema() {
  return z
    .string()
    .trim()
    .optional()
    .transform((value) => value || null)
    .refine((value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value), {
      message: "Invalid date.",
    });
}

function integerInputSchema({
  defaultValue,
  max,
  min,
}: {
  defaultValue: number;
  max: number;
  min: number;
}) {
  return z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? Number(value) : defaultValue))
    .refine((value) => Number.isInteger(value) && value >= min && value <= max, {
      message: "Invalid integer.",
    });
}

function optionalIdSchema() {
  return z
    .string()
    .trim()
    .optional()
    .transform((value) => value || null)
    .refine((value) => value === null || z.string().uuid().safeParse(value).success, {
      message: "Invalid id.",
    });
}

function reminderKey(financialEntryId: string | null, kind: string) {
  return `${financialEntryId ?? "client"}:${kind}`;
}

export {
  tenantUpdateClientAction as updateClientAction,
  tenantUpdateClientBillingProfileAction as updateClientBillingProfileAction,
  tenantGenerateClientExpectedEntryAction as generateClientExpectedEntryAction,
  tenantMarkClientPaymentReceivedAction as markClientPaymentReceivedAction,
  tenantUpdateClientInternalNotesAction as updateClientInternalNotesAction,
  tenantUpdateClientStatusAction as updateClientStatusAction,
};

const tenantUpdateClientAction = bindCurrentTenantContext(updateClientAction);
const tenantUpdateClientBillingProfileAction = bindCurrentTenantContext(
  updateClientBillingProfileAction,
);
const tenantGenerateClientExpectedEntryAction = bindCurrentTenantContext(
  generateClientExpectedEntryAction,
);
const tenantMarkClientPaymentReceivedAction = bindCurrentTenantContext(
  markClientPaymentReceivedAction,
);
const tenantUpdateClientInternalNotesAction = bindCurrentTenantContext(
  updateClientInternalNotesAction,
);
const tenantUpdateClientStatusAction = bindCurrentTenantContext(updateClientStatusAction);
