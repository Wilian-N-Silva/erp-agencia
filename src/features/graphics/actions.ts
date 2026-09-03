"use server";

import { and, eq, isNull, ne } from "drizzle-orm";
import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  clients,
  employees,
  files,
  graphicJobs,
  graphicProjects,
  graphicSupplierQuoteAttachments,
  graphicSupplierQuotes,
  suppliers,
} from "@/lib/db/schema";
import { getCurrentAccessContext, runWithCurrentTenantDb, type AccessContext } from "@/lib/dal";
import { enforceAuthenticatedRateLimit, withRateLimitActionResult } from "@/lib/rate-limit";
import { AccessDeniedError, assertCan } from "@/lib/rbac";
import { formDataToObject } from "@/lib/validation";
import {
  createStorageKey,
  deleteStorageObject,
  getSha256Hex,
  putStorageObject,
  type StoredObject,
} from "@/lib/storage";
import { validateUploadMetadata } from "@/features/documents/rules";
import { generateWorkItem, resolveWorkItem } from "@/features/work-items/dal";

import {
  graphicJobDeleteSchema,
  graphicJobInputSchema,
  graphicJobUpdateSchema,
  getGraphicQuoteUploads,
  graphicSupplierQuoteCancelSchema,
  graphicSupplierQuoteApproveSchema,
  graphicSupplierQuoteInputSchema,
  graphicSupplierQuoteRejectSchema,
  graphicSupplierQuoteUpdateSchema,
  assertGraphicJobTransition,
  validateGraphicQuoteAttachmentContent,
} from "./rules";
import { transitionPendingGraphicSupplierQuote } from "./quote-decision";
import { lockGraphicJobForQuoteSubmission } from "./quote-submission";

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

async function createGraphicSupplierQuoteEntryPoint(formData: FormData) {
  await runQuoteMutationWithStorageRollback((uploadedObjects) =>
    createGraphicSupplierQuote(formData, uploadedObjects),
  );
}

async function createGraphicSupplierQuote(
  formData: FormData,
  uploadedObjects: StoredObject[],
) {
  const { context, organizationId } = await requireQuoteWriter();
  const uploads = getGraphicQuoteUploads(formData);
  if (uploads.length) await enforceAuthenticatedRateLimit("upload", context);
  const input = graphicSupplierQuoteInputSchema.parse(
    formDataToObject(formData, ["attachments"]),
  );
  const job = await lockGraphicJobForQuoteSubmission(input.jobId, organizationId);
  await validateOwnedSupplier(input.supplierId, organizationId);

  const [quote] = await db
    .insert(graphicSupplierQuotes)
    .values({ organizationId, ...input })
    .returning();
  const attachments = await saveQuoteAttachments(
    uploads,
    quote.id,
    organizationId,
    context.userId,
    uploadedObjects,
  );

  if (job.operationalStatus === "supplier_sourcing") {
    assertGraphicJobTransition({ from: job.operationalStatus, to: "supplier_approval_pending" });
    const [updatedJob] = await db.update(graphicJobs).set({
      operationalStatus: "supplier_approval_pending",
      updatedAt: new Date(),
    }).where(and(
      eq(graphicJobs.id, job.id),
      eq(graphicJobs.organizationId, organizationId),
      eq(graphicJobs.operationalStatus, "supplier_sourcing"),
      isNull(graphicJobs.deletedAt),
    )).returning();
    if (!updatedJob) throw new Error("Graphic job state changed before quote submission.");
    await writeAuditLog(context, {
      action: "status_change",
      entityType: "graphic_job",
      entityId: job.id,
      before: job,
      after: updatedJob,
      metadata: { quoteId: quote.id },
    });
  }

  await openQuoteApprovalWorkItem(context, quote.id, job);

  await writeAuditLog(context, {
    action: "create",
    entityType: "graphic_supplier_quote",
    entityId: quote.id,
    after: quote,
    metadata: { attachmentIds: attachments.map(({ id }) => id), jobId: quote.jobId },
  });
  refresh(quote.jobId);
}

async function updateGraphicSupplierQuoteEntryPoint(formData: FormData) {
  await runQuoteMutationWithStorageRollback((uploadedObjects) =>
    updateGraphicSupplierQuote(formData, uploadedObjects),
  );
}

async function updateGraphicSupplierQuote(
  formData: FormData,
  uploadedObjects: StoredObject[],
) {
  const { context, organizationId } = await requireQuoteWriter();
  const uploads = getGraphicQuoteUploads(formData);
  if (uploads.length) await enforceAuthenticatedRateLimit("upload", context);
  const input = graphicSupplierQuoteUpdateSchema.parse(
    formDataToObject(formData, ["attachments"]),
  );
  const before = await getOwnedPendingQuote(input.id, input.jobId, organizationId);
  await validateOwnedQuoteReferences(input.jobId, input.supplierId, organizationId);
  const { id, ...values } = input;
  const [after] = await db
    .update(graphicSupplierQuotes)
    .set({ ...values, updatedAt: new Date() })
    .where(and(
      eq(graphicSupplierQuotes.id, id),
      eq(graphicSupplierQuotes.organizationId, organizationId),
      eq(graphicSupplierQuotes.jobId, input.jobId),
      eq(graphicSupplierQuotes.status, "pending"),
    ))
    .returning();
  if (!after) throw new AccessDeniedError();
  const attachments = await saveQuoteAttachments(
    uploads,
    after.id,
    organizationId,
    context.userId,
    uploadedObjects,
  );
  await writeAuditLog(context, {
    action: "update",
    entityType: "graphic_supplier_quote",
    entityId: after.id,
    before,
    after,
    metadata: { attachmentIds: attachments.map(({ id: attachmentId }) => attachmentId), jobId: after.jobId },
  });
  refresh(after.jobId);
}

async function cancelGraphicSupplierQuoteEntryPoint(formData: FormData) {
  await runWithCurrentTenantDb(() => cancelGraphicSupplierQuote(formData));
}

async function cancelGraphicSupplierQuote(formData: FormData) {
  const { context, organizationId } = await requireQuoteWriter();
  const input = graphicSupplierQuoteCancelSchema.parse(formDataToObject(formData));
  const result = await transitionPendingGraphicSupplierQuote({
    decision: "cancelled",
    jobId: input.jobId,
    organizationId,
    quoteId: input.id,
  });
  await auditQuoteDecision(
    context,
    result.beforeQuote,
    result.afterQuote,
    result.beforeJob,
    result.afterJob,
  );
  await closeQuoteApprovalWorkItem(context, result.afterQuote.id, {
    id: result.beforeJob.id,
    internalCode: result.beforeJob.internalCode,
    title: result.beforeJob.title,
  }, "Cotacao cancelada antes da decisao interna.");
  refresh(result.afterQuote.jobId);
}

async function approveGraphicSupplierQuoteEntryPoint(formData: FormData) {
  await runWithCurrentTenantDb(() => approveGraphicSupplierQuote(formData));
}

async function approveGraphicSupplierQuote(formData: FormData) {
  const { context, organizationId } = await requireQuoteApprover();
  const input = graphicSupplierQuoteApproveSchema.parse(formDataToObject(formData));
  const result = await transitionPendingGraphicSupplierQuote({
    decision: "approved",
    jobId: input.jobId,
    organizationId,
    quoteId: input.id,
    reviewerUserId: context.userId,
  });

  await auditQuoteDecision(
    context,
    result.beforeQuote,
    result.afterQuote,
    result.beforeJob,
    result.afterJob,
  );
  const pendingAlternatives = await db.select().from(graphicSupplierQuotes).where(and(
    eq(graphicSupplierQuotes.organizationId, organizationId),
    eq(graphicSupplierQuotes.jobId, input.jobId),
    ne(graphicSupplierQuotes.id, input.id),
    eq(graphicSupplierQuotes.status, "pending"),
  ));
  const supersededQuotes = await db.update(graphicSupplierQuotes).set({
    status: "cancelled",
    updatedAt: result.now,
  }).where(and(
    eq(graphicSupplierQuotes.organizationId, organizationId),
    eq(graphicSupplierQuotes.jobId, input.jobId),
    ne(graphicSupplierQuotes.id, input.id),
    eq(graphicSupplierQuotes.status, "pending"),
  )).returning();
  for (const superseded of supersededQuotes) {
    const supersededBefore = pendingAlternatives.find(({ id }) => id === superseded.id);
    if (!supersededBefore) throw new Error("Superseded quote snapshot is missing.");
    await writeAuditLog(context, {
      action: "status_change",
      entityType: "graphic_supplier_quote",
      entityId: superseded.id,
      before: supersededBefore,
      after: superseded,
      metadata: { decision: "cancelled_after_other_approval", jobId: superseded.jobId },
    });
    await closeQuoteApprovalWorkItem(
      context,
      superseded.id,
      result.beforeJob,
      "Outra cotacao do trabalho foi aprovada.",
    );
  }
  await closeQuoteApprovalWorkItem(
    context,
    result.afterQuote.id,
    result.beforeJob,
    "Cotacao aprovada internamente.",
  );
  refresh(result.afterQuote.jobId);
}

async function rejectGraphicSupplierQuoteEntryPoint(formData: FormData) {
  await runWithCurrentTenantDb(() => rejectGraphicSupplierQuote(formData));
}

async function rejectGraphicSupplierQuote(formData: FormData) {
  const { context, organizationId } = await requireQuoteApprover();
  const input = graphicSupplierQuoteRejectSchema.parse(formDataToObject(formData));
  const result = await transitionPendingGraphicSupplierQuote({
    decision: "rejected",
    jobId: input.jobId,
    organizationId,
    quoteId: input.id,
    rejectionReason: input.rejectionReason,
    reviewerUserId: context.userId,
  });

  await auditQuoteDecision(
    context,
    result.beforeQuote,
    result.afterQuote,
    result.beforeJob,
    result.afterJob,
  );
  await closeQuoteApprovalWorkItem(
    context,
    result.afterQuote.id,
    result.beforeJob,
    `Cotacao rejeitada: ${input.rejectionReason}`,
  );
  refresh(result.afterQuote.jobId);
}

async function requireQuoteWriter() {
  const context = await getCurrentAccessContext();
  if (!context) redirect("/login");
  assertCan("graphics.supplier_quote_write", context);
  if (!context.organizationId) throw new AccessDeniedError();
  await enforceAuthenticatedRateLimit("common_mutation", context);
  return { context, organizationId: context.organizationId };
}

async function requireQuoteApprover() {
  const context = await getCurrentAccessContext();
  if (!context) redirect("/login");
  assertCan("graphics.supplier_quote_approve", context);
  if (!context.organizationId) throw new AccessDeniedError();
  await enforceAuthenticatedRateLimit("common_mutation", context);
  return { context, organizationId: context.organizationId };
}

async function validateOwnedQuoteReferences(
  jobId: string,
  supplierId: string,
  organizationId: string,
) {
  const [jobRows, supplierRows] = await Promise.all([
    db.select({
      id: graphicJobs.id,
      internalCode: graphicJobs.internalCode,
      operationalStatus: graphicJobs.operationalStatus,
      responsibleEmployeeId: graphicJobs.responsibleEmployeeId,
      title: graphicJobs.title,
    }).from(graphicJobs).where(and(
      eq(graphicJobs.id, jobId),
      eq(graphicJobs.organizationId, organizationId),
      isNull(graphicJobs.deletedAt),
    )).limit(1),
    db.select({ id: suppliers.id }).from(suppliers).where(and(
      eq(suppliers.id, supplierId),
      eq(suppliers.organizationId, organizationId),
      eq(suppliers.isActive, true),
    )).limit(1),
  ]);
  if (!jobRows[0] || !supplierRows[0]) throw new AccessDeniedError();
  if (
    jobRows[0].operationalStatus !== "supplier_sourcing" &&
    jobRows[0].operationalStatus !== "supplier_approval_pending"
  ) throw new Error("Supplier quotes can only be submitted during supplier sourcing or approval.");
  return jobRows[0];
}

async function validateOwnedSupplier(supplierId: string, organizationId: string) {
  const [supplier] = await db.select({ id: suppliers.id }).from(suppliers).where(and(
    eq(suppliers.id, supplierId),
    eq(suppliers.organizationId, organizationId),
    eq(suppliers.isActive, true),
  )).limit(1);
  if (!supplier) throw new AccessDeniedError();
}

type QuoteWorkItemJob = {
  id: string;
  internalCode: string;
  title: string;
};

async function openQuoteApprovalWorkItem(
  context: AccessContext,
  quoteId: string,
  job: QuoteWorkItemJob,
) {
  return generateWorkItem(context, {
    kind: "graphic_supplier_quote_approval",
    sourceType: "graphic_supplier_quote",
    sourceId: quoteId,
    occurrenceKey: "internal_approval",
    title: `Aprovar cotacao ${job.internalCode}`,
    description: `Revisar fornecedor, valor e condicoes da cotacao do trabalho ${job.title}.`,
    priority: "high",
  });
}

async function closeQuoteApprovalWorkItem(
  context: AccessContext,
  quoteId: string,
  job: QuoteWorkItemJob,
  resolution: string,
) {
  const { item } = await openQuoteApprovalWorkItem(context, quoteId, job);
  if (item.status === "open" || item.status === "in_progress") {
    await resolveWorkItem(context, { id: item.id, resolution });
  }
}

async function auditQuoteDecision(
  context: AccessContext,
  before: typeof graphicSupplierQuotes.$inferSelect,
  after: typeof graphicSupplierQuotes.$inferSelect,
  beforeJob: typeof graphicJobs.$inferSelect,
  afterJob: typeof graphicJobs.$inferSelect,
) {
  await writeAuditLog(context, {
    action: "status_change",
    entityType: "graphic_supplier_quote",
    entityId: after.id,
    before,
    after,
    metadata: { decision: after.status, jobId: after.jobId },
  });
  if (beforeJob.operationalStatus !== afterJob.operationalStatus) {
    await writeAuditLog(context, {
      action: "status_change",
      entityType: "graphic_job",
      entityId: afterJob.id,
      before: beforeJob,
      after: afterJob,
      metadata: { quoteId: after.id },
    });
  }
}

async function getOwnedPendingQuote(
  id: string,
  jobId: string,
  organizationId: string,
) {
  const [quote] = await db.select().from(graphicSupplierQuotes).where(and(
    eq(graphicSupplierQuotes.id, id),
    eq(graphicSupplierQuotes.jobId, jobId),
    eq(graphicSupplierQuotes.organizationId, organizationId),
    eq(graphicSupplierQuotes.status, "pending"),
  )).limit(1);
  if (!quote) throw new AccessDeniedError();
  return quote;
}

async function saveQuoteAttachments(
  uploads: File[],
  quoteId: string,
  organizationId: string,
  userId: string,
  uploadedObjects: StoredObject[],
) {
  const saved = [];
  for (const upload of uploads) {
    const metadata = validateUploadMetadata({
      byteSize: upload.size,
      mimeType: upload.type || "application/octet-stream",
      originalName: upload.name,
    });
    const body = Buffer.from(await upload.arrayBuffer());
    validateGraphicQuoteAttachmentContent(body, metadata.extension);
    const stored = await putStorageObject({
      body,
      contentType: metadata.normalizedMimeType,
      key: createStorageKey({
        fileName: upload.name,
        organizationId,
        prefix: `graphics/supplier-quotes/${quoteId}`,
      }),
    });
    uploadedObjects.push(stored);
    const [file] = await db.insert(files).values({
      organizationId,
      storageProvider: stored.provider,
      bucket: stored.bucket,
      storageKey: stored.key,
      originalName: upload.name,
      mimeType: metadata.normalizedMimeType,
      extension: metadata.extension,
      byteSize: upload.size,
      sensitivity: "restricted",
      checksum: getSha256Hex(body),
      uploadedByUserId: userId,
    }).returning();
    const [attachment] = await db.insert(graphicSupplierQuoteAttachments).values({
      organizationId,
      quoteId,
      fileId: file.id,
    }).returning();
    saved.push(attachment);
  }
  return saved;
}

async function runQuoteMutationWithStorageRollback(
  operation: (uploadedObjects: StoredObject[]) => Promise<void>,
) {
  const uploadedObjects: StoredObject[] = [];

  try {
    await runWithCurrentTenantDb(() => operation(uploadedObjects));
  } catch (error) {
    const cleanupResults = await Promise.allSettled(
      uploadedObjects.reverse().map((object) => deleteStorageObject(object)),
    );
    const cleanupErrors = cleanupResults.flatMap((result) =>
      result.status === "rejected" ? [result.reason] : [],
    );

    if (cleanupErrors.length > 0) {
      throw new AggregateError(
        [error, ...cleanupErrors],
        "Supplier quote mutation failed and storage rollback was incomplete.",
      );
    }

    throw error;
  }
}

function refresh(id: string) {
  revalidatePath("/app/grafica");
  revalidatePath(`/app/grafica/${id}`);
}

export const createGraphicJobAction = withRateLimitActionResult(createGraphicJobEntryPoint);
export const updateGraphicJobAction = withRateLimitActionResult(updateGraphicJobEntryPoint);
export const deleteGraphicJobAction = withRateLimitActionResult(deleteGraphicJobEntryPoint);
export const createGraphicSupplierQuoteAction = withRateLimitActionResult(createGraphicSupplierQuoteEntryPoint);
export const updateGraphicSupplierQuoteAction = withRateLimitActionResult(updateGraphicSupplierQuoteEntryPoint);
export const cancelGraphicSupplierQuoteAction = withRateLimitActionResult(cancelGraphicSupplierQuoteEntryPoint);
export const approveGraphicSupplierQuoteAction = withRateLimitActionResult(approveGraphicSupplierQuoteEntryPoint);
export const rejectGraphicSupplierQuoteAction = withRateLimitActionResult(rejectGraphicSupplierQuoteEntryPoint);
