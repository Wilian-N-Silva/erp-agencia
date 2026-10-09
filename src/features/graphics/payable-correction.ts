import { createHash } from "node:crypto";
import { and, eq, getTableColumns, isNull } from "drizzle-orm";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";
import { withTenantDb } from "@/lib/db";
import { financialExpenses, graphicJobs, graphicSupplierCommitments } from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCan } from "@/lib/rbac";
import { isoDateSchema, isoMonthSchema } from "@/lib/validation";
import { titleSettledAmount } from "@/features/finance/ledger";
import { moneyToCents } from "@/features/finance/rules";
import { graphicSaleMoney } from "./sale-rules";

export function graphicPayableRevision(payable: { id: string; amount: string; dueDate: string; competence: string }) {
  return createHash("sha256").update(JSON.stringify([payable.id, payable.amount, payable.dueDate, payable.competence])).digest("hex");
}
export const correctGraphicPayableSchema = z.strictObject({
  jobId: z.string().uuid(), commitmentId: z.string().uuid(), revision: z.string().regex(/^[a-f0-9]{64}$/),
  amount: graphicSaleMoney, dueDate: isoDateSchema, competence: isoMonthSchema,
  reason: z.string().trim().min(5).max(1000),
});
export class GraphicPayableCorrectionError extends Error {}

export async function correctGraphicPayable(context: AccessContext, raw: unknown) {
  assertCan("finance.write", context); assertCan("finance.reverse", context);
  if (!context.organizationId) throw new AccessDeniedError();
  const input = correctGraphicPayableSchema.parse(raw), org = context.organizationId;
  return withTenantDb(context, async tx => {
    // Same order as contracting: parent job, origin, title. Never rewrite immutable origin facts.
    const [job] = await tx.select({ id: graphicJobs.id }).from(graphicJobs).where(and(eq(graphicJobs.id, input.jobId), eq(graphicJobs.organizationId, org), isNull(graphicJobs.deletedAt))).for("update").limit(1);
    if (!job) throw new AccessDeniedError();
    const [commitment] = await tx.select().from(graphicSupplierCommitments).where(and(eq(graphicSupplierCommitments.id, input.commitmentId), eq(graphicSupplierCommitments.jobId, job.id), eq(graphicSupplierCommitments.organizationId, org))).for("update").limit(1);
    if (!commitment) throw new AccessDeniedError();
    const [before] = await tx.select(getTableColumns(financialExpenses)).from(financialExpenses)
      .where(and(eq(financialExpenses.id, commitment.expenseId), eq(financialExpenses.organizationId, org), isNull(financialExpenses.deletedAt))).for("update").limit(1);
    if (!before) throw new AccessDeniedError();
    // A separate statement AFTER the lock sees allocations committed while we waited.
    const [settlement] = await tx.select({ amount: titleSettledAmount("payable") }).from(financialExpenses)
      .where(and(eq(financialExpenses.id, before.id), eq(financialExpenses.organizationId, org))).limit(1);
    if (before.status === "cancelled") throw new GraphicPayableCorrectionError("Esta conta a pagar está cancelada. Confira o histórico da contratação antes de continuar.");
    if (!settlement || moneyToCents(settlement.amount) > 0) throw new GraphicPayableCorrectionError("Estorne a liquidação ou revise a reserva histórica antes de corrigir esta conta a pagar.");
    if (input.amount === before.amount && input.dueDate === before.dueDate && input.competence === before.competence) return commitment;
    if (input.revision !== graphicPayableRevision(before)) throw new GraphicPayableCorrectionError("Esta conta foi alterada desde sua consulta. Atualize a página antes de corrigir.");
    const [after] = await tx.update(financialExpenses).set({ amount: input.amount, dueDate: input.dueDate, competence: input.competence, updatedAt: new Date() })
      .where(and(eq(financialExpenses.id, before.id), eq(financialExpenses.organizationId, org))).returning();
    const metadata = { origin: "graphic_commitment_correction", graphicJobId: job.id, commitmentId: commitment.id, financialExpenseId: before.id, reason: input.reason };
    await writeAuditLog(context, { action: "update", entityType: "financial_expense", entityId: before.id, before, after, metadata });
    await writeAuditLog(context, { action: "update", entityType: "graphic_supplier_commitment", entityId: commitment.id, before: commitment, after: commitment, metadata: { ...metadata, correctedFields: ["amount", "dueDate", "competence"] } });
    return commitment;
  });
}
