import { and, desc, eq, isNull } from "drizzle-orm";
import { withTenantDb } from "@/lib/db";
import { documents, files, financialEntries, financialExpenses, financialTransactions } from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCan } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { createStorageKey, deleteStorageObject, getSha256Hex, putStorageObject, type StoredObject } from "@/lib/storage";
import { attachmentOwnerSchema, canReadFinancialAttachments, financialAttachmentSchema, validateFinancialAttachment, type FinancialDocumentOwner } from "./attachment-rules";

export async function getFinancialAttachmentOwner(context: AccessContext, raw: unknown, options: { forUpload?: boolean } = {}) {
  if (!context.organizationId || !canReadFinancialAttachments(context)) throw new AccessDeniedError();
  const input = attachmentOwnerSchema.parse(raw);
  return withTenantDb(context, async tx => {
    const table = input.ownerType === "financial_entry" ? financialEntries : input.ownerType === "financial_expense" ? financialExpenses : financialTransactions;
    const query = tx.select().from(table).where(and(eq(table.id, input.ownerId), eq(table.organizationId, context.organizationId!)));
    const [owner] = options.forUpload ? await query.for("update").limit(1) : await query.limit(1);
    if (!owner || (options.forUpload && "deletedAt" in owner && owner.deletedAt)) throw new AccessDeniedError();
    return { ...input, description: "description" in owner ? owner.description : owner.reference ?? "Movimentação financeira", amount: owner.amount };
  });
}

export async function listFinancialAttachments(context: AccessContext, raw: unknown) {
  const input = attachmentOwnerSchema.parse(raw);
  return withTenantDb(context, async tx => {
    await getFinancialAttachmentOwner(context, input);
    return tx.select({ document: documents, file: files }).from(documents)
      .innerJoin(files, and(eq(files.id, documents.fileId), eq(files.organizationId, documents.organizationId), isNull(files.deletedAt)))
      .where(and(eq(documents.organizationId, context.organizationId!), eq(documents.ownerType, input.ownerType), eq(documents.ownerId, input.ownerId), isNull(documents.deletedAt)))
      .orderBy(desc(documents.createdAt), desc(documents.version));
  });
}

export async function uploadFinancialAttachment(context: AccessContext, raw: unknown, upload: File) {
  assertCan("finance.write", context);
  if (!context.organizationId) throw new AccessDeniedError();
  const input = financialAttachmentSchema.parse(raw);
  if (!(upload instanceof File)) throw new Error("Selecione um arquivo.");
  const metadata = { originalName: upload.name, mimeType: upload.type, byteSize: upload.size };
  const validated = validateFinancialAttachment(metadata);
  const body = Buffer.from(await upload.arrayBuffer());
  validateFinancialAttachment(metadata, body);
  let stored: StoredObject | undefined;
  try {
    return await withTenantDb(context, async tx => {
      await getFinancialAttachmentOwner(context, { ownerType: input.ownerType, ownerId: input.ownerId }, { forUpload: true });
      const [previous] = await tx.select().from(documents).where(and(eq(documents.organizationId, context.organizationId!), eq(documents.ownerType, input.ownerType), eq(documents.ownerId, input.ownerId), eq(documents.documentType, input.documentType))).orderBy(desc(documents.version)).limit(1);
      stored = await putStorageObject({ body, contentType: upload.type, key: createStorageKey({ fileName: upload.name, organizationId: context.organizationId!, prefix: `finance/${input.ownerType}/${input.ownerId}` }) });
      const [file] = await tx.insert(files).values({ organizationId: context.organizationId!, storageProvider: stored.provider, bucket: stored.bucket, storageKey: stored.key, ...metadata, extension: validated.extension, sensitivity: "restricted", checksum: getSha256Hex(body), uploadedByUserId: context.userId }).returning();
      const [document] = await tx.insert(documents).values({ organizationId: context.organizationId!, ...input, fileId: file.id, visibility: "restricted", version: (previous?.version ?? 0) + 1, uploadedByUserId: context.userId }).returning();
      await writeAuditLog(context, { action: "create", entityType: "financial_document", entityId: document.id, before: previous ?? null, after: document, metadata: { ...input, fileId: file.id } });
      return document;
    });
  } catch (error) {
    if (stored) {
      try { await deleteStorageObject(stored); } catch { console.error("Financial attachment storage rollback requires administrative cleanup."); }
    }
    throw error;
  }
}

export function financialAttachmentHref(ownerType: FinancialDocumentOwner, ownerId: string) {
  return `/app/financeiro/anexos/${ownerType}/${ownerId}`;
}
