"use server";

import { and, count, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { documents, employees, files } from "@/lib/db/schema";
import { getCurrentAccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCan } from "@/lib/rbac";

import {
  canWriteDocuments,
  documentTypeLabels,
  documentVisibilityLabels,
  fileSensitivityLabels,
  validateUploadMetadata,
  type DocumentOwnerType,
} from "./rules";

const ownerTypeSchema = z.enum([
  "employee",
  "invoice_request",
  "reimbursement_request",
  "time_off_request",
  "equipment",
  "offboarding",
]);
const documentTypeSchema = z.enum(
  Object.keys(documentTypeLabels) as [
    keyof typeof documentTypeLabels,
    ...(keyof typeof documentTypeLabels)[],
  ],
);
const visibilitySchema = z.enum(
  Object.keys(documentVisibilityLabels) as [
    keyof typeof documentVisibilityLabels,
    ...(keyof typeof documentVisibilityLabels)[],
  ],
);
const sensitivitySchema = z.enum(
  Object.keys(fileSensitivityLabels) as [
    keyof typeof fileSensitivityLabels,
    ...(keyof typeof fileSensitivityLabels)[],
  ],
);

const registerDocumentSchema = z.object({
  ownerType: ownerTypeSchema,
  ownerId: z.string().trim().min(1).max(160),
  ownerEmployeeId: optionalIdSchema(),
  documentType: documentTypeSchema,
  originalName: z.string().trim().min(1).max(240),
  mimeType: z.string().trim().min(1).max(160),
  byteSize: z.coerce.number().int().positive(),
  sensitivity: sensitivitySchema,
  visibility: visibilitySchema,
  storageKey: z.string().trim().min(1).max(500),
  checksum: z
    .string()
    .trim()
    .max(160)
    .optional()
    .transform((value) => value || null),
});

const idSchema = z.object({
  id: z.string().uuid(),
});

export async function registerDocumentAction(formData: FormData) {
  const { context, organizationId } = await requireDocumentWriterContext();
  const input = registerDocumentSchema.parse(formDataToObject(formData));
  const ownerEmployeeId = await resolveOwnerEmployeeId(input, organizationId);
  const upload = validateUploadMetadata({
    byteSize: input.byteSize,
    mimeType: input.mimeType,
    originalName: input.originalName,
  });
  const [{ total }] = await db
    .select({ total: count() })
    .from(documents)
    .where(
      and(
        eq(documents.organizationId, organizationId),
        eq(documents.ownerType, input.ownerType),
        eq(documents.ownerId, input.ownerId),
        eq(documents.documentType, input.documentType),
      ),
    );
  const [file] = await db
    .insert(files)
    .values({
      organizationId,
      ownerEmployeeId,
      storageProvider: process.env.STORAGE_PROVIDER || "metadata",
      bucket: process.env.STORAGE_BUCKET || null,
      storageKey: input.storageKey,
      originalName: input.originalName,
      mimeType: upload.normalizedMimeType,
      extension: upload.extension,
      byteSize: input.byteSize,
      sensitivity: input.sensitivity,
      checksum: input.checksum,
      uploadedByUserId: context.userId,
    })
    .returning();
  const [document] = await db
    .insert(documents)
    .values({
      organizationId,
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      documentType: input.documentType,
      fileId: file.id,
      visibility: input.visibility,
      version: total + 1,
      uploadedByUserId: context.userId,
    })
    .returning();

  await writeAuditLog(context, {
    action: "create",
    entityType: "file",
    entityId: file.id,
    after: {
      document,
      file,
    },
    metadata: {
      ownerId: input.ownerId,
      ownerType: input.ownerType,
    },
  });

  revalidateDocumentPaths();
}

export async function deleteDocumentAction(formData: FormData) {
  const { context, organizationId } = await requireDocumentWriterContext();
  const input = idSchema.parse(formDataToObject(formData));
  const before = await getDocumentForWrite(input.id, organizationId);
  const [after] = await db
    .update(documents)
    .set({
      deletedAt: new Date(),
      status: "deleted",
      updatedAt: new Date(),
    })
    .where(eq(documents.id, input.id))
    .returning();

  await writeAuditLog(context, {
    action: "delete",
    entityType: "file",
    entityId: before.fileId,
    before,
    after,
  });

  revalidateDocumentPaths();
}

async function requireDocumentWriterContext() {
  const context = await getCurrentAccessContext();

  if (!context) {
    redirect("/login");
  }

  assertCan("documents.write", context);

  if (!context.organizationId || !canWriteDocuments(context)) {
    throw new AccessDeniedError();
  }

  return {
    context,
    organizationId: context.organizationId,
  };
}

async function resolveOwnerEmployeeId(
  input: {
    ownerEmployeeId: string | null;
    ownerId: string;
    ownerType: DocumentOwnerType;
  },
  organizationId: string,
) {
  const employeeId = input.ownerType === "employee" ? input.ownerId : input.ownerEmployeeId;

  if (!employeeId) {
    return null;
  }

  const [employee] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.id, employeeId), eq(employees.organizationId, organizationId), isNull(employees.deletedAt)))
    .limit(1);

  if (!employee) {
    throw new AccessDeniedError();
  }

  return employee.id;
}

async function getDocumentForWrite(id: string, organizationId: string) {
  const [document] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.organizationId, organizationId), isNull(documents.deletedAt)))
    .limit(1);

  if (!document) {
    throw new AccessDeniedError();
  }

  return document;
}

function revalidateDocumentPaths() {
  revalidatePath("/app/documentos");
  revalidatePath("/portal");
}

function formDataToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function optionalIdSchema() {
  return z
    .string()
    .trim()
    .optional()
    .transform((value) => value || null)
    .refine((value) => value === null || z.string().uuid().safeParse(value).success, {
      message: "Invalid id.",
    });
}
