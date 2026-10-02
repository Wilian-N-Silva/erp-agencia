import { expect, it } from "vitest";
import { estimateSaasBilling, saasBillingSchema } from "@/features/saas/billing-rules";
import { getSaasCurrentCosts } from "@/features/saas/rules";

it("keeps the annual amount independent from rounded monthly equivalents", () => {
  const estimate = estimateSaasBilling(saasBillingSchema.parse({ cycleAmount: "100", billingCycle: "annual" }));
  expect(estimate).toEqual({ cycleEstimate: "100.00", monthly: "8.33", annualized: "100.00" });
  expect(getSaasCurrentCosts([{ status: "active", costHidden: false, monthlyCost: estimate.monthly, annualizedCost: estimate.annualized }])).toEqual({ monthly: "8.33", annualized: "100.00" });
});
it("converts the original cycle with a dated manual rate and does not presume fees", () => {
  const billing = saasBillingSchema.parse({ cycleAmount: "120,00", billingCurrency: "EUR", billingCycle: "annual", estimatedExchangeRate: "6,123456", exchangeRateDate: "2026-10-02", exchangeRateSource: "Simulação QA" });
  expect(estimateSaasBilling(billing)).toEqual({ cycleEstimate: "734.81", monthly: "61.23", annualized: "734.81" });
  expect(billing.cycleAmount).toBe("120.00");
});
it("marks missing currency conversions as unknown and preserves legacy BRL monthly costs", () => {
  expect(estimateSaasBilling(saasBillingSchema.parse({ cycleAmount: "20", billingCurrency: "USD" }))).toEqual({ cycleEstimate: null, monthly: null, annualized: null });
  expect(estimateSaasBilling({ ...saasBillingSchema.parse({}), monthlyCost: "87.65" })).toEqual({ cycleEstimate: "87.65", monthly: "87.65", annualized: "1051.80" });
});
it("rejects unsupported currencies, negative values and incomplete rate provenance", () => {
  for (const input of [{ billingCurrency: "BTC" }, { cycleAmount: "-10" }, { billingCurrency: "USD", estimatedExchangeRate: "5" }, { billingCurrency: "EUR", estimatedExchangeRate: "-1" }])
    expect(saasBillingSchema.safeParse(input).success).toBe(false);
});
