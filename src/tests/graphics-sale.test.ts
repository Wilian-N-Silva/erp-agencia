import { expect, it } from "vitest";
import { graphicSaleMoney, graphicSaleSchema } from "@/features/graphics/sale-rules";
const id = "10000000-0000-4000-8000-000000000001";
const input = { jobId: id, osVersionId: id, amount: "0,30", competence: "2026-09", confirmed: "on", installments: [{ label: "Sinal", amount: "0,10", dueDate: "2026-09-21" }, { label: "Saldo", amount: "0,20", dueDate: "2026-10-01" }] };
it("validates installments in integer cents, including decimal precision and grouped Brazilian money", () => {
  expect(graphicSaleSchema.parse(input).amount).toBe("0.30");
  expect(graphicSaleMoney.parse("1.500,25")).toBe("1500.25");
  expect(graphicSaleSchema.safeParse({ ...input, amount: "0.31" }).success).toBe(false);
  expect(graphicSaleMoney.safeParse("10000000000.00").success).toBe(false);
});
it("rejects missing confirmation, tampered settlement and invalid installment dates", () => {
  for (const extra of [{ confirmed: "" }, { receivedAmount: "0.30" }, { installments: [] }, { installments: [{ label: "Teste", amount: "0.30", dueDate: "2026-02-30" }] }]) expect(graphicSaleSchema.safeParse({ ...input, ...extra }).success).toBe(false);
});
