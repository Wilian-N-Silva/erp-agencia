import { createHash } from "node:crypto";
import { z } from "zod";
import { isoDateSchema, isoMonthSchema } from "@/lib/validation";
import { moneyToCents } from "@/features/finance/rules";
import { graphicSaleMoney } from "./sale-rules";

export function graphicSaleRevisionToken(input: {
  saleId: string;
  revisionId: string | null;
  amount: string;
  competence: string;
  installments: Array<{
    entryId: string;
    amount: string;
    dueDate: string;
    competence: string;
  }>;
}) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        ...input,
        installments: [...input.installments].sort((a, b) =>
          a.entryId.localeCompare(b.entryId),
        ),
      }),
    )
    .digest("hex");
}
export const correctGraphicSaleSchema = z
  .strictObject({
    jobId: z.string().uuid(),
    saleId: z.string().uuid(),
    revision: z.string().regex(/^[a-f0-9]{64}$/),
    amount: graphicSaleMoney,
    competence: isoMonthSchema,
    reason: z.string().trim().min(5).max(1000),
    installments: z
      .array(
        z.strictObject({
          entryId: z.string().uuid(),
          amount: graphicSaleMoney,
          dueDate: isoDateSchema,
        }),
      )
      .min(1)
      .max(60),
  })
  .refine(
    (input) =>
      new Set(input.installments.map((row) => row.entryId)).size ===
        input.installments.length &&
      input.installments.reduce(
        (sum, row) => sum + moneyToCents(row.amount),
        0,
      ) === moneyToCents(input.amount),
    {
      path: ["installments"],
      message: "Confira a soma e os vínculos das parcelas.",
    },
  );
export class GraphicSaleCorrectionError extends Error {}
