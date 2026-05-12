"use server";

import { and, count, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { clients, employees } from "@/lib/db/schema";
import { getCurrentAccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCanAny } from "@/lib/rbac";

import { normalizeMoneyInput } from "@/features/finance/rules";

import { generateClientCode } from "./rules";

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

export async function createClientAction(formData: FormData) {
  const { context, organizationId } = await requireClientWriterContext();
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

  await writeAuditLog(context, {
    action: "create",
    entityType: "client",
    entityId: client.id,
    after: client,
  });

  revalidatePath("/app/clientes");
  redirect(`/app/clientes/${client.id}`);
}

export async function updateClientAction(formData: FormData) {
  const { context, organizationId } = await requireClientWriterContext();
  const input = updateClientSchema.parse(formDataToObject(formData));
  const before = await getClientForWrite(input.id, organizationId);
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

export async function updateClientStatusAction(formData: FormData) {
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
