import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AccessDeniedError } from "@/lib/rbac";

const mocks = vi.hoisted(() => ({ context: vi.fn(), file: vi.fn(), storage: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/dal", () => ({ getCurrentAccessContext: mocks.context }));
vi.mock("@/features/graphics/client-decision", () => ({ getClientEvidence: mocks.file }));
vi.mock("@/lib/storage", () => ({ getStorageObject: mocks.storage }));
vi.mock("@/lib/audit", () => ({ writeAuditLog: mocks.audit }));
import { GET } from "@/app/(private)/app/grafica/[id]/cliente/[decisionId]/download/route";

const id = "40000000-0000-4000-8000-000000000001";
const decisionId = "40000000-0000-4000-8000-000000000002";
const request = new NextRequest("http://localhost:3000/app/grafica/download");
const call = (jobId = id) => GET(request, { params: Promise.resolve({ id: jobId, decisionId }) });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.context.mockResolvedValue({ userId: "user", organizationId: "org" });
  mocks.file.mockResolvedValue({ id: "file", bucket: "private", storageKey: "secret-key", storageProvider: "local", mimeType: "application/pdf", extension: "pdf", originalName: "OS revisão.pdf" });
  mocks.storage.mockResolvedValue(Buffer.from("%PDF-test"));
});

it("redirects unauthenticated requests and rejects malformed IDs before reading storage", async () => {
  mocks.context.mockResolvedValueOnce(null);
  expect((await call()).headers.get("location")).toBe("http://localhost:3000/login");
  expect((await call("invalid")).status).toBe(404);
  expect(mocks.file).not.toHaveBeenCalled();
  expect(mocks.storage).not.toHaveBeenCalled();
});

it("does not expose unauthorized, missing or unavailable files", async () => {
  mocks.file.mockRejectedValueOnce(new AccessDeniedError());
  expect((await call()).status).toBe(404);
  mocks.file.mockResolvedValueOnce(null);
  expect((await call()).status).toBe(404);
  expect(mocks.storage).not.toHaveBeenCalled();
  mocks.storage.mockRejectedValueOnce(new Error("private storage secret"));
  const response = await call();
  expect(response.status).toBe(404);
  expect(await response.text()).not.toContain("secret");
  expect(mocks.audit).not.toHaveBeenCalled();
});

it("audits downloads and returns a private attachment without its storage key", async () => {
  const response = await call();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("content-type")).toBe("application/pdf");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.get("content-disposition")).toContain("attachment;");
  expect(await response.text()).toBe("%PDF-test");
  expect(mocks.file).toHaveBeenCalledWith(expect.anything(), id, decisionId);
  expect(mocks.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "sensitive_read", entityId: "file" }));
});

it("does not deliver a sensitive file when audit persistence fails", async () => {
  mocks.audit.mockRejectedValueOnce(new Error("database secret"));
  const response = await call();
  expect(response.status).toBe(500);
  expect(await response.text()).not.toContain("secret");
});
