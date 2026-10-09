import { beforeEach, expect, it, vi } from "vitest";
import { createAccessContext } from "@/tests/helpers/access-context";
const mocks = vi.hoisted(() => ({ context: vi.fn(), limit: vi.fn(), release: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/dal", async original => ({ ...await original<typeof import("@/lib/dal")>(), getCurrentAccessContext: mocks.context }));
vi.mock("@/lib/rate-limit", async original => ({ ...await original<typeof import("@/lib/rate-limit")>(), enforceAuthenticatedRateLimit: mocks.limit }));
vi.mock("@/features/finance/legacy-review", async original => ({ ...await original<typeof import("@/features/finance/legacy-review")>(), releaseFinancialLegacyReserve: mocks.release }));
import { releaseFinancialLegacyReserveAction } from "@/features/finance/legacy-review-actions";
import { RateLimitExceededError } from "@/lib/rate-limit";
const context = createAccessContext({ organizationId: "0d80aeaf-b7b6-4ea2-afb5-32654d17e2f6", userId: "reviewer", roles: [], permissions: ["finance.reverse"] });
function form(extra = {}) { const data = new FormData(); for (const [key,value] of Object.entries({ type: "receivable", id: "d1f6ba68-abf9-45c8-b0ba-c29a6c16b641", requestId: "72e37ae0-394a-4232-820d-91e42a7e9a19", amount: "40", reason: "Histórico duplicado", evidence: "Extrato conferido pela gestão", confirmed: "yes", ...extra })) data.set(key,value); return data; }
beforeEach(() => { vi.clearAllMocks(); mocks.context.mockResolvedValue(context); mocks.limit.mockReset(); mocks.release.mockReset(); });
it("requires session, reversal permission and tenant before rate limit or mutation", async () => {
  for (const invalid of [null, { ...context, permissions: ["finance.write"] }, { ...context, organizationId: null }]) {
    mocks.context.mockResolvedValue(invalid);
    expect((await releaseFinancialLegacyReserveAction(form())).ok).toBe(false);
  }
  expect(mocks.limit).not.toHaveBeenCalled(); expect(mocks.release).not.toHaveBeenCalled();
});
it("enforces persistent rate limit and strict payload before mutation", async () => {
  mocks.limit.mockRejectedValueOnce(new RateLimitExceededError({ allowed: false, retryAfterSeconds: 30, limit: 1, remaining: 0, resetAt: new Date() }));
  expect((await releaseFinancialLegacyReserveAction(form())).ok).toBe(false);
  expect((await releaseFinancialLegacyReserveAction(form({ organizationId: context.organizationId! }))).ok).toBe(false);
  expect(mocks.release).not.toHaveBeenCalled(); expect(mocks.limit).toHaveBeenCalledWith("reconciliation", context);
});
it("normalizes cents and returns a safe error if transaction fails", async () => {
  expect((await releaseFinancialLegacyReserveAction(form())).ok).toBe(true);
  expect(mocks.release).toHaveBeenCalledWith(context, expect.objectContaining({ amount: "40.00" }));
  mocks.release.mockRejectedValueOnce(new Error("secret database details"));
  const result = await releaseFinancialLegacyReserveAction(form());
  expect(result.ok).toBe(false); expect(result.message).not.toContain("secret");
});
