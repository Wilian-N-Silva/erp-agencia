import { beforeEach, expect, it, vi } from "vitest";
import { createAccessContext } from "@/tests/helpers/access-context";
const mocks = vi.hoisted(() => ({ context: vi.fn(), limit: vi.fn(), cancel: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/dal", async original => ({ ...await original<typeof import("@/lib/dal")>(), getCurrentAccessContext: mocks.context }));
vi.mock("@/lib/rate-limit", async original => ({ ...await original<typeof import("@/lib/rate-limit")>(), enforceAuthenticatedRateLimit: mocks.limit }));
vi.mock("@/features/saas/charge-cancellation", async original => ({ ...await original<typeof import("@/features/saas/charge-cancellation")>(), cancelSaasCharge: mocks.cancel }));
import { cancelSaasChargeAction } from "@/features/saas/charge-cancellation-actions";
const context = createAccessContext({ organizationId: "0d80aeaf-b7b6-4ea2-afb5-32654d17e2f6", userId: "reviewer", roles: [], permissions: ["finance.write", "finance.reverse"] });
function form(extra = {}) { const data = new FormData(); for (const [key,value] of Object.entries({ subscriptionId: "d1f6ba68-abf9-45c8-b0ba-c29a6c16b641", chargeId: "72e37ae0-394a-4232-820d-91e42a7e9a19", revision: "a".repeat(64), reason: "Cobrança incorreta", confirmation: "cancel", ...extra })) data.set(key,value); return data; }
beforeEach(() => { vi.clearAllMocks(); mocks.context.mockResolvedValue(context); mocks.limit.mockReset(); mocks.cancel.mockReset(); });
it("checks session, tenant and both permissions before consuming the rate limit or writing", async () => {
  for (const invalid of [null, { ...context, organizationId: null }, { ...context, permissions: ["finance.write"] }, { ...context, permissions: ["finance.reverse"] }]) {
    mocks.context.mockResolvedValue(invalid); expect((await cancelSaasChargeAction(form())).ok).toBe(false);
  }
  expect(mocks.limit).not.toHaveBeenCalled(); expect(mocks.cancel).not.toHaveBeenCalled();
});
it("requires explicit confirmation, revision and strict fields, and refreshes shared reads after success", async () => {
  for (const extra of [{ financialExpenseId: "injected" }, { confirmation: "" }, { reason: "ok" }, { revision: "invalid" }]) expect((await cancelSaasChargeAction(form(extra))).ok).toBe(false);
  expect(mocks.cancel).not.toHaveBeenCalled();
  expect((await cancelSaasChargeAction(form())).ok).toBe(true);
  expect(mocks.limit).toHaveBeenCalledWith("reconciliation", context);
  expect(mocks.revalidate).toHaveBeenCalledWith("/app", "layout");
});
it("does not leak internal errors or invalidate reads after failure", async () => {
  mocks.cancel.mockRejectedValueOnce(new Error("private database details"));
  const result = await cancelSaasChargeAction(form()); expect(result.ok).toBe(false); expect(result.message).not.toContain("private");
  expect(mocks.revalidate).not.toHaveBeenCalled();
});
