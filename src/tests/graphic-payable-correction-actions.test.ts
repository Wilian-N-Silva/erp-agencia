import { beforeEach, expect, it, vi } from "vitest";
import { createAccessContext } from "@/tests/helpers/access-context";
const mocks = vi.hoisted(() => ({ context: vi.fn(), limit: vi.fn(), correct: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/dal", async original => ({ ...await original<typeof import("@/lib/dal")>(), getCurrentAccessContext: mocks.context }));
vi.mock("@/lib/rate-limit", async original => ({ ...await original<typeof import("@/lib/rate-limit")>(), enforceAuthenticatedRateLimit: mocks.limit }));
vi.mock("@/features/graphics/payable-correction", async original => ({ ...await original<typeof import("@/features/graphics/payable-correction")>(), correctGraphicPayable: mocks.correct }));
import { correctGraphicPayableAction } from "@/features/graphics/payable-correction-actions";
import { correctGraphicPayableSchema } from "@/features/graphics/payable-correction";
const context = createAccessContext({ organizationId: "0d80aeaf-b7b6-4ea2-afb5-32654d17e2f6", userId: "reviewer", roles: [], permissions: ["finance.write", "finance.reverse"] });
const request = { jobId: "d1f6ba68-abf9-45c8-b0ba-c29a6c16b641", commitmentId: "72e37ae0-394a-4232-820d-91e42a7e9a19", revision: "a".repeat(64), amount: "1250,00", dueDate: "2026-10-05", competence: "2026-09", reason: "Conferência com fornecedor" };
function form() { const data = new FormData(); for (const [key,value] of Object.entries(request)) data.set(key,value); return data; }
beforeEach(() => { vi.clearAllMocks(); mocks.context.mockResolvedValue(context); mocks.limit.mockReset(); mocks.correct.mockReset(); });
it("requires session, tenant and both financial permissions before rate limit and DAL", async () => {
  for (const invalid of [null, { ...context, organizationId: null }, { ...context, permissions: ["finance.write"] }, { ...context, permissions: ["finance.reverse"] }]) {
    mocks.context.mockResolvedValue(invalid); expect((await correctGraphicPayableAction(form())).ok).toBe(false);
  }
  expect(mocks.limit).not.toHaveBeenCalled(); expect(mocks.correct).not.toHaveBeenCalled();
});
it("validates money, reason, dates, revision and strict identity fields at the server boundary", () => {
  expect(correctGraphicPayableSchema.parse(request).amount).toBe("1250.00");
  for (const extra of [{ amount: "-1" }, { amount: "0" }, { amount: "10000000000" }, { dueDate: "2026-02-31" }, { competence: "2026-13" }, { reason: "ok" }, { revision: "bad" }, { expenseId: request.commitmentId }, { organizationId: context.organizationId }]) expect(correctGraphicPayableSchema.safeParse({ ...request, ...extra }).success).toBe(false);
});
it("uses persistent financial rate limiting, refreshes shared reads and hides unexpected errors", async () => {
  expect((await correctGraphicPayableAction(form())).ok).toBe(true);
  expect(mocks.limit).toHaveBeenCalledWith("reconciliation", context); expect(mocks.correct).toHaveBeenCalledWith(context, request); expect(mocks.revalidate).toHaveBeenCalledWith("/app", "layout");
  mocks.revalidate.mockClear(); mocks.correct.mockRejectedValueOnce(new Error("private connection details"));
  const result = await correctGraphicPayableAction(form()); expect(result.ok).toBe(false); expect(result.message).not.toContain("private"); expect(mocks.revalidate).not.toHaveBeenCalled();
});
