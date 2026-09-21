import { z } from "zod";
import { centsToMoney, moneyToCents, normalizeMoneyInput } from "@/features/finance/rules";
import { isoDateSchema, isoMonthSchema } from "@/lib/validation";

export const graphicSaleMoney = z.string().trim().transform((value, ctx) => {
  try {
    const clean = /^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(value) ? value.replaceAll(".", "") : value;
    const amount = normalizeMoneyInput(clean);
    const cents = moneyToCents(amount);
    if (!Number.isSafeInteger(cents) || cents <= 0 || cents >= 1e12) throw new Error();
    return centsToMoney(cents);
  } catch { ctx.addIssue({ code: "custom", message: "Informe um valor positivo válido." }); return z.NEVER; }
});
export const graphicSaleSchema = z.strictObject({
  jobId: z.string().uuid(), osVersionId: z.string().uuid(), amount: graphicSaleMoney, competence: isoMonthSchema,
  notes: z.string().trim().max(1000).default(""), confirmed: z.literal("on"),
  installments: z.array(z.strictObject({ amount: graphicSaleMoney, dueDate: isoDateSchema, label: z.string().trim().min(1).max(80) })).min(1).max(60),
}).refine(input => input.installments.reduce((sum, item) => sum + moneyToCents(item.amount), 0) === moneyToCents(input.amount), { path: ["installments"], message: "A soma das parcelas deve ser igual ao valor contratado." });
