import { describe, expect, it } from "vitest";
import { canRegisterOs, graphicOsInputSchema, validateOsContent, validateOsUpload } from "@/features/graphics/os-rules";

const input = { jobId: "73300000-0000-4000-8000-000000000061", expectedVersion: "0", externalNumber: " OS-42 ", issuedAt: "2026-09-21", presentedAmount: "1.250,50" };
describe("OS registration rules", () => {
  it("normalizes monetary values and keeps external identifiers", () => {
    expect(graphicOsInputSchema.parse(input)).toMatchObject({ externalNumber: "OS-42", presentedAmount: "1250.50" });
  });
  it("rejects invalid dates, amounts, revisions and server-owned fields", () => {
    for (const change of [{ issuedAt: "2026-02-30" }, { presentedAmount: "0" }, { presentedAmount: "-5" }, { expectedVersion: 1 }, { organizationId: input.jobId }, { fileId: input.jobId }, { status: "approved" }]) {
      expect(graphicOsInputSchema.safeParse({ ...input, ...change }).success).toBe(false);
    }
    expect(graphicOsInputSchema.safeParse({ ...input, expectedVersion: 1, revisionReason: "Ajuste solicitado" }).success).toBe(true);
  });
  it("requires a complete PDF with matching extension and bounded size", () => {
    expect(() => validateOsUpload(new File(["x"], "os.png", { type: "application/pdf" }))).toThrow();
    expect(() => validateOsUpload(new File([], "os.pdf", { type: "application/pdf" }))).toThrow();
    expect(() => validateOsContent(new TextEncoder().encode("%PDF-1.4 truncated"))).toThrow();
    expect(() => validateOsContent(new TextEncoder().encode("<html>%%EOF"))).toThrow();
    expect(() => validateOsContent(new TextEncoder().encode("%PDF-1.4\n%%EOF"))).not.toThrow();
  });
  it("does not allow OS registration to bypass internal approval or production", () => {
    expect(canRegisterOs("os_pending")).toBe(true);
    expect(canRegisterOs("client_revision")).toBe(true);
    for (const status of ["supplier_sourcing", "supplier_approval_pending", "approved", "in_production", "cancelled", "closed"]) expect(canRegisterOs(status)).toBe(false);
  });
});
