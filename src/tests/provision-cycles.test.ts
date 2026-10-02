import { describe, expect, it } from "vitest";
import { cancelCycleSchema, cycleMoneySchema, planCycleSchema } from "@/features/provisions/rules";

describe("provision cycle inputs", () => {
  it("accepts cent values and rejects rounding, negative and excessive values", () => {
    expect(cycleMoneySchema.parse(" 123,45 ")).toBe("123.45");
    for (const amount of ["0", "-1", "1.999", "NaN", "1e3", "10000000000", "1,000.01"])
      expect(cycleMoneySchema.safeParse(amount).success).toBe(false);
  });
  it("rejects invalid dates, status injection and an empty cancellation reason", () => {
    const input = { provisionId: "00100000-0000-4000-8000-000000000001", competence: "2026-10", dueDate: "2026-10-31", estimatedAmount: "50" };
    expect(planCycleSchema.safeParse(input).success).toBe(true);
    for (const change of [{ competence: "2026-13" }, { dueDate: "2026-02-30" }, { status: "realized" }])
      expect(planCycleSchema.safeParse({ ...input, ...change }).success).toBe(false);
    expect(cancelCycleSchema.safeParse({ id: input.provisionId, reason: " " }).success).toBe(false);
  });
});
