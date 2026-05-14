import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { documents, employees, files } from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCan, assertCanAny } from "@/lib/rbac";

import {
  canReadDocument,
  canReadOwnDocument,
  type DocumentOwnerType,
  type DocumentType,
  type DocumentVisibility,
  type FileSensitivity,
} from "./rules";

export type DocumentListItem = {
  id: string;
  ownerType: DocumentOwnerType | string;
  ownerId: string;
  ownerEmployeeId: string | null;
  ownerEmployeeName: string | null;
  documentType: DocumentType | string;
  originalName: string;
  mimeType: string;
  extension: string;
  byteSize: number;
  sensitivity: FileSensitivity;
  storageProvider: string;
  storageKey: string;
  visibility: DocumentVisibility;
  version: number;
  status: string;
  createdAt: Date;
};

export type DocumentOwnerOption = {
  id: string;
  name: string;
};

export async function listDocumentEmployeeOptions(
  context: AccessContext,
): Promise<DocumentOwnerOption[]> {
  assertCan("documents.write", context);
  const organizationId = requireOrganizationId(context);

  return db
    .select({
      id: employees.id,
      name: employees.fullName,
    })
    .from(employees)
    .where(and(eq(employees.organizationId, organizationId), isNull(employees.deletedAt)))
    .orderBy(asc(employees.fullName));
}

export async function listDocuments(
  context: AccessContext,
  filters: { ownerEmployeeId?: string; ownOnly?: boolean } = {},
): Promise<DocumentListItem[]> {
  assertCanAny(["documents.read_sensitive", "documents.write", "documents.read_own"], context);
  const organizationId = requireOrganizationId(context);
  const rows = await db
    .select({
      id: documents.id,
      ownerType: documents.ownerType,
      ownerId: documents.ownerId,
      ownerEmployeeId: files.ownerEmployeeId,
      ownerEmployeeName: employees.fullName,
      documentType: documents.documentType,
      originalName: files.originalName,
      mimeType: files.mimeType,
      extension: files.extension,
      byteSize: files.byteSize,
      sensitivity: files.sensitivity,
      storageProvider: files.storageProvider,
      storageKey: files.storageKey,
      visibility: documents.visibility,
      version: documents.version,
      status: documents.status,
      createdAt: documents.createdAt,
    })
    .from(documents)
    .innerJoin(files, eq(documents.fileId, files.id))
    .leftJoin(employees, eq(files.ownerEmployeeId, employees.id))
    .where(and(eq(documents.organizationId, organizationId), isNull(documents.deletedAt)))
    .orderBy(desc(documents.createdAt));

  return rows
    .filter((row) => {
      if (filters.ownerEmployeeId && row.ownerEmployeeId !== filters.ownerEmployeeId) {
        return false;
      }

      const target = {
        ownerEmployeeId: row.ownerEmployeeId,
        sensitivity: row.sensitivity as FileSensitivity,
        visibility: row.visibility as DocumentVisibility,
      };

      return filters.ownOnly
        ? canReadOwnDocument(context, target)
        : canReadDocument(context, target) || canReadOwnDocument(context, target);
    })
    .map((row) => ({
      ...row,
      sensitivity: row.sensitivity as FileSensitivity,
      visibility: row.visibility as DocumentVisibility,
    }));
}

export async function getDocumentForAccess(context: AccessContext, id: string) {
  const organizationId = requireOrganizationId(context);
  const [row] = await db
    .select({
      id: documents.id,
      fileId: documents.fileId,
      ownerEmployeeId: files.ownerEmployeeId,
      sensitivity: files.sensitivity,
      visibility: documents.visibility,
      bucket: files.bucket,
      mimeType: files.mimeType,
      storageProvider: files.storageProvider,
      storageKey: files.storageKey,
      originalName: files.originalName,
    })
    .from(documents)
    .innerJoin(files, eq(documents.fileId, files.id))
    .where(and(eq(documents.id, id), eq(documents.organizationId, organizationId), isNull(documents.deletedAt)))
    .limit(1);

  if (!row) {
    throw new AccessDeniedError();
  }

  const target = {
    ownerEmployeeId: row.ownerEmployeeId,
    sensitivity: row.sensitivity as FileSensitivity,
    visibility: row.visibility as DocumentVisibility,
  };

  if (!canReadDocument(context, target) && !canReadOwnDocument(context, target)) {
    throw new AccessDeniedError();
  }

  return row;
}

function requireOrganizationId(context: AccessContext) {
  if (!context.organizationId) {
    throw new AccessDeniedError();
  }

  return context.organizationId;
}
