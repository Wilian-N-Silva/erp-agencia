"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { employees, saasSubscriptionUsers, saasSubscriptions } from "@/lib/db/schema";
import { getCurrentAccessContext, type AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCanAny } from "@/lib/rbac";

import { normalizeMoneyInput } from "@/features/finance/rules";

import {
  canReadSaasCost,
  saasSubscriptionStatusLabels,
  type SaasSubscriptionStatus,
} from "./rules";

type AuthorizedContext = AccessContext & { organizationId: string };

const dateSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/);
const saasStatusSchema = z.enum(
  Object.keys(saasSubscriptionStatusLabels) as [
    keyof typeof saasSubscriptionStatusLabels,
    ...(keyof typeof saasSubscriptionStatusLabels)[],
  ],
);
const saasBaseSchema = z.object({
  name: z.string().trim().min(1).max(160),
  category: z.string().trim().min(1).max(120),
  provider: optionalTextSchema(120),
  monthlyCost: optionalMoneySchema(),
  renewalDate: optionalDateSchema(),
  status: saasStatusSchema,
  notes: optionalTextSchema(1000),
});
const createSaasSubscriptionSchema = saasBaseSchema;
const updateSaasSubscriptionSchema = saasBaseSchema.extend({
  id: z.string().uuid(),
});
const linkSaasUserSchema = z.object({
  employeeId: z.string().uuid(),
  subscriptionId: z.string().uuid(),
});
const renewSaasSubscriptionSchema = z.object({
  id: z.string().uuid(),
  renewalDate: dateSchema,
});
const idSchema = z.object({
  id: z.string().uuid(),
});

export async function createSaasSubscriptionAction(formData: FormData) {
  const context = await requireSaasWriterContext();
  const input = createSaasSubscriptionSchema.parse(formDataToObject(formData));
  const [created] = await db
    .insert(saasSubscriptions)
    .values({
      organizationId: context.organizationId,
      name: input.name,
      category: input.category,
      provider: input.provider,
      monthlyCost: canReadSaasCost(context) ? input.monthlyCost : null,
      renewalDate: input.renewalDate,
      responsibleUserId: context.userId,
      status: input.status,
      notes: input.notes,
    })
    .returning();

  await writeAuditLog(context, {
    action: "create",
    entityType: "saas_subscription",
    entityId: created.id,
    after: created,
  });

  revalidateSaasPaths();
}

export async function updateSaasSubscriptionAction(formData: FormData) {
  const context = await requireSaasWriterContext();
  const input = updateSaasSubscriptionSchema.parse(formDataToObject(formData));
  const before = await getSaasSubscriptionForWrite(input.id, context.organizationId);
  const [after] = await db
    .update(saasSubscriptions)
    .set({
      name: input.name,
      category: input.category,
      provider: input.provider,
      monthlyCost: canReadSaasCost(context) ? input.monthlyCost : before.monthlyCost,
      renewalDate: input.renewalDate,
      responsibleUserId: context.userId,
      status: input.status,
      notes: input.notes,
      updatedAt: new Date(),
    })
    .where(eq(saasSubscriptions.id, input.id))
    .returning();

  await writeAuditLog(context, {
    action: "update",
    entityType: "saas_subscription",
    entityId: input.id,
    before,
    after,
    metadata: {
      costChanged: before.monthlyCost !== after.monthlyCost,
    },
  });

  revalidateSaasPaths();
}

export async function linkEmployeeToSaasSubscriptionAction(formData: FormData) {
  const context = await requireSaasWriterContext();
  const input = linkSaasUserSchema.parse(formDataToObject(formData));

  await getSaasSubscriptionForWrite(input.subscriptionId, context.organizationId);
  await getEmployeeForWrite(input.employeeId, context.organizationId);

  const [link] = await db
    .insert(saasSubscriptionUsers)
    .values({
      subscriptionId: input.subscriptionId,
      employeeId: input.employeeId,
      status: "active",
      unlinkedAt: null,
    })
    .onConflictDoUpdate({
      target: [saasSubscriptionUsers.subscriptionId, saasSubscriptionUsers.employeeId],
      set: {
        status: "active",
        unlinkedAt: null,
      },
    })
    .returning();

  await writeAuditLog(context, {
    action: "status_change",
    entityType: "saas_subscription",
    entityId: input.subscriptionId,
    after: link,
    metadata: {
      employeeId: input.employeeId,
      linkStatus: "active",
    },
  });

  revalidateSaasPaths();
}

export async function unlinkEmployeeFromSaasSubscriptionAction(formData: FormData) {
  const context = await requireSaasWriterContext();
  const input = linkSaasUserSchema.parse(formDataToObject(formData));

  await getSaasSubscriptionForWrite(input.subscriptionId, context.organizationId);
  await getEmployeeForWrite(input.employeeId, context.organizationId);

  const before = await getSaasUserLink(input.subscriptionId, input.employeeId);
  const [after] = await db
    .update(saasSubscriptionUsers)
    .set({
      status: "inactive",
      unlinkedAt: new Date(),
    })
    .where(
      and(
        eq(saasSubscriptionUsers.subscriptionId, input.subscriptionId),
        eq(saasSubscriptionUsers.employeeId, input.employeeId),
      ),
    )
    .returning();

  await writeAuditLog(context, {
    action: "status_change",
    entityType: "saas_subscription",
    entityId: input.subscriptionId,
    before,
    after,
    metadata: {
      employeeId: input.employeeId,
      linkStatus: "inactive",
    },
  });

  revalidateSaasPaths();
}

export async function markSaasSubscriptionRenewedAction(formData: FormData) {
  const context = await requireSaasWriterContext();
  const input = renewSaasSubscriptionSchema.parse(formDataToObject(formData));

  await updateSaasStatus(context, input.id, "active", {
    renewalDate: input.renewalDate,
  });
}

export async function cancelSaasSubscriptionAction(formData: FormData) {
  const context = await requireSaasWriterContext();
  const input = idSchema.parse(formDataToObject(formData));

  await updateSaasStatus(context, input.id, "cancelled");
}

async function updateSaasStatus(
  context: AuthorizedContext,
  id: string,
  status: SaasSubscriptionStatus,
  extra: Partial<typeof saasSubscriptions.$inferInsert> = {},
) {
  const before = await getSaasSubscriptionForWrite(id, context.organizationId);
  const [after] = await db
    .update(saasSubscriptions)
    .set({
      ...extra,
      status,
      updatedAt: new Date(),
    })
    .where(eq(saasSubscriptions.id, id))
    .returning();

  await writeAuditLog(context, {
    action: "status_change",
    entityType: "saas_subscription",
    entityId: id,
    before,
    after,
    metadata: {
      status,
    },
  });

  revalidateSaasPaths();
}

async function requireSaasWriterContext(): Promise<AuthorizedContext> {
  const context = await getCurrentAccessContext();

  if (!context) {
    redirect("/login");
  }

  assertCanAny(["saas.write", "saas.configure"], context);

  if (!context.organizationId) {
    throw new AccessDeniedError();
  }

  return {
    ...context,
    organizationId: context.organizationId,
  };
}

async function getSaasSubscriptionForWrite(id: string, organizationId: string) {
  const [row] = await db
    .select()
    .from(saasSubscriptions)
    .where(and(eq(saasSubscriptions.id, id), eq(saasSubscriptions.organizationId, organizationId), isNull(saasSubscriptions.deletedAt)))
    .limit(1);

  if (!row) {
    throw new AccessDeniedError();
  }

  return row;
}

async function getEmployeeForWrite(id: string, organizationId: string) {
  const [employee] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.id, id), eq(employees.organizationId, organizationId), isNull(employees.deletedAt)))
    .limit(1);

  if (!employee) {
    throw new AccessDeniedError();
  }

  return employee;
}

async function getSaasUserLink(subscriptionId: string, employeeId: string) {
  const [link] = await db
    .select()
    .from(saasSubscriptionUsers)
    .where(
      and(
        eq(saasSubscriptionUsers.subscriptionId, subscriptionId),
        eq(saasSubscriptionUsers.employeeId, employeeId),
      ),
    )
    .limit(1);

  if (!link) {
    throw new AccessDeniedError();
  }

  return link;
}

function revalidateSaasPaths() {
  revalidatePath("/app");
  revalidatePath("/app/assinaturas");
  revalidatePath("/portal");
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

function optionalMoneySchema() {
  return z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? normalizeMoneyInput(value) : null));
}
