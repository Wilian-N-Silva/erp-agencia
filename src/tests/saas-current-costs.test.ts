import { describe, expect, it } from "vitest";
import { getSaasCurrentCosts, type SaasSubscriptionStatus } from "@/features/saas/rules";

const subscription = (status: SaasSubscriptionStatus, monthlyCost: string | null, costHidden = false) => ({
  status, monthlyCost, costHidden,
});

describe("SaaS current costs", () => {
  it("removes a cancelled contract from both estimates without changing its historical value", () => {
    const cancelled = subscription("cancelled", "123.45");
    expect(getSaasCurrentCosts([subscription("active", "1200.00"), cancelled])).toEqual({
      monthly: "1200.00", annualized: "14400.00",
    });
    expect(cancelled.monthlyCost).toBe("123.45");
  });

  it("keeps scheduled cancellations and other non-cancelled contract costs", () => {
    expect(getSaasCurrentCosts([
      subscription("cancel_scheduled", "10.10"), subscription("suspended", "20.20"),
      subscription("trial", "30.30"), subscription("renewing", "40.40"),
    ])).toEqual({ monthly: "101.00", annualized: "1212.00" });
  });

  it("omits restricted amounts and supports missing costs and an empty portfolio", () => {
    expect(getSaasCurrentCosts([subscription("active", "999.00", true), subscription("active", null)]))
      .toEqual({ monthly: "0.00", annualized: "0.00" });
    expect(getSaasCurrentCosts([])).toEqual({ monthly: "0.00", annualized: "0.00" });
  });

  it("sums fractional values in cents", () => {
    expect(getSaasCurrentCosts([subscription("active", "0.10"), subscription("active", "0.20")]))
      .toEqual({ monthly: "0.30", annualized: "3.60" });
  });
});
