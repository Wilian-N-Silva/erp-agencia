"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { employees, equipment } from "@/lib/db/schema";
import { getCurrentAccessContext, type AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCanAny } from "@/lib/rbac";

import {
  canAssignEquipmentStatus,
  canReturnEquipment,
  equipmentStatusLabels,
  equipmentStatusRequiresEmployee,
  getNextEquipmentAssetNumber,
  type EquipmentStatus,
} from "./rules";

type AuthorizedContext = AccessContext & { organizationId: string };

const equipmentStatusSchema = z.enum(
  Object.keys(equipmentStatusLabels) as [
    keyof typeof equipmentStatusLabels,
    ...(keyof typeof equipmentStatusLabels)[],
  ],
);
const equipmentBaseSchema = z.object({
  type: z.string().trim().min(1).max(80),
  brand: optionalTextSchema(80),
  model: optionalTextSchema(120),
  serialNumber: optionalTextSchema(120),
  status: equipmentStatusSchema,
  currentEmployeeId: optionalIdSchema(),
  notes: optionalTextSchema(1000),
});
const createEquipmentSchema = equipmentBaseSchema;
const updateEquipmentSchema = equipmentBaseSchema.extend({
  id: z.string().uuid(),
});
const assignEquipmentSchema = z.object({
  id: z.string().uuid(),
  employeeId: z.string().uuid(),
});
const equipmentNoteSchema = z.object({
  id: z.string().uuid(),
  notes: optionalTextSchema(1000),
});
const idSchema = z.object({
  id: z.string().uuid(),
});

export async function createEquipmentAction(formData: FormData) {
  const context = await requireEquipmentWriterContext();
  const input = createEquipmentSchema.parse(formDataToObject(formData));
  const currentEmployeeId = await normalizeCurrentEmployeeId(
    input.status,
    input.currentEmployeeId,
    context.organizationId,
  );
  const assetNumber = await getNextAssetNumber(context.organizationId);
  const [created] = await db
    .insert(equipment)
    .values({
      organizationId: context.organizationId,
      assetNumber,
      type: input.type,
      brand: input.brand,
      model: input.model,
      serialNumber: input.serialNumber,
      status: input.status,
      currentEmployeeId,
      notes: input.notes,
    })
    .returning();

  await writeAuditLog(context, {
    action: "create",
    entityType: "equipment",
    entityId: created.id,
    after: created,
  });

  revalidateEquipmentPaths();
}

export async function updateEquipmentAction(formData: FormData) {
  const context = await requireEquipmentWriterContext();
  const input = updateEquipmentSchema.parse(formDataToObject(formData));
  const before = await getEquipmentForWrite(input.id, context.organizationId);
  const currentEmployeeId = await normalizeCurrentEmployeeId(
    input.status,
    input.currentEmployeeId,
    context.organizationId,
  );
  const [after] = await db
    .update(equipment)
    .set({
      type: input.type,
      brand: input.brand,
      model: input.model,
      serialNumber: input.serialNumber,
      status: input.status,
      currentEmployeeId,
      notes: input.notes,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(equipment.id, input.id),
        eq(equipment.organizationId, context.organizationId),
        isNull(equipment.deletedAt),
      ),
    )
    .returning();

  await writeAuditLog(context, {
    action: "update",
    entityType: "equipment",
    entityId: input.id,
    before,
    after,
  });

  revalidateEquipmentPaths();
}

export async function assignEquipmentAction(formData: FormData) {
  const context = await requireEquipmentWriterContext();
  const input = assignEquipmentSchema.parse(formDataToObject(formData));
  const before = await getEquipmentForWrite(input.id, context.organizationId);

  if (!canAssignEquipmentStatus(before.status as EquipmentStatus)) {
    throw new Error("Equipment cannot be assigned from current status.");
  }

  await getEmployeeForWrite(input.employeeId, context.organizationId);
  const [after] = await db
    .update(equipment)
    .set({
      currentEmployeeId: input.employeeId,
      status: "in_use",
      updatedAt: new Date(),
    })
    .where(eq(equipment.id, input.id))
    .returning();

  await writeAuditLog(context, {
    action: "status_change",
    entityType: "equipment",
    entityId: input.id,
    before,
    after,
    metadata: {
      assignedToEmployeeId: input.employeeId,
      status: "in_use",
    },
  });

  revalidateEquipmentPaths();
}

export async function returnEquipmentAction(formData: FormData) {
  const context = await requireEquipmentWriterContext();
  const input = equipmentNoteSchema.parse(formDataToObject(formData));
  const before = await getEquipmentForWrite(input.id, context.organizationId);

  if (
    !canReturnEquipment({
      currentEmployeeId: before.currentEmployeeId,
      status: before.status as EquipmentStatus,
    })
  ) {
    throw new Error("Equipment cannot be returned from current status.");
  }

  const [after] = await db
    .update(equipment)
    .set({
      currentEmployeeId: null,
      notes: appendOperationalNote(before.notes, input.notes, "Devolucao"),
      status: "available",
      updatedAt: new Date(),
    })
    .where(eq(equipment.id, input.id))
    .returning();

  await writeAuditLog(context, {
    action: "status_change",
    entityType: "equipment",
    entityId: input.id,
    before,
    after,
    metadata: {
      status: "available",
    },
  });

  revalidateEquipmentPaths();
}

export async function markEquipmentMaintenanceAction(formData: FormData) {
  const context = await requireEquipmentWriterContext();
  const input = equipmentNoteSchema.parse(formDataToObject(formData));
  const before = await getEquipmentForWrite(input.id, context.organizationId);
  const [after] = await db
    .update(equipment)
    .set({
      currentEmployeeId: null,
      notes: appendOperationalNote(before.notes, input.notes, "Manutencao"),
      status: "maintenance",
      updatedAt: new Date(),
    })
    .where(eq(equipment.id, input.id))
    .returning();

  await writeAuditLog(context, {
    action: "status_change",
    entityType: "equipment",
    entityId: input.id,
    before,
    after,
    metadata: {
      status: "maintenance",
    },
  });

  revalidateEquipmentPaths();
}

export async function retireEquipmentAction(formData: FormData) {
  const context = await requireEquipmentWriterContext();
  const input = idSchema.parse(formDataToObject(formData));
  const before = await getEquipmentForWrite(input.id, context.organizationId);
  const [after] = await db
    .update(equipment)
    .set({
      currentEmployeeId: null,
      status: "retired",
      updatedAt: new Date(),
    })
    .where(eq(equipment.id, input.id))
    .returning();

  await writeAuditLog(context, {
    action: "status_change",
    entityType: "equipment",
    entityId: input.id,
    before,
    after,
    metadata: {
      status: "retired",
    },
  });

  revalidateEquipmentPaths();
}

async function requireEquipmentWriterContext(): Promise<AuthorizedContext> {
  const context = await getCurrentAccessContext();

  if (!context) {
    redirect("/login");
  }

  assertCanAny(["equipment.write", "equipment.configure"], context);

  if (!context.organizationId) {
    throw new AccessDeniedError();
  }

  return {
    ...context,
    organizationId: context.organizationId,
  };
}

async function normalizeCurrentEmployeeId(
  status: EquipmentStatus,
  currentEmployeeId: string | null,
  organizationId: string,
) {
  if (equipmentStatusRequiresEmployee(status) && !currentEmployeeId) {
    throw new Error("Equipment in use must have a responsible employee.");
  }

  if (!currentEmployeeId || status === "available" || status === "maintenance" || status === "retired") {
    return null;
  }

  const employee = await getEmployeeForWrite(currentEmployeeId, organizationId);

  return employee.id;
}

async function getNextAssetNumber(organizationId: string) {
  const rows = await db
    .select({ assetNumber: equipment.assetNumber })
    .from(equipment)
    .where(eq(equipment.organizationId, organizationId));

  return getNextEquipmentAssetNumber(rows.map((row) => row.assetNumber));
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

async function getEquipmentForWrite(id: string, organizationId: string) {
  const [row] = await db
    .select()
    .from(equipment)
    .where(and(eq(equipment.id, id), eq(equipment.organizationId, organizationId), isNull(equipment.deletedAt)))
    .limit(1);

  if (!row) {
    throw new AccessDeniedError();
  }

  return row;
}

function appendOperationalNote(current: string | null, note: string | null, prefix: string) {
  if (!note) {
    return current;
  }

  const stampedNote = `${prefix}: ${note}`;

  return current ? `${current}\n${stampedNote}` : stampedNote;
}

function revalidateEquipmentPaths() {
  revalidatePath("/app");
  revalidatePath("/app/equipamentos");
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
