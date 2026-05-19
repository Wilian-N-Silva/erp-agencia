import type { AccessContext } from "@/lib/dal";
import { can } from "@/lib/rbac";

export const documentTypeLabels = {
  contract: "Contrato",
  amendment: "Aditivo",
  personal_document: "Documento pessoal",
  responsibility_term: "Termo de responsabilidade",
  equipment_term: "Termo de equipamento",
  invoice: "NF",
  reimbursement_receipt: "Comprovante de reembolso",
  receipt: "Recibo",
  timeoff_document: "Documento de ferias/pausa",
  offboarding_document: "Documento de desligamento",
  other: "Outros",
} as const;

export const documentVisibilityLabels = {
  internal: "Interno",
  employee_visible: "Visivel ao colaborador",
  restricted: "Restrito",
} as const;

export const fileSensitivityLabels = {
  public_internal: "Publico interno",
  restricted: "Restrito",
  sensitive: "Sensivel",
  highly_sensitive: "Altamente sensivel",
} as const;

export const allowedUploadMimeTypes = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/xml": "xml",
  "text/xml": "xml",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
} as const;

export type DocumentType = keyof typeof documentTypeLabels;
export type DocumentVisibility = keyof typeof documentVisibilityLabels;
export type FileSensitivity = keyof typeof fileSensitivityLabels;
export type DocumentOwnerType =
  | "employee"
  | "invoice_request"
  | "reimbursement_request"
  | "time_off_request"
  | "equipment"
  | "offboarding";

export type DocumentScopeTarget = {
  ownerEmployeeId?: string | null;
  sensitivity: FileSensitivity;
  visibility: DocumentVisibility;
};

export type UploadMetadataInput = {
  byteSize: number;
  mimeType: string;
  originalName: string;
};

const defaultUploadMaxBytes = 10 * 1024 * 1024;

export function getUploadMaxBytes(value = process.env.UPLOAD_MAX_BYTES) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultUploadMaxBytes;
}

export function validateUploadMetadata(input: UploadMetadataInput, maxBytes = getUploadMaxBytes()) {
  const extension = getFileExtension(input.originalName);
  const expectedExtension = allowedUploadMimeTypes[input.mimeType as keyof typeof allowedUploadMimeTypes];

  if (!expectedExtension) {
    throw new Error("File MIME type is not allowed.");
  }

  if (!extension || !isExtensionCompatible(extension, expectedExtension)) {
    throw new Error("File extension is not allowed for its MIME type.");
  }

  if (!Number.isInteger(input.byteSize) || input.byteSize <= 0 || input.byteSize > maxBytes) {
    throw new Error("File size exceeds the configured upload limit.");
  }

  return {
    extension,
    normalizedMimeType: input.mimeType,
  };
}

export function canWriteDocuments(context: AccessContext) {
  return can("documents.write", context);
}

export function canReadDocument(context: AccessContext, target: DocumentScopeTarget) {
  if (can("documents.read_sensitive", context)) {
    return true;
  }

  if (target.sensitivity === "sensitive" || target.sensitivity === "highly_sensitive") {
    return false;
  }

  if (target.visibility === "employee_visible") {
    return Boolean(context.employeeId && context.employeeId === target.ownerEmployeeId);
  }

  return canWriteDocuments(context);
}

export function canReadOwnDocument(context: AccessContext, target: DocumentScopeTarget) {
  return (
    can("documents.read_own", context) &&
    target.visibility === "employee_visible" &&
    context.employeeId === target.ownerEmployeeId &&
    target.sensitivity !== "highly_sensitive"
  );
}

function getFileExtension(name: string) {
  const extension = name.split(".").pop()?.toLowerCase();

  return extension && extension !== name.toLowerCase() ? extension : null;
}

function isExtensionCompatible(extension: string, expectedExtension: string) {
  if (expectedExtension === "jpg") {
    return extension === "jpg" || extension === "jpeg";
  }

  return extension === expectedExtension;
}
