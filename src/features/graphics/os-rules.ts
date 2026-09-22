import { z } from "zod";
import { normalizeMoneyInput } from "@/features/finance/rules";
import { validateUploadMetadata } from "@/features/documents/rules";
import { isoDateSchema } from "@/lib/validation";
import { validateGraphicQuoteAttachmentContent } from "./rules";

export const graphicOsInputSchema = z.strictObject({
  jobId: z.string().uuid(),
  expectedVersion: z.coerce.number().int().min(0),
  externalNumber: z.string().trim().min(1).max(100),
  issuedAt: isoDateSchema,
  presentedAmount: z.string().trim().transform((value, ctx) => {
    try {
      const normalized = /^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(value) ? value.replaceAll(".", "") : value;
      const amount = normalizeMoneyInput(normalized);
      if (Number(amount) <= 0 || Number(amount) >= 1e12) throw new Error();
      return amount;
    } catch {
      ctx.addIssue({ code: "custom", message: "Informe um valor positivo válido." });
      return z.NEVER;
    }
  }),
  revisionReason: z.string().trim().max(2000).default(""),
}).refine(input => input.expectedVersion === 0 || input.revisionReason.length >= 3, {
  path: ["revisionReason"], message: "Informe o motivo da nova versão.",
});

export function validateOsUpload(upload: File) {
  if (!(upload instanceof File) || upload.type !== "application/pdf") {
    throw new Error("Anexe o documento PDF da OS.");
  }
  validateUploadMetadata({ originalName: upload.name, mimeType: upload.type, byteSize: upload.size });
}

export function validateOsContent(body: Uint8Array) {
  validateGraphicQuoteAttachmentContent(body, "pdf");
  if (!new TextDecoder().decode(body.slice(-1024)).includes("%%EOF")) {
    throw new Error("O PDF está incompleto ou inválido.");
  }
}

export function canRegisterOs(status: string) {
  return ["os_pending", "client_approval_pending", "client_revision"].includes(status);
}
