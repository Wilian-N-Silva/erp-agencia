import { expect, it } from "vitest";
import { graphicSuggestionSchema, graphicSuggestionReviewSchema } from "@/features/graphics/reconciliation-rules";
const id = "10000000-0000-4000-8000-000000000001";
it("validates suggested money and rejects injected status or missing justification", () => {
  const input = { jobId: id, transactionId: id, entryId: id, amount: "1.200,00", reason: "Comprovante recebido do cliente" };
  expect(graphicSuggestionSchema.parse(input).amount).toBe("1200.00");
  for (const change of [{ amount: "0" }, { reason: "" }, { status: "accepted" }, { organizationId: id }]) expect(graphicSuggestionSchema.safeParse({ ...input, ...change }).success).toBe(false);
});
it("requires explicit financial confirmation and justification for either review decision", () => {
  const input = { suggestionId: id, decision: "accepted", notes: "Conferido no extrato", confirmed: "on" };
  expect(graphicSuggestionReviewSchema.safeParse(input).success).toBe(true);
  expect(graphicSuggestionReviewSchema.safeParse({ ...input, decision: "rejected" }).success).toBe(true);
  for (const change of [{ confirmed: undefined }, { notes: "" }, { amount: "1" }, { reviewedByUserId: "someone" }]) expect(graphicSuggestionReviewSchema.safeParse({ ...input, ...change }).success).toBe(false);
});
