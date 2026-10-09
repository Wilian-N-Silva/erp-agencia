import { beforeEach, expect, it, vi } from "vitest";
import type { AccessContext } from "@/lib/dal";
const mocks = vi.hoisted(() => ({ context: vi.fn(), rate: vi.fn(), reverse: vi.fn(), refresh: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.refresh }));
vi.mock("@/lib/dal", () => ({ getCurrentAccessContext: mocks.context }));
vi.mock("@/lib/rate-limit", () => ({ enforceAuthenticatedRateLimit: mocks.rate, RateLimitExceededError: class RateLimitExceededError extends Error {} }));
vi.mock("@/features/finance-transactions/reversal", () => ({ reverseFinancialTransaction: mocks.reverse, FinancialReversalError: class FinancialReversalError extends Error {} }));
import { reverseFinancialTransactionAction } from "@/features/finance-transactions/reversal-actions";
import { RateLimitExceededError } from "@/lib/rate-limit";
const id = "00100000-0000-4000-8000-000000000001";
const context: AccessContext = { userId: "user", organizationId: id, employeeId: null, roles: [], permissions: ["finance.read", "finance.reverse"] };
const form = () => { const data = new FormData(); data.set("transactionId", id); data.set("reason", "Registro duplicado"); return data; };
beforeEach(() => { vi.resetAllMocks(); mocks.context.mockResolvedValue(context); mocks.reverse.mockResolvedValue({ id }); });
it("requires session and specific reversal permission before invoking the ledger", async () => {
  for (const denied of [null, { ...context, organizationId: null }, { ...context, permissions: ["finance.write", "finance.settle"] }]) {
    mocks.context.mockResolvedValue(denied);
    expect((await reverseFinancialTransactionAction(form())).ok).toBe(false);
  }
  expect(mocks.reverse).not.toHaveBeenCalled(); expect(mocks.rate).not.toHaveBeenCalled();
});
it("enforces rate limit before reversal and contains unexpected errors", async () => {
  mocks.rate.mockRejectedValue(Object.setPrototypeOf(new Error("secret"), RateLimitExceededError.prototype));
  expect((await reverseFinancialTransactionAction(form())).ok).toBe(false);
  expect(mocks.reverse).not.toHaveBeenCalled();
  mocks.rate.mockResolvedValue(undefined); mocks.reverse.mockRejectedValue(new Error("database secret"));
  expect((await reverseFinancialTransactionAction(form())).message).not.toContain("secret");
  expect(mocks.refresh).not.toHaveBeenCalled();
});
it("revalidates consumers only after a committed reversal", async () => {
  expect((await reverseFinancialTransactionAction(form())).ok).toBe(true);
  expect(mocks.rate).toHaveBeenCalledWith("reconciliation", context);
  expect(mocks.reverse).toHaveBeenCalledWith(context, { transactionId: id, reason: "Registro duplicado" });
  expect(mocks.refresh).toHaveBeenCalledWith("/app", "layout");
});
