import { and, eq, inArray, isNull } from "drizzle-orm";

import { writeAuditLog } from "@/lib/audit";
import { bindTenantContext, db } from "@/lib/db";
import { employees, users, workItems } from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCan } from "@/lib/rbac";

import {
  canResolveWorkItem,
  generateWorkItemInputSchema,
  resolveWorkItemInputSchema,
  type GenerateWorkItemInput,
  type ResolveWorkItemInput,
  type WorkItemStatus,
} from "./rules";

type AuthorizedContext = AccessContext & { organizationId: string };

async function generateWorkItemOperation(
  context: AccessContext,
  input: GenerateWorkItemInput,
) {
  const authorizedContext = requireWorkItemWriter(context);
  const parsedInput = generateWorkItemInputSchema.parse(input);

  await validateOwner(authorizedContext, parsedInput);

  const [created] = await db
    .insert(workItems)
    .values({
      organizationId: authorizedContext.organizationId,
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
    (await getWorkItemByOccurrence(authorizedContext, parsedInput));

  if (!item) {
    throw new Error("Work item could not be generated.");
  }

  if (created) {
    await writeAuditLog(authorizedContext, {
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
  const authorizedContext = requireWorkItemWriter(context);
  const parsedInput = resolveWorkItemInputSchema.parse(input);
  const before = await getWorkItemForWrite(
    authorizedContext,
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
      resolvedByUserId: authorizedContext.userId,
      status: "resolved",
      updatedAt: now,
    })
    .where(
      and(
        eq(workItems.id, parsedInput.id),
        eq(workItems.organizationId, authorizedContext.organizationId),
        inArray(workItems.status, ["open", "in_progress"]),
      ),
    )
    .returning();

  if (!after) {
    throw new Error("Work item state changed before it could be resolved.");
  }

  await writeAuditLog(authorizedContext, {
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
  context: AuthorizedContext,
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
  context: AuthorizedContext,
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
  context: AuthorizedContext,
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

function requireWorkItemWriter(
  context: AccessContext,
): AuthorizedContext {
  assertCan("alerts.write", context);

  if (!context.organizationId) {
    throw new AccessDeniedError();
  }

  return { ...context, organizationId: context.organizationId };
}

export const generateWorkItem = bindTenantContext(generateWorkItemOperation);
export const resolveWorkItem = bindTenantContext(resolveWorkItemOperation);
