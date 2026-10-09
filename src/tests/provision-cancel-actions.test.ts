import { beforeEach, expect, it, vi } from "vitest";
import { createAccessContext } from "@/tests/helpers/access-context";
const mocks = vi.hoisted(() => ({ context: vi.fn(), limit: vi.fn(), cancel: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/dal", async original => ({ ...await original<typeof import("@/lib/dal")>(), getCurrentAccessContext: mocks.context }));
vi.mock("@/lib/rate-limit", async original => ({ ...await original<typeof import("@/lib/rate-limit")>(), enforceAuthenticatedRateLimit: mocks.limit }));
vi.mock("@/features/provisions/dal", () => ({ cancelProvisionCycle: mocks.cancel, correctRealizedProvisionCycle: vi.fn(), planProvisionCycle: vi.fn(), realizeProvisionCycle: vi.fn() }));
import { cancelProvisionCycleAction, cancelRealizedProvisionCycleAction } from "@/features/provisions/actions";
const context = createAccessContext({ organizationId: "0d80aeaf-b7b6-4ea2-afb5-32654d17e2f6", userId: "reviewer", roles: [], permissions: ["finance.write", "finance.reverse"] });
function form(extra = {}) { const data = new FormData(); for (const [key,value] of Object.entries({ id: "d1f6ba68-abf9-45c8-b0ba-c29a6c16b641", reason: "Cobrança cancelada", ...extra })) data.set(key,value); return data; }
beforeEach(() => { vi.clearAllMocks(); mocks.context.mockResolvedValue(context); mocks.limit.mockReset(); mocks.cancel.mockReset(); mocks.cancel.mockResolvedValue({ id: "cycle", status: "cancelled" }); });
it("denies realized cancellation without session, tenant or both permissions before mutation", async () => {
  for (const invalid of [null, { ...context, organizationId: null }, { ...context, permissions: ["finance.write"] }, { ...context, permissions: ["finance.reverse"] }]) {
    mocks.context.mockResolvedValue(invalid);
    expect((await cancelRealizedProvisionCycleAction(form())).ok).toBe(false);
  }
  expect(mocks.limit).not.toHaveBeenCalled(); expect(mocks.cancel).not.toHaveBeenCalled();
});
it("uses the reconciliation bucket for both cancellation paths and preserves planned cancellation access", async () => {
  expect((await cancelRealizedProvisionCycleAction(form())).ok).toBe(true);
  expect(mocks.limit).toHaveBeenCalledWith("reconciliation", context);
  mocks.context.mockResolvedValue({ ...context, permissions: ["finance.write"] });
  expect((await cancelProvisionCycleAction(form())).ok).toBe(true);
  expect(mocks.limit).toHaveBeenLastCalledWith("reconciliation", expect.objectContaining({ permissions: ["finance.write"] }));
});
it("rejects tampering and returns safe errors without invalidating failed writes", async () => {
  expect((await cancelRealizedProvisionCycleAction(form({ financialExpenseId: "injected" }))).ok).toBe(false);
  expect(mocks.cancel).not.toHaveBeenCalled();
  mocks.cancel.mockRejectedValueOnce(new Error("private database details"));
  const result = await cancelRealizedProvisionCycleAction(form());
  expect(result.ok).toBe(false); expect(result.message).not.toContain("private");
  expect(mocks.revalidate).not.toHaveBeenCalled();
});
