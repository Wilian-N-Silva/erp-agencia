import { z } from "zod";
import { graphicSaleMoney } from "./sale-rules";

export const graphicSuggestionSchema = z.strictObject({
  jobId: z.string().uuid(), transactionId: z.string().uuid(), entryId: z.string().uuid(),
  amount: graphicSaleMoney, reason: z.string().trim().min(3).max(1000),
});
export const graphicSuggestionReviewSchema = z.strictObject({
  suggestionId: z.string().uuid(), decision: z.enum(["accepted", "rejected"]),
  notes: z.string().trim().min(3).max(1000), confirmed: z.literal("on"),
});
