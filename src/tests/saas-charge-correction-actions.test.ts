import { beforeEach, expect, it, vi } from "vitest";
import { createAccessContext } from "@/tests/helpers/access-context";
const mocks = vi.hoisted(() => ({ context: vi.fn(), limit: vi.fn(), correct: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/dal", async original => ({ ...await original<typeof import("@/lib/dal")>(), getCurrentAccessContext: mocks.context }));
vi.mock("@/lib/rate-limit", async original => ({ ...await original<typeof import("@/lib/rate-limit")>(), enforceAuthenticatedRateLimit: mocks.limit }));
vi.mock("@/features/saas/charge-correction", async original => ({ ...await original<typeof import("@/features/saas/charge-correction")>(), correctSaasCharge: mocks.correct }));
import { correctSaasChargeAction } from "@/features/saas/charge-correction-actions";
const context = createAccessContext({ organizationId: "0d80aeaf-b7b6-4ea2-afb5-32654d17e2f6", userId: "reviewer", roles: [], permissions: ["finance.write", "finance.reverse"] });
function form(extra = {}) { const data = new FormData(); for (const [key,value] of Object.entries({ subscriptionId: "d1f6ba68-abf9-45c8-b0ba-c29a6c16b641", chargeId: "72e37ae0-394a-4232-820d-91e42a7e9a19", revision: "a".repeat(64), reason: "Conferência da fatura", competence: "2026-10", chargedAt: "2026-10-01", dueDate: "2026-10-15", originalCurrency: "EUR", originalAmount: "50", effectiveExchangeRate: "6.5", iofAmountBrl: "5", feeAmountBrl: "2", totalAmountBrl: "332", chargesIncludedInTotal: "false", notes: "", ...extra })) data.set(key,value); return data; }
beforeEach(() => { vi.clearAllMocks(); mocks.context.mockResolvedValue(context); mocks.limit.mockReset(); mocks.correct.mockReset(); });
it("checks session, tenant and both permissions before rate limit or mutation", async () => {
  for (const invalid of [null, { ...context, organizationId: null }, { ...context, permissions: ["finance.write"] }, { ...context, permissions: ["finance.reverse"] }]) {
    mocks.context.mockResolvedValue(invalid); expect((await correctSaasChargeAction(form())).ok).toBe(false);
  }
  expect(mocks.limit).not.toHaveBeenCalled(); expect(mocks.correct).not.toHaveBeenCalled();
});
it("validates strict fields and sends wire booleans to the DAL only after the persistent rate limit", async () => {
  expect((await correctSaasChargeAction(form({ financialExpenseId: "injected" }))).ok).toBe(false);
  expect(mocks.correct).not.toHaveBeenCalled();
  expect((await correctSaasChargeAction(form())).ok).toBe(true);
  expect(mocks.limit).toHaveBeenCalledWith("reconciliation", context);
  expect(mocks.correct).toHaveBeenCalledWith(context, expect.objectContaining({ chargesIncludedInTotal: "false" }));
});
it("returns safe errors and does not refresh failed changes", async () => {
  mocks.correct.mockRejectedValueOnce(new Error("private database details"));
  const result = await correctSaasChargeAction(form()); expect(result.ok).toBe(false); expect(result.message).not.toContain("private");
  expect(mocks.revalidate).not.toHaveBeenCalled();
});
