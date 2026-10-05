import { describe, expect, it } from "vitest";
import { cancelCycleSchema, cycleMoneySchema, planCycleSchema } from "@/features/provisions/rules";
import { computeFinanceDashboard, type ProvisionRecord } from "@/features/finance/rules";

const base: ProvisionRecord = { estimatedMonthlyAmount: "100.00", expectedDay: 15, recurring: true, status: "active" };
const cycle = { competence: "2026-10", estimatedAmount: "90.00", dueDate: "2026-10-15", status: "planned" };
function dashboard(provision: ProvisionRecord, asOf = "2026-10-01") {
  return computeFinanceDashboard({ entries: [], expenses: [], provisions: [provision], asOf }).totals;
}

describe("provision forecast by occurrence", () => {
  it("replaces the monthly template with the explicit estimate and removes realized or cancelled cycles", () => {
    expect(dashboard({ ...base, cycles: [cycle] })).toMatchObject({ provisionsExpected: "90.00", forecast30Days: "-90.00" });
    for (const status of ["realized", "cancelled"]) {
      expect(dashboard({ ...base, cycles: [{ ...cycle, status }] })).toMatchObject({ provisionsExpected: "0.00", forecast30Days: "0.00" });
      expect(dashboard({ ...base, cycles: [{ ...cycle, status }] }, "2026-11-01").provisionsExpected).toBe("100.00");
    }
  });
  it("counts the AP once after realization and only its unpaid balance in the cash forecast", () => {
    const result = computeFinanceDashboard({ entries: [], provisions: [{ ...base, cycles: [{ ...cycle, status: "realized" }] }],
      expenses: [{ amount: "120.00", paidAmount: "20.00", competence: "2026-10", dueDate: "2026-10-15", status: "planned" }], asOf: "2026-10-01" });
    expect(result.totals).toMatchObject({ provisionsExpected: "0.00", expensesExpected: "120.00", expensesPaid: "20.00", forecast30Days: "-100.00" });
  });
  it("keeps an explicit one-off occurrence when the template is inactive and respects its shifted due date", () => {
    const provision = { ...base, status: "inactive", recurring: false, cycles: [{ ...cycle, dueDate: "2026-11-05" }] };
    expect(dashboard(provision)).toMatchObject({ provisionsExpected: "90.00", forecast30Days: "0.00" });
    expect(dashboard(provision, "2026-11-01")).toMatchObject({ provisionsExpected: "0.00", forecast30Days: "-90.00" });
  });
  it("counts each occurrence in a cross-month horizon, clamping February dates", () => {
    expect(dashboard({ ...base, expectedDay: 28 }, "2026-02-28").forecast30Days).toBe("-200.00");
    expect(dashboard({ ...base, expectedDay: 31 }, "2026-02-01").forecast30Days).toBe("-100.00");
    expect(dashboard({ ...base, expectedDay: null }).forecast30Days).toBe("0.00");
  });
});

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
