import { describe, expect, it } from "vitest";

import { calculatePrincipalAmount, calculateSaasChargeTotals, recordSaasChargeSchema } from "@/features/saas/charge-rules";

const base = {
  subscriptionId: "00000000-0000-4000-8000-000000000001",
  competence: "2026-10",
  chargedAt: "2026-10-02",
  dueDate: "2026-10-10",
  originalCurrency: "EUR" as const,
  originalAmount: "120,00",
  effectiveExchangeRate: "6,50",
  iofAmountBrl: "12,00",
  feeAmountBrl: "3,00",
  totalAmountBrl: "795,00",
  chargesIncludedInTotal: "true" as const,
  notes: "Fatura do cartão",
};

describe("SaaS charge rules", () => {
  it("converts the original amount using the effective rate with cent rounding", () => {
    expect(calculatePrincipalAmount("120.00", "6.500000")).toBe(78000);
    expect(calculateSaasChargeTotals({ originalAmount: "120.00", effectiveExchangeRate: "6.500000", iofAmountBrl: "12.00", feeAmountBrl: "3.00" })).toEqual({ principalAmountBrl: "780.00", totalWithoutEmbeddedCharges: "795.00" });
  });

  it("accepts an invoice total that already includes IOF and fees", () => {
    expect(recordSaasChargeSchema.parse(base).totalAmountBrl).toBe("795.00");
  });

  it("does not double count charges when the total excludes them", () => {
    expect(recordSaasChargeSchema.parse({ ...base, chargesIncludedInTotal: "false", totalAmountBrl: "795,00" }).totalAmountBrl).toBe("795.00");
    expect(() => recordSaasChargeSchema.parse({ ...base, chargesIncludedInTotal: "false", totalAmountBrl: "780,00" })).toThrow(/principal \+ IOF/);
  });

  it("requires BRL to use a unit exchange rate", () => {
    expect(() => recordSaasChargeSchema.parse({ ...base, originalCurrency: "BRL", originalAmount: "100,00", effectiveExchangeRate: "1,10", iofAmountBrl: "0,00", feeAmountBrl: "0,00", totalAmountBrl: "110,00" })).toThrow(/cotação efetiva/);
  });
});
