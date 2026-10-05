import { beforeEach, expect, it, vi } from "vitest";
import type { AccessContext } from "@/lib/dal";
const mocks = vi.hoisted(() => ({ context: vi.fn(), rate: vi.fn(), plan: vi.fn(), realize: vi.fn(), cancel: vi.fn(), refresh: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.refresh }));
vi.mock("@/lib/dal", () => ({ getCurrentAccessContext: mocks.context }));
vi.mock("@/lib/rate-limit", () => ({ enforceAuthenticatedRateLimit: mocks.rate, RateLimitExceededError: class RateLimitExceededError extends Error {} }));
vi.mock("@/features/provisions/dal", () => ({ planProvisionCycle: mocks.plan, realizeProvisionCycle: mocks.realize, cancelProvisionCycle: mocks.cancel }));
import { cancelProvisionCycleAction, planProvisionCycleAction, realizeProvisionCycleAction } from "@/features/provisions/actions";
import { RateLimitExceededError } from "@/lib/rate-limit";
const id = "00100000-0000-4000-8000-000000000001";
const context: AccessContext = { userId: "user", organizationId: id, employeeId: null, roles: [], permissions: ["finance.write"] };
const form = (values: Record<string, string>) => { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value); return data; };
const cases: Array<{ action: typeof planProvisionCycleAction; operation: typeof mocks.plan; input: Record<string, string>; status: string }> = [
  { action: planProvisionCycleAction, operation: mocks.plan, input: { provisionId: id, competence: "2026-10", dueDate: "2026-10-20", estimatedAmount: "100" }, status: "planned" },
  { action: realizeProvisionCycleAction, operation: mocks.realize, input: { id, supplierId: id, amount: "110", dueDate: "2026-10-20" }, status: "realized" },
  { action: cancelProvisionCycleAction, operation: mocks.cancel, input: { id, reason: "Não haverá cobrança" }, status: "cancelled" },
];
beforeEach(() => {
  vi.resetAllMocks();
  mocks.context.mockResolvedValue(context);
  for (const item of cases) item.operation.mockResolvedValue({ id, status: item.status });
});
for (const item of cases) {
  it(`${item.status}: rejects unauthenticated, read-only and tenantless users before writing`, async () => {
    for (const denied of [null, { ...context, permissions: ["finance.read"] }, { ...context, organizationId: null }]) {
      mocks.context.mockResolvedValue(denied);
      expect((await item.action(form(item.input))).ok).toBe(false);
    }
    expect(item.operation).not.toHaveBeenCalled();
    expect(mocks.rate).not.toHaveBeenCalled();
  });
  it(`${item.status}: rate limit precedes writes and errors do not leak details`, async () => {
    mocks.rate.mockRejectedValue(Object.setPrototypeOf(new Error("internal secret"), RateLimitExceededError.prototype));
    expect(await item.action(form(item.input))).toMatchObject({ ok: false, message: expect.stringContaining("Aguarde") });
    expect(item.operation).not.toHaveBeenCalled();
    mocks.rate.mockResolvedValue(undefined);
    item.operation.mockRejectedValue(new Error("postgres://secret database details"));
    const result = await item.action(form(item.input));
    expect(result.ok).toBe(false);
    expect(result.message).not.toContain("secret");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it(`${item.status}: rejects injected fields and invalid identifiers`, async () => {
    for (const input of [{ ...item.input, organizationId: id }, { ...item.input, paidAmount: "100" }, { ...item.input, ...(item.status === "planned" ? { provisionId: "bad" } : { id: "bad" }) }]) {
      expect((await item.action(form(input))).ok).toBe(false);
    }
    expect(item.operation).not.toHaveBeenCalled();
  });
  it(`${item.status}: reports committed state and refreshes financial routes`, async () => {
    expect(await item.action(form(item.input))).toMatchObject({ ok: true, id, status: item.status });
    expect(mocks.rate).toHaveBeenCalledWith("common_mutation", context);
    expect(item.operation).toHaveBeenCalledWith(context, expect.objectContaining(item.input));
    expect(mocks.refresh).toHaveBeenCalledWith("/app/financeiro", "layout");
  });
}
