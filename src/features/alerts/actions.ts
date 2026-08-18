"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { alerts } from "@/lib/db/schema";
import {
  bindCurrentTenantContext,
  getCurrentAccessContext,
  type AccessContext,
} from "@/lib/dal";
import { AccessDeniedError, assertCan } from "@/lib/rbac";

import { generateAlertCandidatesForOrganization } from "./dal";
import { getAlertKey, type AlertStatus } from "./rules";

type AuthorizedContext = AccessContext & { organizationId: string };

const idSchema = z.object({
  id: z.string().uuid(),
});

async function generateAlertsAction() {
  const context = await requireAlertsWriterContext();
  const candidates = await generateAlertCandidatesForOrganization(context);
  const existingRows = await db
    .select({
      entityId: alerts.entityId,
      entityType: alerts.entityType,
      title: alerts.title,
    })
    .from(alerts)
    .where(eq(alerts.organizationId, context.organizationId));
  const existingKeys = new Set(
    existingRows
      .filter((row): row is { entityId: string; entityType: string; title: string } =>
        Boolean(row.entityId),
      )
      .map(getAlertKey),
  );
  const newCandidates = candidates.filter((candidate) => !existingKeys.has(getAlertKey(candidate)));

  if (newCandidates.length > 0) {
    await db.insert(alerts).values(
      newCandidates.map((candidate) => ({
        organizationId: context.organizationId,
        title: candidate.title,
        description: candidate.description,
        severity: candidate.severity,
        entityType: candidate.entityType,
        entityId: candidate.entityId,
        dueDate: candidate.dueDate,
        status: "open" as const,
      })),
    );
  }

  await writeAuditLog(context, {
    action: "create",
    entityType: "alert",
    metadata: {
      candidateCount: candidates.length,
      insertedCount: newCandidates.length,
    },
  });

  revalidateAlertsPaths();
}

async function resolveAlertAction(formData: FormData) {
  await updateAlertStatus(formData, "resolved");
}

async function dismissAlertAction(formData: FormData) {
  await updateAlertStatus(formData, "dismissed");
}

async function updateAlertStatus(formData: FormData, status: Exclude<AlertStatus, "open">) {
  const context = await requireAlertsWriterContext();
  const input = idSchema.parse(Object.fromEntries(formData.entries()));
  const before = await getAlertForWrite(input.id, context.organizationId);
  const [after] = await db
    .update(alerts)
    .set({
      resolvedAt: new Date(),
      resolvedByUserId: context.userId,
      status,
      updatedAt: new Date(),
    })
    .where(and(eq(alerts.id, input.id), eq(alerts.organizationId, context.organizationId)))
    .returning();

  await writeAuditLog(context, {
    action: "status_change",
    entityType: "alert",
    entityId: input.id,
    before,
    after,
    metadata: {
      status,
    },
  });

  revalidateAlertsPaths();
}

async function requireAlertsWriterContext(): Promise<AuthorizedContext> {
  const context = await getCurrentAccessContext();

  if (!context) {
    redirect("/login");
  }

  assertCan("alerts.write", context);

  if (!context.organizationId) {
    throw new AccessDeniedError();
  }

  return {
    ...context,
    organizationId: context.organizationId,
  };
}

async function getAlertForWrite(id: string, organizationId: string) {
  const [alert] = await db
    .select()
    .from(alerts)
    .where(and(eq(alerts.id, id), eq(alerts.organizationId, organizationId)))
    .limit(1);

  if (!alert) {
    throw new AccessDeniedError();
  }

  return alert;
}

function revalidateAlertsPaths() {
  revalidatePath("/app");
  revalidatePath("/app/alertas");
}

export {
  tenantGenerateAlertsAction as generateAlertsAction,
  tenantResolveAlertAction as resolveAlertAction,
  tenantDismissAlertAction as dismissAlertAction,
};

const tenantGenerateAlertsAction = bindCurrentTenantContext(generateAlertsAction);
const tenantResolveAlertAction = bindCurrentTenantContext(resolveAlertAction);
const tenantDismissAlertAction = bindCurrentTenantContext(dismissAlertAction);
