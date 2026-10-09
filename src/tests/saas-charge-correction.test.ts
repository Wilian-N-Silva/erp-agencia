import { expect, it } from "vitest";
import { correctSaasChargeSchema } from "@/features/saas/charge-correction";
const request = { subscriptionId: "d1f6ba68-abf9-45c8-b0ba-c29a6c16b641", chargeId: "72e37ae0-394a-4232-820d-91e42a7e9a19", revision: "a".repeat(64), reason: "Conferência da fatura", competence: "2026-10", chargedAt: "2026-10-01", dueDate: "2026-10-15", originalCurrency: "EUR", originalAmount: "50", effectiveExchangeRate: "6.5", iofAmountBrl: "5", feeAmountBrl: "2", totalAmountBrl: "332", chargesIncludedInTotal: "false", notes: "" };
it("retains original exchange/IOF validation and requires revision, reason and strict fields", () => {
  expect(correctSaasChargeSchema.parse(request)).toMatchObject({ totalAmountBrl: "332.00", effectiveExchangeRate: "6.500000" });
  for (const change of [{ totalAmountBrl: "331" }, { originalCurrency: "BRL" }, { reason: "ok" }, { revision: "bad" }, { financialExpenseId: request.chargeId }]) expect(correctSaasChargeSchema.safeParse({ ...request, ...change }).success).toBe(false);
});
