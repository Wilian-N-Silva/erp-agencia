import { describe, expect, it } from "vitest";

import {
  calculateAllocationTotal,
  FinancialAllocationError,
  financialAllocationBatchInputSchema,
} from "@/features/finance-allocations/rules";

const transactionId = "84000400-0000-4000-8000-000000000001";
const targetId = "84000400-0000-4000-8000-000000000002";

describe("FIN-004 allocation validation", () => {
  it("normalizes money and rejects server-owned fields", () => {
    expect(
      financialAllocationBatchInputSchema.parse({
        allocations: [
          { amount: " 300,00 ", targetId, targetType: "receivable" },
        ],
        transactionId,
      }),
    ).toEqual({
      allocations: [
        { amount: "300.00", targetId, targetType: "receivable" },
      ],
      transactionId,
    });

    expect(() =>
      financialAllocationBatchInputSchema.parse({
        allocations: [
          {
            amount: "10.00",
            organizationId: "84000400-0000-4000-8000-000000000099",
            targetId,
            targetType: "receivable",
          },
        ],
        status: "reconciled",
        transactionId,
      }),
    ).toThrow();
  });

  it("rejects a duplicated target in one atomic batch", () => {
    expect(() =>
      financialAllocationBatchInputSchema.parse({
        allocations: [
          { amount: "10.00", targetId, targetType: "payable" },
          { amount: "20.00", targetId, targetType: "payable" },
        ],
        transactionId,
      }),
    ).toThrow("Um titulo nao pode aparecer duas vezes no mesmo lote.");
  });

  it("derives partial and settled totals while preserving a legacy baseline", () => {
    expect(
      calculateAllocationTotal({
        cachedSettled: "300.00",
        capacity: "1000.00",
        existingAllocated: "100.00",
        requested: "200.00",
        scope: "target",
      }),
    ).toEqual({
      baselineAmount: "200.00",
      settledAmount: "500.00",
      status: "partial",
    });
    expect(
      calculateAllocationTotal({
        capacity: "1000.00",
        existingAllocated: "300.00",
        requested: "700.00",
        scope: "transaction",
      }).status,
    ).toBe("settled");
  });

  it("rejects transaction and target over-allocation", () => {
    for (const input of [
      {
        capacity: "100.00",
        existingAllocated: "80.00",
        requested: "20.01",
        scope: "transaction" as const,
      },
      {
        cachedSettled: "90.00",
        capacity: "100.00",
        existingAllocated: "50.00",
        requested: "10.01",
        scope: "target" as const,
      },
    ]) {
      expect(() => calculateAllocationTotal(input)).toThrow(FinancialAllocationError);
    }
  });
});
