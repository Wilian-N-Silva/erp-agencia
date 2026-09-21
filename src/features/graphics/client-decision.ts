import { and, desc, eq, isNull } from "drizzle-orm";
import { writeAuditLog } from "@/lib/audit";
import { db, withTenantDb } from "@/lib/db";
import { files, graphicClientDecisions, graphicJobs, graphicOsVersions, users } from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCan } from "@/lib/rbac";
import { createStorageKey, deleteStorageObject, getSha256Hex, putStorageObject, type StoredObject } from "@/lib/storage";
import { validateUploadMetadata } from "@/features/documents/rules";
import { canReadGraphicJobs, validateGraphicQuoteAttachmentContent } from "./rules";
import { canRecordClientDecision, clientDecisionSchema, clientDecisionStatus, GraphicFlowError } from "./client-decision-rules";

export async function recordClientDecision(context: AccessContext, raw: unknown, evidence?: File) {
  assertCan("graphics.client_approval_write", context);
  if (!context.organizationId) throw new AccessDeniedError();
  const organizationId = context.organizationId;
  const input = clientDecisionSchema.parse(raw);
  let prepared: { body: Buffer; extension: string; mimeType: string } | undefined;
  if (evidence) {
    if (!["application/pdf", "image/jpeg", "image/png"].includes(evidence.type)) throw new GraphicFlowError("A evidência deve ser PDF, JPG ou PNG.");
    const metadata = validateUploadMetadata({ originalName: evidence.name, mimeType: evidence.type, byteSize: evidence.size });
    const body = Buffer.from(await evidence.arrayBuffer());
    validateGraphicQuoteAttachmentContent(body, metadata.extension);
    prepared = { body, extension: metadata.extension, mimeType: metadata.normalizedMimeType };
  }
  let stored: StoredObject | undefined;
  try {
    return await withTenantDb(context, async () => {
      const [job] = await db.select().from(graphicJobs).where(and(eq(graphicJobs.id, input.jobId), eq(graphicJobs.organizationId, organizationId), isNull(graphicJobs.deletedAt))).for("update").limit(1);
      if (!job) throw new AccessDeniedError();
      if (!canRecordClientDecision(job.operationalStatus)) throw new GraphicFlowError("Este trabalho não está aguardando uma decisão do cliente. Atualize a página.");
      const [os] = await db.select().from(graphicOsVersions).where(and(eq(graphicOsVersions.organizationId, organizationId), eq(graphicOsVersions.jobId, job.id))).orderBy(desc(graphicOsVersions.version)).limit(1);
      if (!os || os.id !== input.osVersionId) throw new GraphicFlowError("A OS foi revisada. Atualize a página e confira a versão atual com o cliente.");
      const [previous] = await db.select().from(graphicClientDecisions).where(and(eq(graphicClientDecisions.organizationId, organizationId), eq(graphicClientDecisions.jobId, job.id))).orderBy(desc(graphicClientDecisions.createdAt), desc(graphicClientDecisions.id)).limit(1);
      if ((previous?.id ?? "") !== input.expectedDecisionId) throw new GraphicFlowError("Outra resposta já foi registrada. Atualize a página antes de continuar.");
      // A rejected document must first return through a revision request or a new OS.
      if (job.operationalStatus === "client_rejected" && input.decision !== "revision_requested") throw new GraphicFlowError("Para retomar uma OS recusada, registre primeiro a solicitação de alteração.");
      let fileId: string | null = null;
      if (prepared && evidence) {
        stored = await putStorageObject({ body: prepared.body, contentType: prepared.mimeType, key: createStorageKey({ fileName: evidence.name, organizationId, prefix: `graphics/client-decisions/${job.id}` }) });
        const [file] = await db.insert(files).values({ organizationId, storageProvider: stored.provider, bucket: stored.bucket, storageKey: stored.key,
          originalName: evidence.name, mimeType: prepared.mimeType, extension: prepared.extension, byteSize: prepared.body.length,
          sensitivity: "restricted", checksum: getSha256Hex(prepared.body), uploadedByUserId: context.userId }).returning();
        fileId = file.id;
      }
      const [decision] = await db.insert(graphicClientDecisions).values({ organizationId, jobId: job.id, osVersionId: os.id,
        decision: input.decision, contact: input.contact, channel: input.channel, decidedAt: input.decidedAt, notes: input.notes, fileId, createdByUserId: context.userId }).returning();
      const [after] = await db.update(graphicJobs).set({ operationalStatus: clientDecisionStatus(input.decision), updatedAt: new Date() }).where(and(eq(graphicJobs.organizationId, organizationId), eq(graphicJobs.id, job.id))).returning();
      await writeAuditLog(context, { action: "create", entityType: "graphic_client_decision", entityId: decision.id, before: previous ?? null, after: decision });
      await writeAuditLog(context, { action: "status_change", entityType: "graphic_job", entityId: job.id, before: job, after, metadata: { clientDecisionId: decision.id, osVersionId: os.id } });
      return decision;
    });
  } catch (error) {
    if (stored) await deleteStorageObject(stored);
    throw error;
  }
}

export async function getClientDecisions(context: AccessContext, jobId: string) {
  if (!context.organizationId || !canReadGraphicJobs(context)) throw new AccessDeniedError();
  return withTenantDb(context, () => db.select({ decision: graphicClientDecisions, osVersion: graphicOsVersions.version, actor: users.name })
    .from(graphicClientDecisions)
    .innerJoin(graphicJobs, and(eq(graphicJobs.id, graphicClientDecisions.jobId), eq(graphicJobs.organizationId, graphicClientDecisions.organizationId)))
    .innerJoin(graphicOsVersions, eq(graphicOsVersions.id, graphicClientDecisions.osVersionId))
    .innerJoin(users, eq(users.id, graphicClientDecisions.createdByUserId))
    .where(and(eq(graphicClientDecisions.organizationId, context.organizationId!), eq(graphicClientDecisions.jobId, jobId), isNull(graphicJobs.deletedAt)))
    .orderBy(desc(graphicClientDecisions.createdAt), desc(graphicClientDecisions.id)));
}

export async function getClientEvidence(context: AccessContext, jobId: string, decisionId: string) {
  if (!context.organizationId || !canReadGraphicJobs(context)) throw new AccessDeniedError();
  return withTenantDb(context, async () => {
    const [result] = await db.select({ file: files }).from(graphicClientDecisions)
      .innerJoin(graphicJobs, and(eq(graphicJobs.id, graphicClientDecisions.jobId), eq(graphicJobs.organizationId, graphicClientDecisions.organizationId)))
      .innerJoin(files, and(eq(files.id, graphicClientDecisions.fileId), eq(files.organizationId, graphicClientDecisions.organizationId)))
      .where(and(eq(graphicClientDecisions.id, decisionId), eq(graphicClientDecisions.jobId, jobId), eq(graphicClientDecisions.organizationId, context.organizationId!), isNull(graphicJobs.deletedAt), isNull(files.deletedAt))).limit(1);
    return result?.file ?? null;
  });
}
