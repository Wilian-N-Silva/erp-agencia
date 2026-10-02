import { expect, it } from "vitest";
import { calculatePjBalance, suggestPjSale } from "@/features/timeoff/pj-policy-rules";

it("suggests half the current monthly base for 15 days, including updated compensation", () => {
  expect(suggestPjSale("3900.00", 15).amount).toBe("1950.00");
  expect(suggestPjSale("4500.00", 15).amount).toBe("2250.00");
});
it("allows agreed quantities other than the default 15 days", () => {
  expect(suggestPjSale("4500.00", 10)).toEqual({ baseAmount: "4500.00", days: 10, divisor: 30, amount: "1500.00" });
});
it("rounds once at the final cent rather than rounding a daily rate first", () => {
  expect(suggestPjSale("1000.01", 15).amount).toBe("500.01");
  expect(suggestPjSale("1000.00", 10).amount).toBe("333.33");
  expect(() => suggestPjSale("0.00", 15)).toThrow();
  expect(() => suggestPjSale("3900.00", 1.5)).toThrow();
  expect(() => suggestPjSale("3900.00", -15)).toThrow();
});
it("accrues 30 days per completed year and carries unused days forward", () => {
  expect(calculatePjBalance("2024-10-10", "2026-10-09", []).acquired).toBe(30);
  expect(calculatePjBalance("2024-10-10", "2026-10-10", []).available).toBe(60);
});
it("reserves pending days and consumes approved rest/sale; rejected and cancelled do not consume", () => {
  const request = { type: "planned_pause", startDate: "2026-10-01", endDate: "2026-10-10", soldDays: 0, status: "requested" };
  expect(calculatePjBalance("2025-01-01", "2026-10-01", [
    request, { ...request, status: "approved", endDate: "2026-10-15" },
    { ...request, type: "sale", status: "approved", soldDays: 5 },
    { ...request, status: "rejected" }, { ...request, status: "cancelled" },
    { ...request, type: "absence", status: "approved" },
  ])).toEqual({ acquired: 30, reserved: 10, used: 15, sold: 5, available: 0 });
});
