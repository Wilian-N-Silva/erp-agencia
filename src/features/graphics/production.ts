import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { writeAuditLog } from "@/lib/audit";
import { db, withTenantDb } from "@/lib/db";
import { employees, graphicClientDecisions, graphicJobs, graphicOsVersions, graphicProductionEvents, workItems } from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCan } from "@/lib/rbac";
import { generateWorkItem, resolveWorkItem } from "@/features/work-items/dal";
import { canReadGraphicJobs } from "./rules";
import { GraphicFlowError } from "./client-decision-rules";
import { productionInputSchema, productionNextStatuses, waitingReasonLabels } from "./production-rules";

export async function advanceGraphicProduction(context: AccessContext, raw: unknown) {
  assertCan("graphics.production_write", context);
  if (!context.organizationId) throw new AccessDeniedError();
  const organizationId = context.organizationId;
  const input = productionInputSchema.parse(raw);
  return withTenantDb(context, async () => {
    const [job] = await db.select().from(graphicJobs).where(and(eq(graphicJobs.id, input.jobId), eq(graphicJobs.organizationId, organizationId), isNull(graphicJobs.deletedAt))).for("update").limit(1);
    if (!job) throw new AccessDeniedError();
    const [previous] = await db.select().from(graphicProductionEvents).where(and(eq(graphicProductionEvents.jobId, job.id), eq(graphicProductionEvents.organizationId, organizationId))).orderBy(desc(graphicProductionEvents.createdAt), desc(graphicProductionEvents.id)).limit(1);
    if (job.operationalStatus !== input.expectedStatus || (previous?.id ?? "") !== input.expectedEventId) throw new GraphicFlowError("O trabalho foi atualizado. Recarregue a página para conferir a etapa atual.");
    if (!productionNextStatuses(job.operationalStatus, previous?.fromStatus).includes(input.toStatus)) throw new GraphicFlowError("Esta mudança não está disponível para a etapa atual.");
    const [owner] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.id, input.responsibleEmployeeId), eq(employees.organizationId, organizationId), isNull(employees.deletedAt))).limit(1);
    if (!owner) throw new AccessDeniedError();
    const [os] = await db.select({ id: graphicOsVersions.id }).from(graphicOsVersions).where(and(eq(graphicOsVersions.jobId, job.id), eq(graphicOsVersions.organizationId, organizationId))).orderBy(desc(graphicOsVersions.version)).limit(1);
    const [decision] = await db.select().from(graphicClientDecisions).where(and(eq(graphicClientDecisions.jobId, job.id), eq(graphicClientDecisions.organizationId, organizationId))).orderBy(desc(graphicClientDecisions.createdAt), desc(graphicClientDecisions.id)).limit(1);
    if (!os || decision?.osVersionId !== os.id || decision.decision !== "approved") throw new GraphicFlowError("A produção exige aprovação do cliente sobre a versão atual da OS.");
    const [event] = await db.insert(graphicProductionEvents).values({ organizationId, jobId: job.id, fromStatus: job.operationalStatus, toStatus: input.toStatus,
      waitingReason: input.toStatus === "waiting" ? input.waitingReason : null, responsibleEmployeeId: owner.id, dueAt: input.dueAt || null, notes: input.notes, createdByUserId: context.userId }).returning();
    const [after] = await db.update(graphicJobs).set({ operationalStatus: input.toStatus, responsibleEmployeeId: owner.id, updatedAt: new Date() }).where(and(eq(graphicJobs.id, job.id), eq(graphicJobs.organizationId, organizationId))).returning();
    if (job.operationalStatus === "waiting") {
      const pending = await db.select({ id: workItems.id }).from(workItems).where(and(eq(workItems.organizationId, organizationId), eq(workItems.sourceType, "graphic_job"), eq(workItems.sourceId, job.id), eq(workItems.kind, "graphic_production_waiting"), inArray(workItems.status, ["open", "in_progress"])));
      for (const item of pending) await resolveWorkItem(context, { id: item.id, resolution: input.notes || "Bloqueio resolvido; trabalho retomado." });
    }
    if (input.toStatus === "waiting") await generateWorkItem(context, { kind: "graphic_production_waiting", sourceType: "graphic_job", sourceId: job.id, occurrenceKey: event.id,
      title: `Desbloquear ${job.internalCode}`.slice(0, 200), description: `Aguardando ${waitingReasonLabels[input.waitingReason as keyof typeof waitingReasonLabels]}. ${input.notes}`.slice(0, 2000),
      assignedEmployeeId: owner.id, dueAt: input.dueAt ? new Date(`${input.dueAt}T12:00:00Z`) : null, priority: "high" });
    await writeAuditLog(context, { action: "create", entityType: "graphic_production_event", entityId: event.id, after: event });
    await writeAuditLog(context, { action: "status_change", entityType: "graphic_job", entityId: job.id, before: job, after, metadata: { productionEventId: event.id } });
    return event;
  });
}

export async function getGraphicProduction(context: AccessContext, jobId: string) {
  if (!context.organizationId || !canReadGraphicJobs(context)) throw new AccessDeniedError();
  return withTenantDb(context, () => db.select({ event: graphicProductionEvents, owner: employees.fullName }).from(graphicProductionEvents)
    .innerJoin(graphicJobs, and(eq(graphicJobs.id, graphicProductionEvents.jobId), eq(graphicJobs.organizationId, graphicProductionEvents.organizationId)))
    .innerJoin(employees, and(eq(employees.id, graphicProductionEvents.responsibleEmployeeId), eq(employees.organizationId, graphicProductionEvents.organizationId)))
    .where(and(eq(graphicProductionEvents.organizationId, context.organizationId!), eq(graphicProductionEvents.jobId, jobId), isNull(graphicJobs.deletedAt)))
    .orderBy(desc(graphicProductionEvents.createdAt), desc(graphicProductionEvents.id)));
}
