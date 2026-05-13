"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { employees, timeOffRequests } from "@/lib/db/schema";
import { getCurrentAccessContext, type AccessContext } from "@/lib/dal";
import { AccessDeniedError } from "@/lib/rbac";

import {
  calculateBusinessDays,
  canApproveTimeOff,
  canCreateOwnTimeOff,
  timeOffTypeLabels,
  type TimeOffStatus,
} from "./rules";

type AuthorizedContext = AccessContext & { organizationId: string };

const dateSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/);
const timeOffTypeSchema = z.enum(
  Object.keys(timeOffTypeLabels) as [
    keyof typeof timeOffTypeLabels,
    ...(keyof typeof timeOffTypeLabels)[],
  ],
);
const createTimeOffSchema = z.object({
  type: timeOffTypeSchema,
  startDate: dateSchema,
  endDate: dateSchema,
  soldDays: z.coerce.number().int().min(0).max(30).optional().default(0),
  notes: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((value) => value || null),
});
const idSchema = z.object({
  id: z.string().uuid(),
});

export async function createTimeOffRequestAction(formData: FormData) {
  const context = await requireCurrentContext();

  if (!canCreateOwnTimeOff(context) || !context.employeeId) {
    throw new AccessDeniedError();
  }

  const input = createTimeOffSchema.parse(formDataToObject(formData));
  const businessDays = calculateBusinessDays(input.startDate, input.endDate);
  const [request] = await db
    .insert(timeOffRequests)
    .values({
      organizationId: context.organizationId,
      employeeId: context.employeeId,
      type: input.type,
      startDate: input.startDate,
      endDate: input.endDate,
      businessDays,
      soldDays: input.soldDays,
      status: "requested",
      requestedByUserId: context.userId,
      notes: input.notes,
    })
    .returning();

  await writeAuditLog(context, {
    action: "create",
    entityType: "time_off_request",
    entityId: request.id,
    after: request,
  });

  revalidateTimeOffPaths();
}

export async function approveTimeOffRequestAction(formData: FormData) {
  const context = await requireCurrentContext();
  const input = idSchema.parse(formDataToObject(formData));
  const before = await getTimeOffForWrite(input.id, context.organizationId);

  if (
    !canApproveTimeOff(context, {
      employeeId: before.employeeId,
      managerEmployeeId: before.managerEmployeeId,
      status: before.status,
    })
  ) {
    throw new AccessDeniedError();
  }

  await updateTimeOffStatus(context, before, "approved", "approve");
}

export async function rejectTimeOffRequestAction(formData: FormData) {
  const context = await requireCurrentContext();
  const input = idSchema.parse(formDataToObject(formData));
  const before = await getTimeOffForWrite(input.id, context.organizationId);

  if (
    !canApproveTimeOff(context, {
      employeeId: before.employeeId,
      managerEmployeeId: before.managerEmployeeId,
      status: before.status,
    })
  ) {
    throw new AccessDeniedError();
  }

  await updateTimeOffStatus(context, before, "rejected", "reject");
}

async function requireCurrentContext(): Promise<AuthorizedContext> {
  const context = await getCurrentAccessContext();

  if (!context) {
    redirect("/login");
  }

  if (!context.organizationId) {
    throw new AccessDeniedError();
  }

  return {
    ...context,
    organizationId: context.organizationId,
  };
}

async function getTimeOffForWrite(id: string, organizationId: string) {
  const [row] = await db
    .select({
      id: timeOffRequests.id,
      organizationId: timeOffRequests.organizationId,
      employeeId: timeOffRequests.employeeId,
      managerEmployeeId: employees.managerEmployeeId,
      status: timeOffRequests.status,
    })
    .from(timeOffRequests)
    .innerJoin(employees, eq(timeOffRequests.employeeId, employees.id))
    .where(and(eq(timeOffRequests.id, id), eq(timeOffRequests.organizationId, organizationId)))
    .limit(1);

  if (!row) {
    throw new AccessDeniedError();
  }

  return {
    ...row,
    status: row.status as TimeOffStatus,
  };
}

async function updateTimeOffStatus(
  context: AuthorizedContext,
  before: Awaited<ReturnType<typeof getTimeOffForWrite>>,
  status: TimeOffStatus,
  action: "approve" | "reject",
) {
  const [after] = await db
    .update(timeOffRequests)
    .set({
      approvedByUserId: context.userId,
      status,
      updatedAt: new Date(),
    })
    .where(eq(timeOffRequests.id, before.id))
    .returning();

  await writeAuditLog(context, {
    action,
    entityType: "time_off_request",
    entityId: before.id,
    before,
    after,
    metadata: {
      status,
    },
  });

  revalidateTimeOffPaths();
}

function revalidateTimeOffPaths() {
  revalidatePath("/portal");
  revalidatePath("/app/ferias");
  revalidatePath("/app");
}

function formDataToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}
