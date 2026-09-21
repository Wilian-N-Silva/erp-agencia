import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";

import { writeAuditLog } from "@/lib/audit";
import { bindTenantContext, db } from "@/lib/db";
import { employees, users, workItems } from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCanAny } from "@/lib/rbac";

import {
  canResolveWorkItem,
  generateWorkItemInputSchema,
  resolveWorkItemInputSchema,
  type GenerateWorkItemInput,
  type ResolveWorkItemInput,
  type WorkItemStatus,
} from "./rules";

type TenantAccessContext = AccessContext & { organizationId: string };

export type ActionableWorkItemListItem = {
  id: string;
  title: string;
  description: string;
  kind: string;
  sourceType: string;
  sourceId: string;
  assignedUserId: string | null;
  assignedEmployeeId: string | null;
  ownerName: string | null;
  dueAt: Date | null;
  priority: (typeof workItems.$inferSelect)["priority"];
  status: Extract<(typeof workItems.$inferSelect)["status"], "open" | "in_progress">;
  createdAt: Date;
};

async function listActionableWorkItemsOperation(
  context: AccessContext,
): Promise<ActionableWorkItemListItem[]> {
  assertCanAny(["alerts.read", "alerts.write"], context);
  const organizationId = requireOrganizationId(context);
  const rows = await db
    .select({
      id: workItems.id,
      title: workItems.title,
      description: workItems.description,
      kind: workItems.kind,
      sourceType: workItems.sourceType,
      sourceId: workItems.sourceId,
      assignedUserId: workItems.assignedUserId,
      assignedEmployeeId: workItems.assignedEmployeeId,
      assignedUserName: users.name,
      assignedEmployeeName: employees.fullName,
      dueAt: workItems.dueAt,
      priority: workItems.priority,
      status: workItems.status,
      createdAt: workItems.createdAt,
    })
    .from(workItems)
    .leftJoin(
      users,
      and(
        eq(workItems.assignedUserId, users.id),
        eq(users.organizationId, organizationId),
      ),
    )
    .leftJoin(
      employees,
      and(
        eq(workItems.assignedEmployeeId, employees.id),
        eq(employees.organizationId, organizationId),
      ),
    )
    .where(
      and(
        eq(workItems.organizationId, organizationId),
        inArray(workItems.status, ["open", "in_progress"]),
      ),
    )
    .orderBy(desc(workItems.priority), asc(workItems.dueAt), desc(workItems.createdAt));

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    kind: row.kind,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    assignedUserId: row.assignedUserId,
    assignedEmployeeId: row.assignedEmployeeId,
    ownerName: row.assignedUserName ?? row.assignedEmployeeName,
    dueAt: row.dueAt,
    priority: row.priority,
    status: row.status as ActionableWorkItemListItem["status"],
    createdAt: row.createdAt,
  }));
}

async function generateWorkItemOperation(
  context: AccessContext,
  input: GenerateWorkItemInput,
) {
  const tenantContext = requireWorkItemDomainContext(context);
  const parsedInput = generateWorkItemInputSchema.parse(input);

  await validateOwner(tenantContext, parsedInput);

  const [created] = await db
    .insert(workItems)
    .values({
      organizationId: tenantContext.organizationId,
      ...parsedInput,
    })
    .onConflictDoNothing({
      target: [
        workItems.organizationId,
        workItems.kind,
        workItems.sourceType,
        workItems.sourceId,
        workItems.occurrenceKey,
      ],
    })
    .returning();

  const item =
    created ??
    (await getWorkItemByOccurrence(tenantContext, parsedInput));

  if (!item) {
    throw new Error("Work item could not be generated.");
  }

  if (created) {
    await writeAuditLog(tenantContext, {
      action: "create",
      entityType: "work_item",
      entityId: created.id,
      after: created,
      metadata: {
        kind: created.kind,
        occurrenceKey: created.occurrenceKey,
        sourceId: created.sourceId,
        sourceType: created.sourceType,
      },
    });
  }

  return { created: Boolean(created), item };
}

async function resolveWorkItemOperation(
  context: AccessContext,
  input: ResolveWorkItemInput,
) {
  const tenantContext = requireWorkItemDomainContext(context);
  const parsedInput = resolveWorkItemInputSchema.parse(input);
  const before = await getWorkItemForWrite(
    tenantContext,
    parsedInput.id,
  );

  if (!canResolveWorkItem(before.status as WorkItemStatus)) {
    throw new Error("Only open or in-progress work items can be resolved.");
  }

  const now = new Date();
  const [after] = await db
    .update(workItems)
    .set({
      resolution: parsedInput.resolution,
      resolvedAt: now,
      resolvedByUserId: tenantContext.userId,
      status: "resolved",
      updatedAt: now,
    })
    .where(
      and(
        eq(workItems.id, parsedInput.id),
        eq(workItems.organizationId, tenantContext.organizationId),
        inArray(workItems.status, ["open", "in_progress"]),
      ),
    )
    .returning();

  if (!after) {
    throw new Error("Work item state changed before it could be resolved.");
  }

  await writeAuditLog(tenantContext, {
    action: "status_change",
    entityType: "work_item",
    entityId: after.id,
    before,
    after,
    metadata: { status: "resolved" },
  });

  return after;
}

async function validateOwner(
  context: TenantAccessContext,
  input: {
    assignedEmployeeId: string | null;
    assignedUserId: string | null;
  },
) {
  if (input.assignedUserId) {
    const [owner] = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.id, input.assignedUserId),
          eq(users.organizationId, context.organizationId),
          eq(users.accessStatus, "active"),
          eq(users.isActive, true),
        ),
      )
      .limit(1);

    if (!owner) {
      throw new AccessDeniedError();
    }
  }

  if (input.assignedEmployeeId) {
    const [owner] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(
        and(
          eq(employees.id, input.assignedEmployeeId),
          eq(employees.organizationId, context.organizationId),
          isNull(employees.deletedAt),
        ),
      )
      .limit(1);

    if (!owner) {
      throw new AccessDeniedError();
    }
  }
}

async function getWorkItemByOccurrence(
  context: TenantAccessContext,
  input: {
    kind: string;
    occurrenceKey: string;
    sourceId: string;
    sourceType: string;
  },
) {
  const [item] = await db
    .select()
    .from(workItems)
    .where(
      and(
        eq(workItems.organizationId, context.organizationId),
        eq(workItems.kind, input.kind),
        eq(workItems.sourceType, input.sourceType),
        eq(workItems.sourceId, input.sourceId),
        eq(workItems.occurrenceKey, input.occurrenceKey),
      ),
    )
    .limit(1);

  return item;
}

async function getWorkItemForWrite(
  context: TenantAccessContext,
  id: string,
) {
  const [item] = await db
    .select()
    .from(workItems)
    .where(
      and(
        eq(workItems.id, id),
        eq(workItems.organizationId, context.organizationId),
      ),
    )
    .limit(1);

  if (!item) {
    throw new AccessDeniedError();
  }

  return item;
}

/**
 * Domain primitive boundary. The calling domain must authorize its mutation
 * before invoking this DAL; public Actions must not expose it directly.
 * Tenant identity remains mandatory here and is also enforced by RLS through
 * bindTenantContext.
 */
function requireWorkItemDomainContext(
  context: AccessContext,
): TenantAccessContext {
  if (!context.organizationId) {
    throw new AccessDeniedError();
  }

  return { ...context, organizationId: context.organizationId };
}

function requireOrganizationId(context: AccessContext) {
  if (!context.organizationId) {
    throw new AccessDeniedError();
  }

  return context.organizationId;
}

export const generateWorkItem = bindTenantContext(generateWorkItemOperation);
export const resolveWorkItem = bindTenantContext(resolveWorkItemOperation);
export const listActionableWorkItems = bindTenantContext(
  listActionableWorkItemsOperation,
);
