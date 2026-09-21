import { expect, it } from "vitest";
import { graphicCommitmentSchema } from "@/features/graphics/commitment-rules";

it("requires explicit contracting and refuses caller-supplied price, supplier and settlement", () => {
  const id = "10000000-0000-4000-8000-000000000001";
  const input = { jobId: id, quoteId: id, categoryId: id, contractedAt: "2026-09-21", dueDate: "2026-10-01", competence: "2026-09", confirmed: "on" };
  expect(graphicCommitmentSchema.safeParse(input).success).toBe(true);
  for (const extra of [{ confirmed: "" }, { amount: "0.01" }, { supplierId: id }, { paidAmount: "100" }, { dueDate: "2026-02-30" }, { competence: "2026-13" }]) expect(graphicCommitmentSchema.safeParse({ ...input, ...extra }).success).toBe(false);
});
