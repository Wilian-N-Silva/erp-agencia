// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import type { AccessContext } from "@/lib/dal";
const mocks = vi.hoisted(() => ({ context: vi.fn(), rate: vi.fn(), upload: vi.fn(), refresh: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.refresh }));
vi.mock("@/lib/dal", () => ({ getCurrentAccessContext: mocks.context }));
vi.mock("@/lib/rate-limit", async original => ({ ...await original<typeof import("@/lib/rate-limit")>(), enforceAuthenticatedRateLimit: mocks.rate }));
vi.mock("@/features/finance/attachments", () => ({ uploadFinancialAttachment: mocks.upload, financialAttachmentHref: () => "/app/financeiro/anexos/test" }));
import { uploadFinancialAttachmentAction } from "@/features/finance/attachment-actions";
const id = "00100000-0000-4000-8000-000000000001";
const context: AccessContext = { userId: "user", organizationId: id, employeeId: null, roles: [], permissions: ["finance.write"] };
const form = () => { const data = new FormData(); data.set("ownerType", "financial_entry"); data.set("ownerId", id); data.set("documentType", "receipt"); data.set("file", new File(["%PDF-1.4\n%%EOF"], "receipt.pdf", { type: "application/pdf" })); return data; };
beforeEach(() => { vi.resetAllMocks(); mocks.context.mockResolvedValue(context); });
it("requires session, tenant and finance write before upload/rate consumption", async () => {
  for (const denied of [null, { ...context, organizationId: null }, { ...context, permissions: ["documents.write"] }]) {
    mocks.context.mockResolvedValue(denied);
    expect((await uploadFinancialAttachmentAction(form())).ok).toBe(false);
  }
  expect(mocks.upload).not.toHaveBeenCalled(); expect(mocks.rate).not.toHaveBeenCalled();
});
it("enforces persistent upload limit, rejects injected fields and hides unexpected errors", async () => {
  mocks.rate.mockRejectedValue(new Error("storage secret"));
  expect(await uploadFinancialAttachmentAction(form())).toMatchObject({ ok: false, message: expect.not.stringContaining("secret") });
  expect(mocks.upload).not.toHaveBeenCalled();
  mocks.rate.mockResolvedValue(undefined);
  const tampered = form(); tampered.set("organizationId", id);
  expect((await uploadFinancialAttachmentAction(tampered)).ok).toBe(false);
  expect(mocks.upload).not.toHaveBeenCalled();
  mocks.upload.mockRejectedValue(new Error("storage secret"));
  expect(await uploadFinancialAttachmentAction(form())).toMatchObject({ ok: false, message: expect.not.stringContaining("secret") });
  expect(mocks.refresh).not.toHaveBeenCalled();
});
it("refreshes the owner page only after a successful upload", async () => {
  expect((await uploadFinancialAttachmentAction(form())).ok).toBe(true);
  expect(mocks.rate).toHaveBeenCalledWith("upload", context);
  expect(mocks.upload).toHaveBeenCalledWith(context, { ownerType: "financial_entry", ownerId: id, documentType: "receipt" }, expect.any(File));
  expect(mocks.refresh).toHaveBeenCalledWith("/app/financeiro/anexos/test");
});
