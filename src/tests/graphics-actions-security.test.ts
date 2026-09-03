import { beforeEach, describe, expect, it, vi } from "vitest";

import { AccessDeniedError } from "@/lib/rbac";
import { createAccessContext } from "@/tests/helpers/access-context";

const mocks = vi.hoisted(() => ({
  enforceAuthenticatedRateLimit: vi.fn(),
  getCurrentAccessContext: vi.fn(),
  insert: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/audit", () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock("@/lib/db", () => ({ db: { insert: mocks.insert, select: vi.fn(), update: vi.fn() } }));
vi.mock("@/lib/dal", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/dal")>();
  return {
    ...actual,
    getCurrentAccessContext: mocks.getCurrentAccessContext,
    runWithCurrentTenantDb: (operation: () => unknown) => operation(),
  };
});
vi.mock("@/lib/rate-limit", () => ({
  enforceAuthenticatedRateLimit: mocks.enforceAuthenticatedRateLimit,
  withRateLimitActionResult: (operation: (...args: unknown[]) => Promise<unknown>) => operation,
}));

import { createGraphicJobAction } from "@/features/graphics/actions";

describe("graphic job Action security boundary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("denies users without graphics.write before rate limit or database access", async () => {
    mocks.getCurrentAccessContext.mockResolvedValue(createAccessContext({
      permissions: ["graphics.read"],
      roles: [],
      userId: "reader",
    }));

    await expect(createGraphicJobAction(new FormData())).rejects.toBeInstanceOf(AccessDeniedError);
    expect(mocks.enforceAuthenticatedRateLimit).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("rejects organization and status mass assignment before database access", async () => {
    const context = createAccessContext({
      organizationId: "30000000-0000-4000-8000-000000000001",
      permissions: ["graphics.write"],
      roles: [],
      userId: "writer",
    });
    mocks.getCurrentAccessContext.mockResolvedValue(context);
    const form = validForm();
    form.set("organizationId", "90000000-0000-4000-8000-000000000009");
    form.set("operationalStatus", "closed");

    await expect(createGraphicJobAction(form)).rejects.toThrow();
    expect(mocks.enforceAuthenticatedRateLimit).toHaveBeenCalledWith("common_mutation", context);
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("stops a rate-limited mutation before validation and database access", async () => {
    const context = createAccessContext({
      organizationId: "30000000-0000-4000-8000-000000000001",
      permissions: ["graphics.write"],
      roles: [],
      userId: "writer",
    });
    mocks.getCurrentAccessContext.mockResolvedValue(context);
    mocks.enforceAuthenticatedRateLimit.mockRejectedValue(new Error("rate limited"));

    await expect(createGraphicJobAction(validForm())).rejects.toThrow("rate limited");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});

function validForm() {
  const form = new FormData();
  form.set("clientId", "10000000-0000-4000-8000-000000000001");
  form.set("description", "Material promocional");
  form.set("desiredDeliveryAt", "");
  form.set("internalCode", "GRF-42");
  form.set("notes", "");
  form.set("projectId", "");
  form.set("requestedAt", "2026-09-02");
  form.set("responsibleEmployeeId", "20000000-0000-4000-8000-000000000001");
  form.set("title", "Banner");
  return form;
}
