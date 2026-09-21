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

vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();

  return {
    ...actual,
    enforceAuthenticatedRateLimit: mocks.enforceAuthenticatedRateLimit,
  };
});

vi.mock("@/lib/rbac", () => ({
  AccessDeniedError: class AccessDeniedError extends Error {},
  assertCan: vi.fn(),
  assertCanAny: vi.fn(),
}));

import { markClientPaymentReceivedAction } from "@/features/clients/actions";
import {
  RATE_LIMIT_ERROR_MESSAGE,
  RateLimitExceededError,
} from "@/lib/rate-limit";

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
    const blockedError = new RateLimitExceededError({
      allowed: false,
      limit: 1,
      remaining: 0,
      resetAt: new Date("2026-08-18T12:01:00.000Z"),
      retryAfterSeconds: 37,
    });
    mocks.getCurrentAccessContext.mockResolvedValue(context);
    mocks.enforceAuthenticatedRateLimit.mockRejectedValue(blockedError);

    const formData = new FormData();
    formData.set("id", "20000000-0000-4000-8000-000000000001");

    await expect(markClientPaymentReceivedAction(formData)).resolves.toEqual({
      code: "RATE_LIMITED",
      message: RATE_LIMIT_ERROR_MESSAGE,
      ok: false,
      retryAfterSeconds: 37,
    });

    expect(mocks.enforceAuthenticatedRateLimit).toHaveBeenCalledWith(
      "reconciliation",
      context,
    );
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });
});
