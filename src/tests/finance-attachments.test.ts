import { expect, it } from "vitest";
import { financialAttachmentSchema, validateFinancialAttachment } from "@/features/finance/attachment-rules";

it("validates file signatures, complete PDFs and server-owned financial metadata", () => {
  const body = Buffer.from("%PDF-1.4\n%%EOF");
  const input = { originalName: "receipt.pdf", mimeType: "application/pdf", byteSize: body.length };
  expect(validateFinancialAttachment(input, body).extension).toBe("pdf");
  expect(() => validateFinancialAttachment(input, Buffer.alloc(body.length))).toThrow();
  expect(() => validateFinancialAttachment({ ...input, originalName: "receipt.exe" }, body)).toThrow();
  expect(() => validateFinancialAttachment({ ...input, originalName: "receipt\r\n.pdf" }, body)).toThrow();
  expect(() => validateFinancialAttachment({ ...input, mimeType: "text/html" }, body)).toThrow();
  expect(() => validateFinancialAttachment({ ...input, byteSize: 0 })).toThrow();
  expect(() => validateFinancialAttachment({ ...input, byteSize: 11 * 1024 * 1024 })).toThrow();
  expect(() => financialAttachmentSchema.parse({ ownerType: "financial_entry", ownerId: "bad", documentType: "receipt" })).toThrow();
  expect(() => financialAttachmentSchema.parse({ ownerType: "financial_entry", ownerId: "00000000-0000-4000-8000-000000000001", documentType: "receipt", organizationId: "injected" })).toThrow();
});
