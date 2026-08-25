import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enforceAuthenticatedRateLimit: vi.fn(),
  getCurrentAccessContext: vi.fn(),
  resolveWorkItem: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/features/work-items/dal", () => ({
  resolveWorkItem: mocks.resolveWorkItem,
}));

vi.mock("@/lib/dal", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/dal")>();

  return {
    ...actual,
    bindCurrentTenantContext: (operation: unknown) => operation,
    getCurrentAccessContext: mocks.getCurrentAccessContext,
  };
});

vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();

  return {
    ...actual,
    enforceAuthenticatedRateLimit: mocks.enforceAuthenticatedRateLimit,
    withRateLimitActionResult: (operation: unknown) => operation,
  };
});

import { resolveWorkItemAction } from "@/features/work-items/actions";
import { AccessDeniedError } from "@/lib/rbac";
import { createAccessContext } from "@/tests/helpers/access-context";

describe("work item administrative authorization boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentAccessContext.mockResolvedValue(
      createAccessContext({
        permissions: ["finance.write", "alerts.read"],
        roles: [],
        userId: "finance-user",
      }),
    );
  });

  it("does not grant the administrative Action to a domain writer without alerts.write", async () => {
    const formData = new FormData();
    formData.set("id", "70000000-0000-4000-8000-000000000002");
    formData.set("resolution", "Resolucao administrativa indevida.");

    await expect(resolveWorkItemAction(formData)).rejects.toBeInstanceOf(
      AccessDeniedError,
    );
    expect(mocks.enforceAuthenticatedRateLimit).not.toHaveBeenCalled();
    expect(mocks.resolveWorkItem).not.toHaveBeenCalled();
  });
});
