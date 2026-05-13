"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  areas,
  compensationHistory,
  employeeBenefits,
  employees,
  positions,
} from "@/lib/db/schema";
import { getCurrentAccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCan, assertCanAny } from "@/lib/rbac";

import { normalizeMoneyInput, toDateKey } from "@/features/finance/rules";

import {
  employeeStatusLabels,
  employmentTypeLabels,
  getCompensationDifference,
  getNextRegistrationNumber,
} from "./rules";

const dateSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/);
const employeeStatusSchema = z.enum(
  Object.keys(employeeStatusLabels) as [
    keyof typeof employeeStatusLabels,
    ...(keyof typeof employeeStatusLabels)[],
  ],
);
const employmentTypeSchema = z.enum(
  Object.keys(employmentTypeLabels) as [
    keyof typeof employmentTypeLabels,
    ...(keyof typeof employmentTypeLabels)[],
  ],
);

const employeeBaseSchema = z.object({
  fullName: z.string().trim().min(1).max(180),
  socialName: optionalTextSchema(120),
  corporateEmail: optionalEmailSchema(),
  personalEmail: optionalEmailSchema(),
  phone: optionalTextSchema(40),
  cpf: optionalTextSchema(20),
  rg: optionalTextSchema(30),
  birthDate: optionalDateSchema(),
  address: optionalTextSchema(300),
  pix: optionalTextSchema(160),
  emergencyContact: optionalTextSchema(200),
  positionId: z.string().uuid(),
  areaId: z.string().uuid(),
  managerEmployeeId: optionalIdSchema(),
  employmentType: employmentTypeSchema,
  startDate: dateSchema,
  endDate: optionalDateSchema(),
  status: employeeStatusSchema,
  workModel: optionalTextSchema(80),
  location: optionalTextSchema(120),
  internalNotes: optionalTextSchema(2000),
});

const createEmployeeSchema = employeeBaseSchema.extend({
  currentCompensation: z.string().trim().min(1).transform(normalizeMoneyInput),
  recurringCostAllowance: optionalMoneySchema(),
  recurringTransport: optionalMoneySchema(),
});

const updateEmployeeSchema = employeeBaseSchema.extend({
  id: z.string().uuid(),
});

const updateCompensationSchema = z.object({
  employeeId: z.string().uuid(),
  newAmount: z.string().trim().min(1).transform(normalizeMoneyInput),
  recurringCostAllowance: optionalMoneySchema(),
  recurringTransport: optionalMoneySchema(),
  effectiveDate: dateSchema,
  reason: z.string().trim().min(1).max(500),
});

const createBenefitSchema = z.object({
  employeeId: z.string().uuid(),
  benefitType: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(160),
  amount: z.string().trim().min(1).transform(normalizeMoneyInput),
  recurring: z
    .string()
    .optional()
    .transform((value) => value === "on"),
  startDate: dateSchema,
  endDate: optionalDateSchema(),
  notes: optionalTextSchema(1000),
});

const endBenefitSchema = z.object({
  id: z.string().uuid(),
  employeeId: z.string().uuid(),
});

export async function createEmployeeAction(formData: FormData) {
  const { context, organizationId } = await requirePeopleWriterWithCompensationContext();
  const input = createEmployeeSchema.parse(formDataToObject(formData));
  await assertAreaPositionAndManager(input, organizationId);
  const registrationNumber = await getNextRegistrationForOrganization(organizationId);

  const [employee] = await db
    .insert(employees)
    .values({
      organizationId,
      registrationNumber,
      fullName: input.fullName,
      socialName: input.socialName,
      corporateEmail: input.corporateEmail,
      personalEmail: input.personalEmail,
      phone: input.phone,
      cpf: input.cpf,
      rg: input.rg,
      birthDate: input.birthDate,
      address: input.address,
      pix: input.pix,
      emergencyContact: input.emergencyContact,
      positionId: input.positionId,
      areaId: input.areaId,
      managerEmployeeId: input.managerEmployeeId,
      employmentType: input.employmentType,
      startDate: input.startDate,
      endDate: input.endDate,
      status: input.status,
      workModel: input.workModel,
      location: input.location,
      currentCompensation: input.currentCompensation,
      recurringCostAllowance: input.recurringCostAllowance,
      recurringTransport: input.recurringTransport,
      internalNotes: input.internalNotes,
    })
    .returning();

  await writeAuditLog(context, {
    action: "create",
    entityType: "employee",
    entityId: employee.id,
    after: employee,
  });

  revalidatePath("/app/colaboradores");
  redirect(`/app/colaboradores/${employee.id}`);
}

export async function updateEmployeeAction(formData: FormData) {
  const { context, organizationId } = await requirePeopleWriterContext();
  const input = updateEmployeeSchema.parse(formDataToObject(formData));
  await assertAreaPositionAndManager(input, organizationId, input.id);
  const before = await getEmployeeForWrite(input.id, organizationId);

  const [after] = await db
    .update(employees)
    .set({
      fullName: input.fullName,
      socialName: input.socialName,
      corporateEmail: input.corporateEmail,
      personalEmail: input.personalEmail,
      phone: input.phone,
      cpf: input.cpf,
      rg: input.rg,
      birthDate: input.birthDate,
      address: input.address,
      pix: input.pix,
      emergencyContact: input.emergencyContact,
      positionId: input.positionId,
      areaId: input.areaId,
      managerEmployeeId: input.managerEmployeeId,
      employmentType: input.employmentType,
      startDate: input.startDate,
      endDate: input.endDate,
      status: input.status,
      workModel: input.workModel,
      location: input.location,
      internalNotes: input.internalNotes,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(employees.id, input.id),
        eq(employees.organizationId, organizationId),
        isNull(employees.deletedAt),
      ),
    )
    .returning();

  await writeAuditLog(context, {
    action: "update",
    entityType: "employee",
    entityId: input.id,
    before,
    after,
  });

  revalidatePath("/app/colaboradores");
  revalidatePath(`/app/colaboradores/${input.id}`);
}

export async function updateEmployeeCompensationAction(formData: FormData) {
  const { context, organizationId } = await requireCompensationWriterContext();
  const input = updateCompensationSchema.parse(formDataToObject(formData));
  const before = await getEmployeeForWrite(input.employeeId, organizationId);
  const differenceAmount = getCompensationDifference(before.currentCompensation, input.newAmount);

  const [after] = await db
    .update(employees)
    .set({
      currentCompensation: input.newAmount,
      recurringCostAllowance: input.recurringCostAllowance,
      recurringTransport: input.recurringTransport,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(employees.id, input.employeeId),
        eq(employees.organizationId, organizationId),
        isNull(employees.deletedAt),
      ),
    )
    .returning();

  const [history] = await db
    .insert(compensationHistory)
    .values({
      organizationId,
      employeeId: input.employeeId,
      previousAmount: before.currentCompensation,
      newAmount: input.newAmount,
      differenceAmount,
      effectiveDate: input.effectiveDate,
      reason: input.reason,
      approvedByUserId: context.userId,
      createdByUserId: context.userId,
    })
    .returning();

  await writeAuditLog(context, {
    action: "update",
    entityType: "employee",
    entityId: input.employeeId,
    before,
    after,
    metadata: {
      compensationHistoryId: history.id,
      section: "compensation",
    },
  });

  revalidatePath("/app/colaboradores");
  revalidatePath(`/app/colaboradores/${input.employeeId}`);
  revalidatePath(`/app/colaboradores/${input.employeeId}/remuneracao`);
}

export async function createEmployeeBenefitAction(formData: FormData) {
  const { context, organizationId } = await requireCompensationWriterContext();
  const input = createBenefitSchema.parse(formDataToObject(formData));
  await getEmployeeForWrite(input.employeeId, organizationId);

  const [benefit] = await db
    .insert(employeeBenefits)
    .values({
      organizationId,
      employeeId: input.employeeId,
      benefitType: input.benefitType,
      name: input.name,
      amount: input.amount,
      recurring: input.recurring,
      startDate: input.startDate,
      endDate: input.endDate,
      notes: input.notes,
      createdByUserId: context.userId,
    })
    .returning();

  await writeAuditLog(context, {
    action: "create",
    entityType: "employee",
    entityId: input.employeeId,
    after: benefit,
    metadata: {
      benefitId: benefit.id,
      section: "benefit",
    },
  });

  revalidatePath(`/app/colaboradores/${input.employeeId}/remuneracao`);
}

export async function endEmployeeBenefitAction(formData: FormData) {
  const { context, organizationId } = await requireCompensationWriterContext();
  const input = endBenefitSchema.parse(formDataToObject(formData));
  await getEmployeeForWrite(input.employeeId, organizationId);
  const before = await getBenefitForWrite(input.id, input.employeeId, organizationId);
  const [after] = await db
    .update(employeeBenefits)
    .set({
      status: "ended",
      endDate: toDateKey(new Date()),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(employeeBenefits.id, input.id),
        eq(employeeBenefits.employeeId, input.employeeId),
        eq(employeeBenefits.organizationId, organizationId),
        isNull(employeeBenefits.deletedAt),
      ),
    )
    .returning();

  await writeAuditLog(context, {
    action: "status_change",
    entityType: "employee",
    entityId: input.employeeId,
    before,
    after,
    metadata: {
      benefitId: input.id,
      section: "benefit",
      status: "ended",
    },
  });

  revalidatePath(`/app/colaboradores/${input.employeeId}/remuneracao`);
}

async function requirePeopleWriterContext() {
  const context = await getCurrentAccessContext();

  if (!context) {
    redirect("/login");
  }

  assertCanAny(["people.write", "people.configure"], context);

  if (!context.organizationId) {
    throw new AccessDeniedError();
  }

  return {
    context,
    organizationId: context.organizationId,
  };
}

async function requireCompensationWriterContext() {
  const context = await getCurrentAccessContext();

  if (!context) {
    redirect("/login");
  }

  assertCan("compensation.write", context);

  if (!context.organizationId) {
    throw new AccessDeniedError();
  }

  return {
    context,
    organizationId: context.organizationId,
  };
}

async function requirePeopleWriterWithCompensationContext() {
  const result = await requirePeopleWriterContext();

  assertCan("compensation.write", result.context);

  return result;
}

async function getNextRegistrationForOrganization(organizationId: string) {
  const rows = await db
    .select({ registrationNumber: employees.registrationNumber })
    .from(employees)
    .where(eq(employees.organizationId, organizationId));

  return getNextRegistrationNumber(rows.map((row) => row.registrationNumber));
}

async function assertAreaPositionAndManager(
  input: {
    areaId: string;
    managerEmployeeId: string | null;
    positionId: string;
  },
  organizationId: string,
  currentEmployeeId?: string,
) {
  const [area] = await db
    .select({ id: areas.id })
    .from(areas)
    .where(and(eq(areas.id, input.areaId), eq(areas.organizationId, organizationId)))
    .limit(1);
  const [position] = await db
    .select({ id: positions.id })
    .from(positions)
    .where(and(eq(positions.id, input.positionId), eq(positions.organizationId, organizationId)))
    .limit(1);

  if (!area || !position) {
    throw new AccessDeniedError();
  }

  if (!input.managerEmployeeId) {
    return;
  }

  if (input.managerEmployeeId === currentEmployeeId) {
    throw new Error("Employee cannot manage themselves.");
  }

  await getEmployeeForWrite(input.managerEmployeeId, organizationId);
}

async function getEmployeeForWrite(id: string, organizationId: string) {
  const [employee] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.id, id), eq(employees.organizationId, organizationId), isNull(employees.deletedAt)))
    .limit(1);

  if (!employee) {
    throw new AccessDeniedError();
  }

  return employee;
}

async function getBenefitForWrite(id: string, employeeId: string, organizationId: string) {
  const [benefit] = await db
    .select()
    .from(employeeBenefits)
    .where(
      and(
        eq(employeeBenefits.id, id),
        eq(employeeBenefits.employeeId, employeeId),
        eq(employeeBenefits.organizationId, organizationId),
        isNull(employeeBenefits.deletedAt),
      ),
    )
    .limit(1);

  if (!benefit) {
    throw new AccessDeniedError();
  }

  return benefit;
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

function optionalEmailSchema() {
  return optionalTextSchema(160).refine(
    (value) => value === null || z.string().email().safeParse(value).success,
    { message: "Invalid email." },
  );
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

function optionalMoneySchema() {
  return z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? normalizeMoneyInput(value) : null));
}
