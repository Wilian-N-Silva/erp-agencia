import { describe, expect, it } from "vitest";

import {
  financialTransactionDirectionLabels,
  financialTransactionInputSchema,
  financialTransactionStatusLabels,
} from "@/features/finance-transactions/rules";

const id = (suffix: number) =>
  `73000000-0000-4000-8000-${suffix.toString().padStart(12, "0")}`;

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    accountId: id(1),
    amount: "1234,56",
    clientId: "",
    counterpartyName: "Cliente sem cadastro",
    direction: "in",
    method: "PIX",
    occurredAt: "2026-09-03",
    reference: "E2E-123",
    supplierId: "",
    ...overrides,
  };
}

describe("FIN-003 financial transaction rules", () => {
  it("normalizes a positive amount and the occurrence date", () => {
    const input = financialTransactionInputSchema.parse(validInput());

    expect(input.amount).toBe("1234.56");
    expect(input.occurredAt.toISOString()).toBe("2026-09-03T12:00:00.000Z");
    expect(input.clientId).toBeNull();
    expect(input.supplierId).toBeNull();
  });

  it.each(["0", "-1", "1.001", "not-money"])(
    "rejects invalid or non-positive amount %s",
    (amount) => {
      expect(() =>
        financialTransactionInputSchema.parse(validInput({ amount })),
      ).toThrow();
    },
  );

  it("rejects impossible dates and arbitrary direction values", () => {
    expect(() =>
      financialTransactionInputSchema.parse(
        validInput({ occurredAt: "2026-02-30" }),
      ),
    ).toThrow();
    expect(() =>
      financialTransactionInputSchema.parse(validInput({ direction: "credit" })),
    ).toThrow();
  });

  it("enforces direction-compatible canonical counterparties", () => {
    expect(() =>
      financialTransactionInputSchema.parse(
        validInput({ direction: "in", supplierId: id(2) }),
      ),
    ).toThrow();
    expect(() =>
      financialTransactionInputSchema.parse(
        validInput({ clientId: id(3), direction: "out" }),
      ),
    ).toThrow();
    expect(() =>
      financialTransactionInputSchema.parse(
        validInput({ clientId: id(3), supplierId: id(2) }),
      ),
    ).toThrow();
  });

  it("rejects server-owned and unknown fields to prevent mass assignment", () => {
    for (const injected of [
      { organizationId: id(9) },
      { status: "reconciled" },
      { origin: "import" },
      { createdByUserId: "attacker" },
      { importMetadata: { source: "client" } },
    ]) {
      expect(() =>
        financialTransactionInputSchema.parse(validInput(injected)),
      ).toThrow();
    }
  });

  it("exposes the official direction and reconciliation status vocabulary", () => {
    expect(financialTransactionDirectionLabels).toEqual({
      in: "Entrada",
      out: "Saída",
    });
    expect(financialTransactionStatusLabels.pending_reconciliation).toBe(
      "Pendente de conciliação",
    );
  });
});
