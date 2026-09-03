import { z } from "zod";

import { centsToMoney, moneyToCents } from "@/features/finance/rules";

export const financialAllocationTargetTypes = ["receivable", "payable"] as const;
export type FinancialAllocationTargetType =
  (typeof financialAllocationTargetTypes)[number];

const allocationAmountSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s/g, "").replace(",", "."))
  .refine((value) => /^\d+(?:\.\d{1,2})?$/.test(value), {
    message: "Valor de alocacao invalido.",
  })
  .transform(moneyToCents)
  .refine((value) => value > 0 && value <= 99_999_999_999_999, {
    message: "O valor da alocacao deve ser positivo e respeitar o limite permitido.",
  })
  .transform(centsToMoney);

const allocationItemSchema = z.strictObject({
  amount: allocationAmountSchema,
  targetId: z.string().uuid(),
  targetType: z.enum(financialAllocationTargetTypes),
});

export const financialAllocationBatchInputSchema = z
  .strictObject({
    allocations: z.array(allocationItemSchema).min(1).max(100),
    transactionId: z.string().uuid(),
  })
  .superRefine((input, context) => {
    const targets = new Set<string>();

    input.allocations.forEach((allocation, index) => {
      const key = `${allocation.targetType}:${allocation.targetId}`;
      if (targets.has(key)) {
        context.addIssue({
          code: "custom",
          message: "Um titulo nao pode aparecer duas vezes no mesmo lote.",
          path: ["allocations", index, "targetId"],
        });
      }
      targets.add(key);
    });
  });

export type FinancialAllocationBatchInput = z.infer<
  typeof financialAllocationBatchInputSchema
>;

export type FinancialAllocationErrorCode =
  | "cancelled_target"
  | "direction_mismatch"
  | "inconsistent_balance"
  | "target_overallocated"
  | "transaction_overallocated"
  | "transaction_reversed";

export class FinancialAllocationError extends Error {
  constructor(
    readonly code: FinancialAllocationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "FinancialAllocationError";
  }
}

export function calculateAllocationTotal(input: {
  capacity: string;
  cachedSettled?: string | null;
  existingAllocated: string;
  requested: string;
  scope: "target" | "transaction";
}) {
  const capacity = moneyToCents(input.capacity);
  const existing = moneyToCents(input.existingAllocated);
  const requested = moneyToCents(input.requested);
  const cached = moneyToCents(input.cachedSettled);
  const baseline = input.scope === "target" ? cached - existing : 0;

  if (baseline < 0) {
    throw new FinancialAllocationError(
      "inconsistent_balance",
      "O saldo liquidado do titulo esta inconsistente com suas alocacoes.",
    );
  }

  const total = baseline + existing + requested;
  if (total > capacity) {
    throw new FinancialAllocationError(
      input.scope === "transaction"
        ? "transaction_overallocated"
        : "target_overallocated",
      input.scope === "transaction"
        ? "A soma das alocacoes excede o valor da movimentacao."
        : "A alocacao excede o saldo aberto do titulo.",
    );
  }

  return {
    baselineAmount: centsToMoney(baseline),
    settledAmount: centsToMoney(total),
    status: total === capacity ? "settled" : total > 0 ? "partial" : "open",
  } as const;
}
