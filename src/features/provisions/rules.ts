import { z } from "zod";
import { isoDateSchema, isoMonthSchema } from "@/lib/validation";

export class ProvisionCycleError extends Error {}

export const cycleMoneySchema = z.string().trim().regex(/^\d{1,10}(?:[.,]\d{1,2})?$/, "Informe um valor positivo com até duas casas decimais.")
  .transform(value => value.replace(",", "."))
  .refine(value => Number(value) > 0, "O valor deve ser positivo.");
export const planCycleSchema = z.strictObject({
  provisionId: z.string().uuid(), competence: isoMonthSchema,
  estimatedAmount: cycleMoneySchema, dueDate: isoDateSchema,
});
export const realizeCycleSchema = z.strictObject({
  id: z.string().uuid(), supplierId: z.string().uuid(), amount: cycleMoneySchema,
  dueDate: isoDateSchema,
});
export const cancelCycleSchema = z.strictObject({
  id: z.string().uuid(), reason: z.string().trim().min(5).max(500),
});
