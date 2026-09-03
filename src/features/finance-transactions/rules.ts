import { z } from "zod";

import { centsToMoney, moneyToCents } from "@/features/finance/rules";
import { isIsoDate } from "@/lib/validation";

export const financialTransactionDirections = ["in", "out"] as const;
export type FinancialTransactionDirection =
  (typeof financialTransactionDirections)[number];

export const financialTransactionStatuses = [
  "pending_reconciliation",
  "partially_reconciled",
  "reconciled",
  "reversed",
] as const;
export type FinancialTransactionStatus =
  (typeof financialTransactionStatuses)[number];

export const financialTransactionDirectionLabels = {
  in: "Entrada",
  out: "Saída",
} satisfies Record<FinancialTransactionDirection, string>;

export const financialTransactionStatusLabels = {
  pending_reconciliation: "Pendente de conciliação",
  partially_reconciled: "Parcialmente conciliada",
  reconciled: "Conciliada",
  reversed: "Estornada",
} satisfies Record<FinancialTransactionStatus, string>;

const nullableText = (max: number) =>
  z.string().trim().max(max).transform((value) => value || null);

const nullableUuid = z
  .string()
  .trim()
  .transform((value) => value || null)
  .pipe(z.string().uuid().nullable());

const positiveAmount = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s/g, "").replace(",", "."))
  .refine((value) => /^\d+(?:\.\d{1,2})?$/.test(value), {
    message: "Valor inválido.",
  })
  .transform((value) => moneyToCents(value))
  .refine((value) => value > 0 && value <= 99_999_999_999_999, {
    message: "O valor deve ser positivo e respeitar o limite permitido.",
  })
  .transform(centsToMoney);

const occurredAt = z
  .string()
  .trim()
  .refine(isIsoDate, { message: "Data da movimentação inválida." })
  .transform((value) => new Date(`${value}T12:00:00.000Z`));

export const financialTransactionInputSchema = z
  .strictObject({
    accountId: z.string().uuid(),
    amount: positiveAmount,
    clientId: nullableUuid,
    counterpartyName: nullableText(160),
    direction: z.enum(financialTransactionDirections),
    method: nullableText(80),
    occurredAt,
    reference: nullableText(160),
    supplierId: nullableUuid,
  })
  .superRefine((input, context) => {
    if (input.clientId && input.supplierId) {
      context.addIssue({
        code: "custom",
        message: "Informe cliente ou fornecedor, não ambos.",
      });
    }
    if (input.direction === "in" && input.supplierId) {
      context.addIssue({
        code: "custom",
        path: ["supplierId"],
        message: "Uma entrada não pode apontar para fornecedor.",
      });
    }
    if (input.direction === "out" && input.clientId) {
      context.addIssue({
        code: "custom",
        path: ["clientId"],
        message: "Uma saída não pode apontar para cliente.",
      });
    }
  });

export type FinancialTransactionInput = z.infer<
  typeof financialTransactionInputSchema
>;
