import { z } from "zod";
import type { AccessContext } from "@/lib/dal";
import { canAny } from "@/lib/rbac";
import { validateUploadMetadata } from "@/features/documents/rules";

export const financialDocumentOwners = ["financial_entry", "financial_expense", "financial_transaction"] as const;
export type FinancialDocumentOwner = typeof financialDocumentOwners[number];
export const attachmentOwnerSchema = z.strictObject({ ownerType: z.enum(financialDocumentOwners), ownerId: z.string().uuid() });
export const financialAttachmentSchema = attachmentOwnerSchema.extend({ documentType: z.enum(["invoice", "receipt", "other"]) });
export const financialAttachmentLabels = { invoice: "Nota fiscal externa", receipt: "Comprovante", other: "Outro documento" } as const;

export function isFinancialDocumentOwner(value: string): value is FinancialDocumentOwner {
  return (financialDocumentOwners as readonly string[]).includes(value);
}
export function canReadFinancialAttachments(context: AccessContext) {
  return canAny(["finance.read", "finance.write", "finance.settle", "finance.reverse"], context);
}
export function validateFinancialAttachment(input: { originalName: string; mimeType: string; byteSize: number }, body?: Uint8Array) {
  if (!input.originalName.trim() || input.originalName.length > 255 || /[\x00-\x1f\x7f/\\]/.test(input.originalName)) throw new Error("Nome de arquivo inválido.");
  if (!["application/pdf", "image/png", "image/jpeg"].includes(input.mimeType)) throw new Error("Use PDF, PNG ou JPG.");
  const metadata = validateUploadMetadata(input);
  if (body) {
    const signatures: Record<string, number[]> = { pdf: [37,80,68,70,45], png: [137,80,78,71,13,10,26,10], jpg: [255,216,255], jpeg: [255,216,255] };
    if (body.length !== input.byteSize || !signatures[metadata.extension]?.every((byte, index) => body[index] === byte)) throw new Error("Conteúdo inválido.");
    if (metadata.extension === "pdf" && !new TextDecoder().decode(body.slice(-1024)).includes("%%EOF")) throw new Error("PDF incompleto.");
  }
  return metadata;
}
