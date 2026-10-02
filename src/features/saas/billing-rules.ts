import { z } from "zod";
import { centsToMoney, moneyToCents } from "@/features/finance/rules";
import { isoDateSchema } from "@/lib/validation";

const amount = z.string().trim().transform(v => v.replace(",", "."))
  .refine(v => !v || /^\d{1,10}(\.\d{1,2})?$/.test(v), "Informe um valor positivo com até duas casas decimais.")
  .refine(v => !v || moneyToCents(v) > 0, "O valor deve ser positivo.")
  .transform(v => v ? centsToMoney(moneyToCents(v)) : null);
export const saasBillingSchema = z.object({
  billingCurrency: z.enum(["BRL", "USD", "EUR"]).default("BRL"),
  billingCycle: z.enum(["monthly", "annual"]).default("monthly"),
  cycleAmount: amount.nullish().transform(v => v ?? null),
  estimatedExchangeRate: z.string().trim().nullish().transform(v => v?.replace(",", ".") || null)
    .refine(v => v === null || (/^\d{1,6}(\.\d{1,6})?$/.test(v) && Number(v) > 0), "Informe uma cotação positiva com até seis casas decimais."),
  exchangeRateDate: z.union([isoDateSchema, z.literal("")]).nullish().transform(v => v || null),
  exchangeRateSource: z.string().trim().max(160).nullish().transform(v => v || null),
}).superRefine((v, ctx) => {
  if (v.billingCurrency !== "BRL" && v.estimatedExchangeRate && (!v.exchangeRateDate || !v.exchangeRateSource))
    ctx.addIssue({ code: "custom", path: ["exchangeRateSource"], message: "Informe data e fonte da cotação estimada." });
});
export type SaasBilling = z.output<typeof saasBillingSchema>;

export function estimateSaasBilling(input: SaasBilling & { monthlyCost?: string | null }) {
  const original = input.cycleAmount ?? (input.billingCurrency === "BRL" && input.billingCycle === "monthly" ? input.monthlyCost ?? null : null);
  if (!original || (input.billingCurrency !== "BRL" && !input.estimatedExchangeRate))
    return { cycleEstimate: null, monthly: null, annualized: null };
  const [units, fraction = ""] = (input.billingCurrency === "BRL" ? "1" : input.estimatedExchangeRate!).split(".");
  const rate = BigInt(units) * BigInt(1000000) + BigInt(fraction.padEnd(6, "0"));
  const cycleCents = (BigInt(moneyToCents(original)) * rate + BigInt(500000)) / BigInt(1000000);
  const annualCents = input.billingCycle === "annual" ? cycleCents : cycleCents * BigInt(12);
  if (annualCents > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Estimativa excede o limite suportado.");
  return {
    cycleEstimate: centsToMoney(Number(cycleCents)),
    monthly: centsToMoney(Number(input.billingCycle === "annual" ? (cycleCents + BigInt(6)) / BigInt(12) : cycleCents)),
    annualized: centsToMoney(Number(annualCents)),
  };
}
