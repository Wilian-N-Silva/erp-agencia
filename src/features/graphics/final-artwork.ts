import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, withTenantDb } from "@/lib/db";
import { documents, files, graphicJobs } from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCan } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { createStorageKey, deleteStorageObject, getSha256Hex, putStorageObject, type StoredObject } from "@/lib/storage";
import { validateUploadMetadata } from "@/features/documents/rules";
import { canReadGraphicJobs, validateGraphicQuoteAttachmentContent } from "./rules";
import { validateOsContent } from "./os-rules";

const inputSchema = z.strictObject({ jobId: z.string().uuid() });
const artworkType = "graphic_final_artwork";

export function validateFinalArtwork(upload: File, body?: Uint8Array) {
  if (!(upload instanceof File) || !["application/pdf", "image/png", "image/jpeg"].includes(upload.type)) {
    throw new Error("Anexe a arte final em PDF, PNG ou JPG.");
  }
  const metadata = validateUploadMetadata({ originalName: upload.name, mimeType: upload.type, byteSize: upload.size });
  if (body) {
    validateGraphicQuoteAttachmentContent(body, metadata.extension);
    if (metadata.extension === "pdf") validateOsContent(body);
  }
  return metadata;
}

export async function uploadFinalArtwork(context: AccessContext, raw: unknown, upload: File) {
  assertCan("graphics.production_write", context);
  if (!context.organizationId) throw new AccessDeniedError();
  const { jobId } = inputSchema.parse(raw);
  const metadata = validateFinalArtwork(upload);
  const body = Buffer.from(await upload.arrayBuffer());
  validateFinalArtwork(upload, body);
  let stored: StoredObject | undefined;
  try {
    return await withTenantDb(context, async () => {
      const [job] = await db.select().from(graphicJobs).where(and(eq(graphicJobs.id, jobId), eq(graphicJobs.organizationId, context.organizationId!), isNull(graphicJobs.deletedAt))).for("update").limit(1);
      if (!job) throw new AccessDeniedError();
      const [previous] = await db.select().from(documents).where(and(eq(documents.organizationId, context.organizationId!), eq(documents.ownerType, "graphic_job"), eq(documents.ownerId, jobId), eq(documents.documentType, artworkType))).orderBy(desc(documents.version)).limit(1);
      stored = await putStorageObject({ body, contentType: upload.type, key: createStorageKey({ fileName: upload.name, organizationId: context.organizationId!, prefix: `graphics/final/${jobId}` }) });
      const [file] = await db.insert(files).values({ organizationId: context.organizationId!, storageProvider: stored.provider, bucket: stored.bucket, storageKey: stored.key, originalName: upload.name, mimeType: upload.type, extension: metadata.extension, byteSize: body.length, sensitivity: "restricted", checksum: getSha256Hex(body), uploadedByUserId: context.userId }).returning();
      const [document] = await db.insert(documents).values({ organizationId: context.organizationId!, ownerType: "graphic_job", ownerId: jobId, documentType: artworkType, fileId: file.id, visibility: "restricted", version: (previous?.version ?? 0) + 1, uploadedByUserId: context.userId }).returning();
      await writeAuditLog(context, { action: "create", entityType: "graphic_final_artwork", entityId: document.id, before: previous ?? null, after: document, metadata: { jobId, fileId: file.id } });
      return document;
    });
  } catch (error) {
    if (stored) {
      try { await deleteStorageObject(stored); } catch { console.error("Final artwork storage rollback requires administrative cleanup."); }
    }
    throw error;
  }
}

export async function listFinalArtwork(context: AccessContext, jobId: string) {
  if (!context.organizationId || !canReadGraphicJobs(context)) throw new AccessDeniedError();
  z.string().uuid().parse(jobId);
  return withTenantDb(context, () => db.select({ document: documents, file: files }).from(documents)
    .innerJoin(graphicJobs, and(eq(graphicJobs.id, jobId), eq(graphicJobs.organizationId, documents.organizationId), isNull(graphicJobs.deletedAt)))
    .innerJoin(files, and(eq(files.id, documents.fileId), eq(files.organizationId, documents.organizationId), isNull(files.deletedAt)))
    .where(and(eq(documents.organizationId, context.organizationId!), eq(documents.ownerType, "graphic_job"), eq(documents.ownerId, jobId), eq(documents.documentType, artworkType), isNull(documents.deletedAt)))
    .orderBy(desc(documents.version)));
}

export async function getFinalArtworkDownload(context: AccessContext, jobId: string, documentId: string) {
  z.string().uuid().parse(documentId);
  const rows = await listFinalArtwork(context, jobId);
  return rows.find(row => row.document.id === documentId)?.file ?? null;
}
