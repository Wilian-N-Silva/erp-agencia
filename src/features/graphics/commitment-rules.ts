import { z } from "zod";
import { isoDateSchema, isoMonthSchema } from "@/lib/validation";

export const graphicCommitmentSchema = z.strictObject({
  jobId: z.string().uuid(), quoteId: z.string().uuid(),
  contractedAt: isoDateSchema, dueDate: isoDateSchema, competence: isoMonthSchema,
  categoryId: z.string().uuid(), costCenterId: z.union([z.string().uuid(), z.literal("")]).default(""),
  notes: z.string().trim().max(1000).default(""),
  confirmed: z.literal("on", { error: "Confirme a contratação do fornecedor." }),
});
