"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { employees, lifecycleChecklistItems, lifecycleChecklists } from "@/lib/db/schema";
import { getCurrentAccessContext, type AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCan } from "@/lib/rbac";

import { toDateKey } from "@/features/finance/rules";

import {
  defaultLifecycleChecklistItems,
  getLifecycleChecklistProgress,
  lifecycleChecklistItemStatusLabels,
  lifecycleTypeLabels,
  type LifecycleChecklistItemStatus,
  type LifecycleChecklistStatus,
  type LifecycleType,
} from "./rules";

type AuthorizedContext = AccessContext & { organizationId: string };

const lifecycleTypeSchema = z.enum(
  Object.keys(lifecycleTypeLabels) as [
    keyof typeof lifecycleTypeLabels,
    ...(keyof typeof lifecycleTypeLabels)[],
  ],
);
const lifecycleItemStatusSchema = z.enum(
  Object.keys(lifecycleChecklistItemStatusLabels) as [
    keyof typeof lifecycleChecklistItemStatusLabels,
    ...(keyof typeof lifecycleChecklistItemStatusLabels)[],
  ],
);
const createChecklistSchema = z.object({
  employeeId: z.string().uuid(),
  type: lifecycleTypeSchema,
  dueDate: optionalDateSchema(),
  notes: optionalTextSchema(1200),
});
const updateItemStatusSchema = z.object({
  id: z.string().uuid(),
  notes: optionalTextSchema(1000),
  status: lifecycleItemStatusSchema,
});
const idSchema = z.object({
  id: z.string().uuid(),
});

export async function createLifecycleChecklistAction(formData: FormData) {
  const context = await requireLifecycleWriterContext();
  const input = createChecklistSchema.parse(formDataToObject(formData));
  const employee = await getEmployeeForWrite(input.employeeId, context.organizationId);
  const existingOpen = await getOpenChecklist(
    input.employeeId,
    input.type,
    context.organizationId,
  );

  if (existingOpen) {
    throw new Error("An open checklist already exists for this employee and type.");
  }

  const [checklist] = await db
    .insert(lifecycleChecklists)
    .values({
      organizationId: context.organizationId,
      employeeId: input.employeeId,
      type: input.type,
      status: "open",
      dueDate: input.dueDate,
      createdByUserId: context.userId,
      notes: input.notes,
    })
    .returning();
  const itemDefinitions = defaultLifecycleChecklistItems[input.type];

  await db.insert(lifecycleChecklistItems).values(
    itemDefinitions.map((item, index) => ({
      checklistId: checklist.id,
      key: item.key,
      title: item.title,
      required: item.required,
      responsibleUserId: context.userId,
      dueDate: input.dueDate,
      sortOrder: index,
    })),
  );

  if (input.type === "offboarding" && employee.status !== "terminated") {
    await db
      .update(employees)
      .set({
        endDate: input.dueDate ?? employee.endDate,
        status: "notice",
        updatedAt: new Date(),
      })
      .where(eq(employees.id, employee.id));
  }

  await writeAuditLog(context, {
    action: "create",
    entityType: "lifecycle_checklist",
    entityId: checklist.id,
    after: checklist,
    metadata: {
      employeeId: input.employeeId,
      itemCount: itemDefinitions.length,
      type: input.type,
    },
  });

  revalidateLifecyclePaths(input.type);
}

export async function updateLifecycleChecklistItemStatusAction(formData: FormData) {
  const context = await requireLifecycleWriterContext();
  const input = updateItemStatusSchema.parse(formDataToObject(formData));
  const before = await getChecklistItemForWrite(input.id, context.organizationId);

  if (before.checklistStatus !== "open") {
    throw new Error("Checklist item cannot be changed after checklist closure.");
  }

  const resolved = input.status === "done" || input.status === "not_applicable";
  const [after] = await db
    .update(lifecycleChecklistItems)
    .set({
      completedAt: resolved ? new Date() : null,
      completedByUserId: resolved ? context.userId : null,
      notes: input.notes,
      responsibleUserId: context.userId,
      status: input.status,
      updatedAt: new Date(),
    })
    .where(eq(lifecycleChecklistItems.id, input.id))
    .returning();

  await writeAuditLog(context, {
    action: "status_change",
    entityType: "lifecycle_checklist_item",
    entityId: input.id,
    before,
    after,
    metadata: {
      checklistId: before.checklistId,
      status: input.status,
    },
  });

  revalidateLifecyclePaths(before.checklistType as LifecycleType);
}

export async function completeLifecycleChecklistAction(formData: FormData) {
  const context = await requireLifecycleWriterContext();
  const input = idSchema.parse(formDataToObject(formData));
  const before = await getChecklistForWrite(input.id, context.organizationId);
  const items = await getChecklistItems(input.id);
  const progress = getLifecycleChecklistProgress({
    items: items.map((item) => ({
      required: item.required,
      status: item.status as LifecycleChecklistItemStatus,
    })),
    status: before.status as LifecycleChecklistStatus,
  });

  if (!progress.canComplete) {
    throw new Error("Checklist cannot be completed with required pending items.");
  }

  const [after] = await db
    .update(lifecycleChecklists)
    .set({
      completedAt: new Date(),
      completedByUserId: context.userId,
      status: "completed",
      updatedAt: new Date(),
    })
    .where(eq(lifecycleChecklists.id, input.id))
    .returning();

  if (before.type === "offboarding") {
    await db
      .update(employees)
      .set({
        endDate: before.dueDate ?? toDateKey(new Date()),
        status: "terminated",
        updatedAt: new Date(),
      })
      .where(eq(employees.id, before.employeeId));
  }

  await writeAuditLog(context, {
    action: "status_change",
    entityType: "lifecycle_checklist",
    entityId: input.id,
    before,
    after,
    metadata: {
      status: "completed",
      type: before.type,
    },
  });

  revalidateLifecyclePaths(before.type as LifecycleType);
}

export async function cancelLifecycleChecklistAction(formData: FormData) {
  const context = await requireLifecycleWriterContext();
  const input = idSchema.parse(formDataToObject(formData));
  const before = await getChecklistForWrite(input.id, context.organizationId);
  const [after] = await db
    .update(lifecycleChecklists)
    .set({
      status: "cancelled",
      updatedAt: new Date(),
    })
    .where(eq(lifecycleChecklists.id, input.id))
    .returning();

  await writeAuditLog(context, {
    action: "status_change",
    entityType: "lifecycle_checklist",
    entityId: input.id,
    before,
    after,
    metadata: {
      status: "cancelled",
      type: before.type,
    },
  });

  revalidateLifecyclePaths(before.type as LifecycleType);
}

async function requireLifecycleWriterContext(): Promise<AuthorizedContext> {
  const context = await getCurrentAccessContext();

  if (!context) {
    redirect("/login");
  }

  assertCan("lifecycle.write", context);

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
    .select()
    .from(employees)
    .where(and(eq(employees.id, id), eq(employees.organizationId, organizationId), isNull(employees.deletedAt)))
    .limit(1);

  if (!employee) {
    throw new AccessDeniedError();
  }

  return employee;
}

async function getOpenChecklist(employeeId: string, type: LifecycleType, organizationId: string) {
  const [checklist] = await db
    .select({ id: lifecycleChecklists.id })
    .from(lifecycleChecklists)
    .where(
      and(
        eq(lifecycleChecklists.employeeId, employeeId),
        eq(lifecycleChecklists.organizationId, organizationId),
        eq(lifecycleChecklists.type, type),
        eq(lifecycleChecklists.status, "open"),
        isNull(lifecycleChecklists.deletedAt),
      ),
    )
    .limit(1);

  return checklist ?? null;
}

async function getChecklistForWrite(id: string, organizationId: string) {
  const [checklist] = await db
    .select()
    .from(lifecycleChecklists)
    .where(
      and(
        eq(lifecycleChecklists.id, id),
        eq(lifecycleChecklists.organizationId, organizationId),
        isNull(lifecycleChecklists.deletedAt),
      ),
    )
    .limit(1);

  if (!checklist) {
    throw new AccessDeniedError();
  }

  return checklist;
}

async function getChecklistItems(checklistId: string) {
  return db
    .select({
      required: lifecycleChecklistItems.required,
      status: lifecycleChecklistItems.status,
    })
    .from(lifecycleChecklistItems)
    .where(eq(lifecycleChecklistItems.checklistId, checklistId));
}

async function getChecklistItemForWrite(id: string, organizationId: string) {
  const [item] = await db
    .select({
      id: lifecycleChecklistItems.id,
      checklistId: lifecycleChecklistItems.checklistId,
      checklistStatus: lifecycleChecklists.status,
      checklistType: lifecycleChecklists.type,
      organizationId: lifecycleChecklists.organizationId,
      required: lifecycleChecklistItems.required,
      status: lifecycleChecklistItems.status,
    })
    .from(lifecycleChecklistItems)
    .innerJoin(lifecycleChecklists, eq(lifecycleChecklistItems.checklistId, lifecycleChecklists.id))
    .where(
      and(
        eq(lifecycleChecklistItems.id, id),
        eq(lifecycleChecklists.organizationId, organizationId),
        isNull(lifecycleChecklists.deletedAt),
      ),
    )
    .limit(1);

  if (!item) {
    throw new AccessDeniedError();
  }

  return item;
}

function revalidateLifecyclePaths(type: LifecycleType) {
  revalidatePath("/app");
  revalidatePath("/app/colaboradores/admissoes");
  revalidatePath("/app/colaboradores/desligamentos");

  if (type === "offboarding") {
    revalidatePath("/app/equipamentos");
    revalidatePath("/app/acessos");
  }
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
