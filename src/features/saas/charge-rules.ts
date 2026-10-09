import { z } from "zod";

import { centsToMoney, moneyToCents } from "@/features/finance/rules";
import { isoDateSchema, isoMonthSchema } from "@/lib/validation";

const positiveMoney = (label: string) => z.string().trim()
  .transform((value) => value.replace(/\s/g, "").replace(",", "."))
  .refine((value) => /^\d{1,10}(?:\.\d{1,2})?$/.test(value), label)
  .transform((value) => centsToMoney(moneyToCents(value)))
  .refine((value) => moneyToCents(value) > 0, label);

const nonNegativeMoney = (label: string) => z.string().trim()
  .transform((value) => value.replace(/\s/g, "").replace(",", "."))
  .refine((value) => /^\d{1,10}(?:\.\d{1,2})?$/.test(value), label)
  .transform((value) => centsToMoney(moneyToCents(value)));

const exchangeRate = z.string().trim()
  .transform((value) => value.replace(",", "."))
  .refine((value) => /^\d{1,6}(?:\.\d{1,6})?$/.test(value) && Number(value) > 0, "Informe uma cotação efetiva positiva.")
  .transform((value) => Number(value).toFixed(6));

export const recordSaasChargeSchema = z.strictObject({
  subscriptionId: z.string().uuid(),
  competence: isoMonthSchema,
  chargedAt: isoDateSchema,
  dueDate: isoDateSchema,
  originalCurrency: z.enum(["BRL", "USD", "EUR"]),
  originalAmount: positiveMoney("Informe o valor original positivo."),
  effectiveExchangeRate: exchangeRate,
  iofAmountBrl: nonNegativeMoney("Informe um IOF válido."),
  feeAmountBrl: nonNegativeMoney("Informe uma tarifa válida."),
  totalAmountBrl: positiveMoney("Informe o total efetivamente cobrado."),
  chargesIncludedInTotal: z.enum(["true", "false"]).transform((value) => value === "true"),
  notes: z.string().trim().max(1000).transform((value) => value || null),
}).superRefine((input, ctx) => {
  const principal = calculatePrincipalAmount(input.originalAmount, input.effectiveExchangeRate);
  const total = moneyToCents(input.totalAmountBrl);
  const iof = moneyToCents(input.iofAmountBrl);
  const fee = moneyToCents(input.feeAmountBrl);

  if (input.originalCurrency === "BRL" && input.effectiveExchangeRate !== "1.000000") {
    ctx.addIssue({ code: "custom", path: ["effectiveExchangeRate"], message: "Para BRL, a cotação efetiva deve ser 1." });
  }
  if (total < principal) {
    ctx.addIssue({ code: "custom", path: ["totalAmountBrl"], message: "O total não pode ser menor que o principal convertido." });
  }
  if (input.chargesIncludedInTotal && iof + fee > total) {
    ctx.addIssue({ code: "custom", path: ["totalAmountBrl"], message: "IOF e tarifas informados excedem o total da fatura." });
  }
  if (!input.chargesIncludedInTotal && total !== principal + iof + fee) {
    ctx.addIssue({ code: "custom", path: ["totalAmountBrl"], message: "Sem encargos incluídos, o total deve ser principal + IOF + tarifas." });
  }
});

export type RecordSaasChargeInput = z.output<typeof recordSaasChargeSchema>;

export function calculatePrincipalAmount(originalAmount: string, effectiveExchangeRate: string) {
  const originalCents = BigInt(moneyToCents(originalAmount));
  const rateFraction = effectiveExchangeRate.split(".")[1] ?? "";
  const million = BigInt(1000000);
  const rateScaled = BigInt(effectiveExchangeRate.split(".")[0]) * million + BigInt(rateFraction.padEnd(6, "0"));
  return Number((originalCents * rateScaled + BigInt(500000)) / million);
}

export function calculateSaasChargeTotals(input: Pick<RecordSaasChargeInput, "originalAmount" | "effectiveExchangeRate" | "iofAmountBrl" | "feeAmountBrl">) {
  const principalCents = calculatePrincipalAmount(input.originalAmount, input.effectiveExchangeRate);
  const iofCents = moneyToCents(input.iofAmountBrl);
  const feeCents = moneyToCents(input.feeAmountBrl);
  return {
    principalAmountBrl: centsToMoney(principalCents),
    totalWithoutEmbeddedCharges: centsToMoney(principalCents + iofCents + feeCents),
  };
}
