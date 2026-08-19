"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { employees, timeOffRequests, vacationBalances } from "@/lib/db/schema";
import {
  bindCurrentTenantContext,
  getCurrentAccessContext,
  type AccessContext,
} from "@/lib/dal";
import {
  enforceAuthenticatedRateLimit,
  withRateLimitActionError,
} from "@/lib/rate-limit";
import { AccessDeniedError, assertCan } from "@/lib/rbac";

import {
  calculateBusinessDays,
  canApproveTimeOff,
  canCreateOwnTimeOff,
  canManageVacationBalance,
  computeVacationPeriod,
  timeOffTypeLabels,
  validateSoldDays,
  type TimeOffStatus,
  type VacationBalanceStatus,
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

async function createTimeOffRequestAction(formData: FormData) {
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

async function approveTimeOffRequestAction(formData: FormData) {
  const context = await requireCurrentContext();
  await enforceAuthenticatedRateLimit("common_mutation", context);
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

async function rejectTimeOffRequestAction(formData: FormData) {
  const context = await requireCurrentContext();
  await enforceAuthenticatedRateLimit("common_mutation", context);
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

const createVacationBalanceSchema = z.object({
  employeeId: z.string().uuid(),
  tenureYear: z.coerce.number().int().min(1).max(50),
  daysAcquired: z.coerce.number().int().min(0).max(60).optional(),
  daysSold: z.coerce.number().int().min(0).max(60).optional().default(0),
  notes: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((value) => value || null),
});

const updateVacationBalanceSchema = z.object({
  id: z.string().uuid(),
  daysAcquired: z.coerce.number().int().min(0).max(60),
  daysSold: z.coerce.number().int().min(0).max(60),
  notes: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((value) => value || null),
});

async function createVacationBalanceAction(formData: FormData) {
  const context = await requireCurrentContext();

  assertCan("timeoff.write", context);

  if (!canManageVacationBalance(context)) {
    throw new AccessDeniedError();
  }

  const input = createVacationBalanceSchema.parse(formDataToObject(formData));
  const employee = await getEmployeeForVacationBalance(input.employeeId, context.organizationId);

  if (employee.employmentType !== "clt") {
    throw new Error("Saldo aquisitivo de ferias e exclusivo para CLT.");
  }

  if (!employee.employmentStartDate) {
    throw new Error("Colaborador nao possui data de entrada cadastrada.");
  }

  const period = computeVacationPeriod(employee.employmentStartDate, input.tenureYear);
  const daysAcquired = input.daysAcquired ?? 30;

  const validation = validateSoldDays({
    daysAcquired,
    daysSold: input.daysSold,
    daysTaken: 0,
  });

  if (validation) {
    throw new Error(validation);
  }

  const [balance] = await db
    .insert(vacationBalances)
    .values({
      organizationId: context.organizationId,
      employeeId: input.employeeId,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      concessionDeadline: period.concessionDeadline,
      daysAcquired,
      daysSold: input.daysSold,
      status: "active",
      notes: input.notes,
      createdByUserId: context.userId,
    })
    .returning();

  await writeAuditLog(context, {
    action: "create",
    entityType: "vacation_balance",
    entityId: balance.id,
    after: balance,
    metadata: {
      employeeId: input.employeeId,
      tenureYear: input.tenureYear,
    },
  });

  revalidateVacationBalancePaths(input.employeeId);
}

async function updateVacationBalanceAction(formData: FormData) {
  const context = await requireCurrentContext();

  assertCan("timeoff.write", context);

  if (!canManageVacationBalance(context)) {
    throw new AccessDeniedError();
  }

  const input = updateVacationBalanceSchema.parse(formDataToObject(formData));
  const before = await getVacationBalanceRow(input.id, context.organizationId);

  if (before.status !== "active") {
    throw new Error("Apenas saldos em vigencia podem ser ajustados.");
  }

  const validation = validateSoldDays({
    daysAcquired: input.daysAcquired,
    daysSold: input.daysSold,
    daysTaken: 0,
  });

  if (validation) {
    throw new Error(validation);
  }

  const [after] = await db
    .update(vacationBalances)
    .set({
      daysAcquired: input.daysAcquired,
      daysSold: input.daysSold,
      notes: input.notes,
      updatedAt: new Date(),
    })
    .where(eq(vacationBalances.id, input.id))
    .returning();

  await writeAuditLog(context, {
    action: "update",
    entityType: "vacation_balance",
    entityId: input.id,
    before,
    after,
  });

  revalidateVacationBalancePaths(before.employeeId);
}

async function closeVacationBalanceAction(formData: FormData) {
  const context = await requireCurrentContext();

  assertCan("timeoff.write", context);

  if (!canManageVacationBalance(context)) {
    throw new AccessDeniedError();
  }

  const input = idSchema.parse(formDataToObject(formData));
  const before = await getVacationBalanceRow(input.id, context.organizationId);

  if (before.status !== "active") {
    throw new Error("Saldo ja encerrado.");
  }

  const [after] = await db
    .update(vacationBalances)
    .set({ status: "closed", updatedAt: new Date() })
    .where(eq(vacationBalances.id, input.id))
    .returning();

  await writeAuditLog(context, {
    action: "status_change",
    entityType: "vacation_balance",
    entityId: input.id,
    before,
    after,
    metadata: {
      status: "closed",
    },
  });

  revalidateVacationBalancePaths(before.employeeId);
}

async function getEmployeeForVacationBalance(employeeId: string, organizationId: string) {
  const [employee] = await db
    .select({
      id: employees.id,
      employmentType: employees.employmentType,
      employmentStartDate: employees.startDate,
    })
    .from(employees)
    .where(and(eq(employees.id, employeeId), eq(employees.organizationId, organizationId)))
    .limit(1);

  if (!employee) {
    throw new AccessDeniedError();
  }

  return employee;
}

async function getVacationBalanceRow(id: string, organizationId: string) {
  const [row] = await db
    .select()
    .from(vacationBalances)
    .where(
      and(eq(vacationBalances.id, id), eq(vacationBalances.organizationId, organizationId)),
    )
    .limit(1);

  if (!row) {
    throw new AccessDeniedError();
  }

  return { ...row, status: row.status as VacationBalanceStatus };
}

function revalidateVacationBalancePaths(employeeId: string) {
  revalidatePath(`/app/colaboradores/${employeeId}/ferias`);
  revalidatePath("/app/ferias");
  revalidatePath("/portal");
  revalidatePath("/app");
}

export {
  tenantCreateTimeOffRequestAction as createTimeOffRequestAction,
  tenantApproveTimeOffRequestAction as approveTimeOffRequestAction,
  tenantRejectTimeOffRequestAction as rejectTimeOffRequestAction,
  tenantCreateVacationBalanceAction as createVacationBalanceAction,
  tenantUpdateVacationBalanceAction as updateVacationBalanceAction,
  tenantCloseVacationBalanceAction as closeVacationBalanceAction,
};

const tenantCreateTimeOffRequestAction = bindCurrentTenantContext(
  createTimeOffRequestAction,
);
const tenantApproveTimeOffRequestAction = withRateLimitActionError(
  bindCurrentTenantContext(approveTimeOffRequestAction),
);
const tenantRejectTimeOffRequestAction = withRateLimitActionError(
  bindCurrentTenantContext(rejectTimeOffRequestAction),
);
const tenantCreateVacationBalanceAction = bindCurrentTenantContext(
  createVacationBalanceAction,
);
const tenantUpdateVacationBalanceAction = bindCurrentTenantContext(
  updateVacationBalanceAction,
);
const tenantCloseVacationBalanceAction = bindCurrentTenantContext(
  closeVacationBalanceAction,
);
