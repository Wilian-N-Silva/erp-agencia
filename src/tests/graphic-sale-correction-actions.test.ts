import { beforeEach, expect, it, vi } from "vitest";
import { createAccessContext } from "@/tests/helpers/access-context";
const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  limit: vi.fn(),
  correct: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/dal", async (original) => ({
  ...(await original<typeof import("@/lib/dal")>()),
  getCurrentAccessContext: mocks.context,
}));
vi.mock("@/lib/rate-limit", async (original) => ({
  ...(await original<typeof import("@/lib/rate-limit")>()),
  enforceAuthenticatedRateLimit: mocks.limit,
}));
vi.mock("@/features/graphics/sale-correction", () => ({
  correctGraphicSale: mocks.correct,
}));
import { correctGraphicSaleAction } from "@/features/graphics/sale-correction-actions";
import { correctGraphicSaleSchema } from "@/features/graphics/sale-correction-rules";
const context = createAccessContext({
  organizationId: "0d80aeaf-b7b6-4ea2-afb5-32654d17e2f6",
  userId: "reviewer",
  roles: [],
  permissions: ["finance.write", "finance.reverse"],
});
const request = {
  jobId: "d1f6ba68-abf9-45c8-b0ba-c29a6c16b641",
  saleId: "72e37ae0-394a-4232-820d-91e42a7e9a19",
  revision: "a".repeat(64),
  amount: "1250,00",
  competence: "2026-09",
  reason: "Conferência com cliente",
  installments: [
    {
      entryId: "6a410da8-4038-4813-91c7-c25035b4f668",
      amount: "500",
      dueDate: "2026-10-05",
    },
    {
      entryId: "97bd7cb3-adca-4a79-a209-81e8f2736174",
      amount: "750",
      dueDate: "2026-11-05",
    },
  ],
};
function form() {
  const data = new FormData();
  for (const [key, value] of Object.entries(request))
    data.set(key, typeof value === "string" ? value : JSON.stringify(value));
  return data;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.context.mockResolvedValue(context);
  mocks.limit.mockReset();
  mocks.correct.mockReset();
});
it("requires session, tenant and both financial permissions before rate limit and DAL", async () => {
  for (const invalid of [
    null,
    { ...context, organizationId: null },
    { ...context, permissions: ["finance.write"] },
    { ...context, permissions: ["finance.reverse"] },
  ]) {
    mocks.context.mockResolvedValue(invalid);
    expect((await correctGraphicSaleAction(form())).ok).toBe(false);
  }
  expect(mocks.limit).not.toHaveBeenCalled();
  expect(mocks.correct).not.toHaveBeenCalled();
});
it("validates precise money, sum, original identities, dates and payload tampering", () => {
  expect(correctGraphicSaleSchema.parse(request).amount).toBe("1250.00");
  for (const extra of [
    { amount: "-1" },
    { amount: "0" },
    { amount: "10000000000" },
    { amount: "1200" },
    { competence: "2026-13" },
    { reason: "ok" },
    { revision: "bad" },
    { organizationId: context.organizationId },
    { installments: [request.installments[0], request.installments[0]] },
    {
      installments: [
        { ...request.installments[0], dueDate: "2026-02-31" },
        request.installments[1],
      ],
    },
    {
      installments: [
        { ...request.installments[0], clientId: request.jobId },
        request.installments[1],
      ],
    },
  ])
    expect(
      correctGraphicSaleSchema.safeParse({ ...request, ...extra }).success,
    ).toBe(false);
});
it("limits financial writes, bounds JSON and hides unexpected errors without refreshing failed operations", async () => {
  expect((await correctGraphicSaleAction(form())).ok).toBe(true);
  expect(mocks.limit).toHaveBeenCalledWith("reconciliation", context);
  expect(mocks.correct).toHaveBeenCalledWith(context, request);
  expect(mocks.revalidate).toHaveBeenCalledWith("/app", "layout");
  mocks.correct.mockClear();
  for (const value of ["invalid", "x".repeat(20_001)]) {
    const data = form();
    data.set("installments", value);
    expect((await correctGraphicSaleAction(data)).ok).toBe(false);
  }
  expect(mocks.correct).not.toHaveBeenCalled();
  mocks.revalidate.mockClear();
  mocks.correct.mockRejectedValueOnce(new Error("private connection details"));
  const result = await correctGraphicSaleAction(form());
  expect(result.ok).toBe(false);
  expect(result.message).not.toContain("private");
  expect(mocks.revalidate).not.toHaveBeenCalled();
});
