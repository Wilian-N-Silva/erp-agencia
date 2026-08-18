import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enforceAuthenticatedRateLimit: vi.fn(),
  getCurrentAccessContext: vi.fn(),
  update: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));

vi.mock("@/lib/db", () => ({
  db: {
    update: mocks.update,
  },
}));

vi.mock("@/lib/dal", () => ({
  bindCurrentTenantContext: (operation: unknown) => operation,
  getCurrentAccessContext: mocks.getCurrentAccessContext,
  runWithCurrentTenantDb: (operation: () => unknown) => operation(),
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceAuthenticatedRateLimit: mocks.enforceAuthenticatedRateLimit,
}));

vi.mock("@/lib/rbac", () => ({
  AccessDeniedError: class AccessDeniedError extends Error {},
  assertCan: vi.fn(),
  assertCanAny: vi.fn(),
}));

import { markClientPaymentReceivedAction } from "@/features/clients/actions";

describe("client financial Action rate limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks marking a client payment as received without writing", async () => {
    const context = {
      organizationId: "10000000-0000-4000-8000-000000000001",
      roles: ["finance"],
      userId: "user-1",
    };
    const blockedError = new Error("rate limit exceeded");
    mocks.getCurrentAccessContext.mockResolvedValue(context);
    mocks.enforceAuthenticatedRateLimit.mockRejectedValue(blockedError);

    const formData = new FormData();
    formData.set("id", "20000000-0000-4000-8000-000000000001");

    await expect(markClientPaymentReceivedAction(formData)).rejects.toBe(blockedError);

    expect(mocks.enforceAuthenticatedRateLimit).toHaveBeenCalledWith(
      "reconciliation",
      context,
    );
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });
});
