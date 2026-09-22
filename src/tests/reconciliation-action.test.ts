import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ context: vi.fn(), limit: vi.fn(), confirm: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/dal", () => ({ getCurrentAccessContext: mocks.context }));
vi.mock("@/features/finance-allocations/reconciliation", () => ({ confirmReconciliation: mocks.confirm }));
vi.mock("@/lib/rate-limit", async original => ({ ...await original<typeof import("@/lib/rate-limit")>(), enforceAuthenticatedRateLimit: mocks.limit }));
import { reconcileMovementAction } from "@/features/finance-allocations/actions";
import { RateLimitExceededError } from "@/lib/rate-limit";

const context = { userId: "finance-user", organizationId: "10000000-0000-4000-8000-000000000001", permissions: ["finance.settle"], roles: [], employeeId: null };
function form() {
  const data = new FormData();
  data.set("transactionId", "20000000-0000-4000-8000-000000000001");
  data.set("expectedRemaining", "100.00");
  data.set("allocations", JSON.stringify([{ targetType: "receivable", targetId: "30000000-0000-4000-8000-000000000001", amount: "30.00" }]));
  data.set("confirmed", "on");
  return data;
}
beforeEach(() => { vi.resetAllMocks(); mocks.context.mockResolvedValue(context); });
it("blocks missing session, department permissions and throttled requests before financial writes", async () => {
  mocks.context.mockResolvedValueOnce(null);
  expect((await reconcileMovementAction(form())).ok).toBe(false);
  mocks.context.mockResolvedValueOnce({ ...context, permissions: ["graphics.write"] });
  expect((await reconcileMovementAction(form())).ok).toBe(false);
  expect(mocks.limit).not.toHaveBeenCalled();
  mocks.limit.mockRejectedValueOnce(new RateLimitExceededError({ allowed: false, limit: 1, remaining: 0, resetAt: new Date(), retryAfterSeconds: 30 }));
  expect((await reconcileMovementAction(form())).message).toContain("Muitas tentativas");
  expect(mocks.confirm).not.toHaveBeenCalled();
});
it("requires explicit confirmation, rejects injected organization and bounds the JSON payload", async () => {
  for (const mutate of [(data: FormData) => data.delete("confirmed"), (data: FormData) => data.set("organizationId", context.organizationId), (data: FormData) => data.set("allocations", "[".repeat(30001))]) {
    const data = form(); mutate(data);
    expect((await reconcileMovementAction(data)).ok).toBe(false);
  }
  expect(mocks.confirm).not.toHaveBeenCalled();
  expect((await reconcileMovementAction(form())).ok).toBe(true);
  expect(mocks.limit).toHaveBeenCalledWith("reconciliation", context);
  expect(mocks.confirm).toHaveBeenCalledWith(context, expect.objectContaining({ expectedRemaining: "100.00" }));
});
