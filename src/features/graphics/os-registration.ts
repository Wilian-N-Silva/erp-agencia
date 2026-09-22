import { and, desc, eq, isNull } from "drizzle-orm";
import { writeAuditLog } from "@/lib/audit";
import { db, withTenantDb } from "@/lib/db";
import { files, graphicJobs, graphicOsVersions, graphicSupplierQuotes } from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCan } from "@/lib/rbac";
import { createStorageKey, deleteStorageObject, getSha256Hex, putStorageObject, type StoredObject } from "@/lib/storage";
import { canRegisterOs, graphicOsInputSchema, validateOsContent, validateOsUpload } from "./os-rules";

export async function registerGraphicOs(context: AccessContext, rawInput: unknown, upload: File) {
  assertCan("graphics.write", context);
  if (!context.organizationId) throw new AccessDeniedError();
  const organizationId = context.organizationId;
  const input = graphicOsInputSchema.parse(rawInput);
  validateOsUpload(upload);
  const body = Buffer.from(await upload.arrayBuffer());
  validateOsContent(body);
  const uploaded: StoredObject[] = [];
  try {
    return await withTenantDb(context, async () => {
      const [job] = await db.select().from(graphicJobs).where(and(
        eq(graphicJobs.id, input.jobId), eq(graphicJobs.organizationId, organizationId), isNull(graphicJobs.deletedAt),
      )).for("update").limit(1);
      if (!job) throw new AccessDeniedError();
      if (!canRegisterOs(job.operationalStatus)) throw new Error("A OS só pode ser registrada após aprovação interna e antes da aprovação do cliente.");
      const [approved] = await db.select({ id: graphicSupplierQuotes.id }).from(graphicSupplierQuotes).where(and(
        eq(graphicSupplierQuotes.jobId, job.id), eq(graphicSupplierQuotes.organizationId, organizationId), eq(graphicSupplierQuotes.status, "approved"),
      )).limit(1);
      if (!approved) throw new Error("Aprove uma cotação de fornecedor antes de registrar a OS.");
      const [previous] = await db.select().from(graphicOsVersions).where(and(
        eq(graphicOsVersions.jobId, job.id), eq(graphicOsVersions.organizationId, organizationId),
      )).orderBy(desc(graphicOsVersions.version)).limit(1);
      if ((previous?.version ?? 0) !== input.expectedVersion) throw new Error("A OS foi alterada. Atualize a página antes de registrar outra versão.");
      const stored = await putStorageObject({ body, contentType: "application/pdf", key: createStorageKey({
        fileName: upload.name, organizationId, prefix: `graphics/os/${job.id}`,
      }) });
      uploaded.push(stored);
      const [file] = await db.insert(files).values({
        organizationId, storageProvider: stored.provider, bucket: stored.bucket, storageKey: stored.key,
        originalName: upload.name, mimeType: "application/pdf", extension: "pdf", byteSize: body.length,
        sensitivity: "restricted", checksum: getSha256Hex(body), uploadedByUserId: context.userId,
      }).returning();
      const [version] = await db.insert(graphicOsVersions).values({
        organizationId, jobId: job.id, version: (previous?.version ?? 0) + 1,
        externalNumber: input.externalNumber, issuedAt: input.issuedAt, presentedAmount: input.presentedAmount,
        revisionReason: input.revisionReason || null, fileId: file.id, createdByUserId: context.userId,
      }).returning();
      const [after] = await db.update(graphicJobs).set({ operationalStatus: "client_approval_pending", updatedAt: new Date() })
        .where(and(eq(graphicJobs.id, job.id), eq(graphicJobs.organizationId, organizationId))).returning();
      await writeAuditLog(context, { action: "create", entityType: "graphic_os_version", entityId: version.id,
        before: previous ?? null, after: version, metadata: { jobId: job.id } });
      await writeAuditLog(context, { action: "status_change", entityType: "graphic_job", entityId: job.id,
        before: job, after, metadata: { osVersionId: version.id, version: version.version } });
      return version;
    });
  } catch (error) {
    const cleanup = await Promise.allSettled(uploaded.map(object => deleteStorageObject(object)));
    if (cleanup.some(result => result.status === "rejected")) console.error("OS storage rollback incomplete; administrative cleanup required.");
    throw error;
  }
}
