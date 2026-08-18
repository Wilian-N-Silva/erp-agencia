"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { accessRecords, employees } from "@/lib/db/schema";
import {
  bindCurrentTenantContext,
  getCurrentAccessContext,
  type AccessContext,
} from "@/lib/dal";
import { AccessDeniedError, assertCanAny } from "@/lib/rbac";

import { accessRecordStatusLabels, type AccessRecordStatus } from "./rules";

type AuthorizedContext = AccessContext & { organizationId: string };

const dateSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/);
const accessRecordStatusSchema = z.enum(
  Object.keys(accessRecordStatusLabels) as [
    keyof typeof accessRecordStatusLabels,
    ...(keyof typeof accessRecordStatusLabels)[],
  ],
);
const accessRecordBaseSchema = z.object({
  employeeId: z.string().uuid(),
  platform: z.string().trim().min(1).max(160),
  accountIdentifier: optionalTextSchema(160),
  accessLevel: z.string().trim().min(1).max(120),
  critical: checkboxSchema(),
  reviewDueDate: optionalDateSchema(),
  status: accessRecordStatusSchema,
  notes: optionalTextSchema(1000),
});
const createAccessRecordSchema = accessRecordBaseSchema;
const updateAccessRecordSchema = accessRecordBaseSchema.extend({
  id: z.string().uuid(),
});
const reviewAccessRecordSchema = z.object({
  id: z.string().uuid(),
  reviewDueDate: dateSchema,
});
const idSchema = z.object({
  id: z.string().uuid(),
});

async function createAccessRecordAction(formData: FormData) {
  const context = await requireAccessWriterContext();
  const input = createAccessRecordSchema.parse(formDataToObject(formData));

  assertCriticalReviewDate(input);
  await getEmployeeForWrite(input.employeeId, context.organizationId);

  const [created] = await db
    .insert(accessRecords)
    .values({
      organizationId: context.organizationId,
      employeeId: input.employeeId,
      platform: input.platform,
      accountIdentifier: input.accountIdentifier,
      accessLevel: input.accessLevel,
      critical: input.critical,
      reviewDueDate: input.reviewDueDate,
      status: input.status,
      removedAt: input.status === "removed" ? new Date() : null,
      responsibleUserId: context.userId,
      notes: input.notes,
    })
    .returning();

  await writeAuditLog(context, {
    action: "create",
    entityType: "access_record",
    entityId: created.id,
    after: created,
  });

  revalidateAccessPaths();
}

async function updateAccessRecordAction(formData: FormData) {
  const context = await requireAccessWriterContext();
  const input = updateAccessRecordSchema.parse(formDataToObject(formData));

  assertCriticalReviewDate(input);
  await getEmployeeForWrite(input.employeeId, context.organizationId);
  const before = await getAccessRecordForWrite(input.id, context.organizationId);
  const [after] = await db
    .update(accessRecords)
    .set({
      employeeId: input.employeeId,
      platform: input.platform,
      accountIdentifier: input.accountIdentifier,
      accessLevel: input.accessLevel,
      critical: input.critical,
      reviewDueDate: input.reviewDueDate,
      status: input.status,
      removedAt: input.status === "removed" ? (before.removedAt ?? new Date()) : null,
      responsibleUserId: context.userId,
      notes: input.notes,
      updatedAt: new Date(),
    })
    .where(eq(accessRecords.id, input.id))
    .returning();

  await writeAuditLog(context, {
    action: "update",
    entityType: "access_record",
    entityId: input.id,
    before,
    after,
  });

  revalidateAccessPaths();
}

async function approveAccessRecordAction(formData: FormData) {
  await updateAccessStatus(formData, "active", "approve");
}

async function markAccessRemovedAction(formData: FormData) {
  await updateAccessStatus(formData, "removed", "status_change");
}

async function reviewAccessRecordAction(formData: FormData) {
  const context = await requireAccessWriterContext();
  const input = reviewAccessRecordSchema.parse(formDataToObject(formData));
  const before = await getAccessRecordForWrite(input.id, context.organizationId);
  const [after] = await db
    .update(accessRecords)
    .set({
      responsibleUserId: context.userId,
      reviewDueDate: input.reviewDueDate,
      status: "active",
      updatedAt: new Date(),
    })
    .where(eq(accessRecords.id, input.id))
    .returning();

  await writeAuditLog(context, {
    action: "status_change",
    entityType: "access_record",
    entityId: input.id,
    before,
    after,
    metadata: {
      reviewDueDate: input.reviewDueDate,
      status: "active",
    },
  });

  revalidateAccessPaths();
}

async function updateAccessStatus(
  formData: FormData,
  status: AccessRecordStatus,
  action: "approve" | "status_change",
) {
  const context = await requireAccessWriterContext();
  const input = idSchema.parse(formDataToObject(formData));
  const before = await getAccessRecordForWrite(input.id, context.organizationId);
  const [after] = await db
    .update(accessRecords)
    .set({
      removedAt: status === "removed" ? new Date() : before.removedAt,
      responsibleUserId: context.userId,
      status,
      updatedAt: new Date(),
    })
    .where(eq(accessRecords.id, input.id))
    .returning();

  await writeAuditLog(context, {
    action,
    entityType: "access_record",
    entityId: input.id,
    before,
    after,
    metadata: {
      status,
    },
  });

  revalidateAccessPaths();
}

async function requireAccessWriterContext(): Promise<AuthorizedContext> {
  const context = await getCurrentAccessContext();

  if (!context) {
    redirect("/login");
  }

  assertCanAny(["access_records.write", "access_records.configure"], context);

  if (!context.organizationId) {
    throw new AccessDeniedError();
  }

  return {
    ...context,
    organizationId: context.organizationId,
  };
}

async function getEmployeeForWrite(id: string, organizationId: string) {
  const [employee] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.id, id), eq(employees.organizationId, organizationId)))
    .limit(1);

  if (!employee) {
    throw new AccessDeniedError();
  }

  return employee;
}

async function getAccessRecordForWrite(id: string, organizationId: string) {
  const [row] = await db
    .select()
    .from(accessRecords)
    .where(and(eq(accessRecords.id, id), eq(accessRecords.organizationId, organizationId)))
    .limit(1);

  if (!row) {
    throw new AccessDeniedError();
  }

  return row;
}

function assertCriticalReviewDate(input: { critical: boolean; reviewDueDate: string | null }) {
  if (input.critical && !input.reviewDueDate) {
    throw new Error("Critical access records must have a review due date.");
  }
}

function revalidateAccessPaths() {
  revalidatePath("/app");
  revalidatePath("/app/acessos");
  revalidatePath("/portal");
}

function formDataToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function checkboxSchema() {
  return z
    .string()
    .optional()
    .transform((value) => value === "on");
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

export {
  tenantCreateAccessRecordAction as createAccessRecordAction,
  tenantUpdateAccessRecordAction as updateAccessRecordAction,
  tenantApproveAccessRecordAction as approveAccessRecordAction,
  tenantMarkAccessRemovedAction as markAccessRemovedAction,
  tenantReviewAccessRecordAction as reviewAccessRecordAction,
};

const tenantCreateAccessRecordAction = bindCurrentTenantContext(createAccessRecordAction);
const tenantUpdateAccessRecordAction = bindCurrentTenantContext(updateAccessRecordAction);
const tenantApproveAccessRecordAction = bindCurrentTenantContext(approveAccessRecordAction);
const tenantMarkAccessRemovedAction = bindCurrentTenantContext(markAccessRemovedAction);
const tenantReviewAccessRecordAction = bindCurrentTenantContext(reviewAccessRecordAction);
