"use server";

import { and, eq, isNull } from "drizzle-orm";
import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { clients, employees, graphicJobs, graphicProjects } from "@/lib/db/schema";
import { getCurrentAccessContext, runWithCurrentTenantDb } from "@/lib/dal";
import { enforceAuthenticatedRateLimit, withRateLimitActionResult } from "@/lib/rate-limit";
import { AccessDeniedError, assertCan } from "@/lib/rbac";
import { formDataToObject } from "@/lib/validation";

import {
  graphicJobDeleteSchema,
  graphicJobInputSchema,
  graphicJobUpdateSchema,
} from "./rules";

async function createGraphicJobEntryPoint(formData: FormData) {
  const destination = await runWithCurrentTenantDb(() => createGraphicJob(formData));
  redirect(destination as Route);
}

async function createGraphicJob(formData: FormData) {
  const { context, organizationId } = await requireWriter();
  const input = graphicJobInputSchema.parse(formDataToObject(formData));
  await validateOwnedReferences(input, organizationId);

  const [after] = await db
    .insert(graphicJobs)
    .values({ organizationId, ...input })
    .returning();

  await writeAuditLog(context, {
    action: "create",
    entityType: "graphic_job",
    entityId: after.id,
    after,
  });
  refresh(after.id);
  return `/app/grafica/${after.id}`;
}

async function updateGraphicJobEntryPoint(formData: FormData) {
  await runWithCurrentTenantDb(() => updateGraphicJob(formData));
}

async function updateGraphicJob(formData: FormData) {
  const { context, organizationId } = await requireWriter();
  const input = graphicJobUpdateSchema.parse(formDataToObject(formData));
  const before = await getOwnedJob(input.id, organizationId);
  const { id, ...values } = input;
  await validateOwnedReferences(values, organizationId);

  const [after] = await db
    .update(graphicJobs)
    .set({ ...values, updatedAt: new Date() })
    .where(
      and(
        eq(graphicJobs.id, id),
        eq(graphicJobs.organizationId, organizationId),
        isNull(graphicJobs.deletedAt),
      ),
    )
    .returning();

  if (!after) throw new AccessDeniedError();
  await writeAuditLog(context, {
    action: "update",
    entityType: "graphic_job",
    entityId: id,
    before,
    after,
  });
  refresh(id);
}

async function deleteGraphicJobEntryPoint(formData: FormData) {
  await runWithCurrentTenantDb(() => deleteGraphicJob(formData));
  redirect("/app/grafica" as Route);
}

async function deleteGraphicJob(formData: FormData) {
  const { context, organizationId } = await requireWriter();
  const input = graphicJobDeleteSchema.parse(formDataToObject(formData));
  const before = await getOwnedJob(input.id, organizationId);
  const now = new Date();
  const [after] = await db
    .update(graphicJobs)
    .set({ deletedAt: now, updatedAt: now })
    .where(
      and(
        eq(graphicJobs.id, input.id),
        eq(graphicJobs.organizationId, organizationId),
        isNull(graphicJobs.deletedAt),
      ),
    )
    .returning();

  if (!after) throw new AccessDeniedError();
  await writeAuditLog(context, {
    action: "delete",
    entityType: "graphic_job",
    entityId: input.id,
    before,
    after,
  });
  revalidatePath("/app/grafica");
}

async function requireWriter() {
  const context = await getCurrentAccessContext();
  if (!context) redirect("/login");
  assertCan("graphics.write", context);
  if (!context.organizationId) throw new AccessDeniedError();
  await enforceAuthenticatedRateLimit("common_mutation", context);
  return { context, organizationId: context.organizationId };
}

async function getOwnedJob(id: string, organizationId: string) {
  const [job] = await db
    .select()
    .from(graphicJobs)
    .where(and(eq(graphicJobs.id, id), eq(graphicJobs.organizationId, organizationId), isNull(graphicJobs.deletedAt)))
    .limit(1);
  if (!job) throw new AccessDeniedError();
  return job;
}

async function validateOwnedReferences(
  input: {
    clientId: string;
    responsibleEmployeeId: string;
    projectId: string | null;
  },
  organizationId: string,
) {
  const [client, responsible, project] = await Promise.all([
    db.select({ id: clients.id }).from(clients).where(and(eq(clients.id, input.clientId), eq(clients.organizationId, organizationId), isNull(clients.deletedAt))).limit(1),
    db.select({ id: employees.id }).from(employees).where(and(eq(employees.id, input.responsibleEmployeeId), eq(employees.organizationId, organizationId), isNull(employees.deletedAt))).limit(1),
    input.projectId
      ? db.select({ id: graphicProjects.id }).from(graphicProjects).where(and(eq(graphicProjects.id, input.projectId), eq(graphicProjects.organizationId, organizationId), isNull(graphicProjects.deletedAt))).limit(1)
      : Promise.resolve([{ id: null }]),
  ]);

  if (!client[0] || !responsible[0] || !project[0]) throw new AccessDeniedError();
}

function refresh(id: string) {
  revalidatePath("/app/grafica");
  revalidatePath(`/app/grafica/${id}`);
}

export const createGraphicJobAction = withRateLimitActionResult(createGraphicJobEntryPoint);
export const updateGraphicJobAction = withRateLimitActionResult(updateGraphicJobEntryPoint);
export const deleteGraphicJobAction = withRateLimitActionResult(deleteGraphicJobEntryPoint);
