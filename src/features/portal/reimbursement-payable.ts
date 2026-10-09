import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { withTenantDb } from "@/lib/db";
import { auditLogs, costCenters, employees, financialCategories, financialExpenses, reimbursementRequests } from "@/lib/db/schema";
import { createAuditLogValues } from "@/lib/audit";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCan } from "@/lib/rbac";
import { isoDateSchema, isoMonthSchema } from "@/lib/validation";

export class ReimbursementPayableError extends Error {}
export const reimbursementPayableSchema = z.strictObject({
  reimbursementId: z.string().uuid(), dueDate: isoDateSchema, competence: isoMonthSchema,
  categoryId: z.string().uuid(), costCenterId: z.string().uuid().nullable(),
});

export async function createReimbursementPayable(context: AccessContext, raw: unknown) {
  assertCan("finance.write", context);
  assertCan("reimbursements.approve_finance", context);
  if (!context.organizationId) throw new AccessDeniedError();
  const input = reimbursementPayableSchema.parse(raw), org = context.organizationId;
  return withTenantDb(context, async tx => {
    const [before] = await tx.select().from(reimbursementRequests).where(and(eq(reimbursementRequests.id, input.reimbursementId), eq(reimbursementRequests.organizationId, org))).for("update").limit(1);
    if (!before) throw new AccessDeniedError();
    if (before.includedInvoiceRequestId) throw new ReimbursementPayableError("Reembolso incluído em NF não pode gerar pagamento avulso.");
    if (before.financialExpenseId) return { expenseId: before.financialExpenseId };
    if (before.status !== "finance_approved") throw new ReimbursementPayableError("Somente reembolso aprovado pelo Financeiro pode gerar conta a pagar. Pagamentos históricos exigem revisão.");
    const [employee] = await tx.select({ name: employees.fullName }).from(employees).where(and(eq(employees.id, before.employeeId), eq(employees.organizationId, org), isNull(employees.deletedAt))).limit(1);
    const [category] = await tx.select().from(financialCategories).where(and(eq(financialCategories.id, input.categoryId), eq(financialCategories.organizationId, org), eq(financialCategories.isActive, true))).limit(1);
    const [center] = input.costCenterId ? await tx.select().from(costCenters).where(and(eq(costCenters.id, input.costCenterId), eq(costCenters.organizationId, org), eq(costCenters.isActive, true))).limit(1) : [null];
    if (!employee || !category || category.nature === "income" || (input.costCenterId && !center)) throw new AccessDeniedError();
    const [expense] = await tx.insert(financialExpenses).values({ organizationId: org,
      supplier: employee.name, category: category.name, categoryId: category.id,
      costCenter: center?.name ?? null, costCenterId: center?.id ?? null,
      description: `Reembolso avulso - ${before.title}`.slice(0, 180), amount: before.amount,
      competence: input.competence, dueDate: input.dueDate, responsibleUserId: context.userId,
    }).returning();
    const [after] = await tx.update(reimbursementRequests).set({ financialExpenseId: expense.id, updatedAt: new Date() }).where(and(eq(reimbursementRequests.id, before.id), eq(reimbursementRequests.organizationId, org))).returning();
    await tx.insert(auditLogs).values(createAuditLogValues(context, { action: "create", entityType: "financial_expense", entityId: expense.id, after: expense, metadata: { reimbursementId: before.id } }));
    await tx.insert(auditLogs).values(createAuditLogValues(context, { action: "update", entityType: "reimbursement_request", entityId: before.id, before, after, metadata: { reason: "direct_payable", expenseId: expense.id } }));
    return { expenseId: expense.id };
  });
}
