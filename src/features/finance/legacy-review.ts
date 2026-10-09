import { and, desc, eq, getTableColumns, isNull } from "drizzle-orm";
import { z } from "zod";
import { createAuditLogValues } from "@/lib/audit";
import { withTenantDb } from "@/lib/db";
import { auditLogs, financialEntries, financialExpenses, financialLegacyReleases } from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCan, assertCanAny } from "@/lib/rbac";
import { activeTitleAllocations, titleLastAllocationDate, titleLegacyReserved } from "./ledger";
import { centsToMoney, moneyToCents } from "./rules";

export const legacyReviewOwnerSchema = z.strictObject({ type: z.enum(["receivable", "payable"]), id: z.string().uuid() });
export const legacyReleaseSchema = legacyReviewOwnerSchema.extend({
  requestId: z.string().uuid(),
  amount: z.string().trim().regex(/^\d{1,10}(?:[.,]\d{1,2})?$/).transform(value => centsToMoney(moneyToCents(value.replace(",", ".")))).refine(value => moneyToCents(value) > 0),
  reason: z.string().trim().min(10).max(2000),
  evidence: z.string().trim().min(10).max(2000),
  confirmed: z.literal("yes"),
});
export class FinancialLegacyReviewError extends Error {}

export async function getFinancialLegacyReview(context: AccessContext, raw: unknown) {
  assertCanAny(["finance.read", "finance.write", "finance.settle", "finance.reverse"], context);
  if (!context.organizationId) throw new AccessDeniedError();
  const owner = legacyReviewOwnerSchema.parse(raw);
  return withTenantDb(context, async tx => {
    const table = owner.type === "receivable" ? financialEntries : financialExpenses;
    const [title] = await tx.select({ id: table.id, description: table.description, amount: table.amount,
      originalReserve: table.legacySettledAmount, reserved: titleLegacyReserved(owner.type), confirmedAmount: activeTitleAllocations(owner.type) })
      .from(table).where(and(eq(table.organizationId, context.organizationId!), eq(table.id, owner.id), isNull(table.deletedAt))).limit(1);
    if (!title) throw new AccessDeniedError();
    const history = await tx.select().from(financialLegacyReleases).where(and(eq(financialLegacyReleases.organizationId, context.organizationId!),
      owner.type === "receivable" ? eq(financialLegacyReleases.financialEntryId, owner.id) : eq(financialLegacyReleases.financialExpenseId, owner.id))).orderBy(desc(financialLegacyReleases.createdAt));
    return { title, history };
  });
}

/** Release a reviewed historical reservation, without fabricating a cash event. */
export async function releaseFinancialLegacyReserve(context: AccessContext, raw: unknown) {
  assertCan("finance.reverse", context);
  if (!context.organizationId) throw new AccessDeniedError();
  const input = legacyReleaseSchema.parse(raw);
  const org = context.organizationId;
  return withTenantDb(context, async tx => {
    const table = input.type === "receivable" ? financialEntries : financialExpenses;
    const [before] = await tx.select({ ...getTableColumns(table), reserved: titleLegacyReserved(input.type),
      confirmedAmount: activeTitleAllocations(input.type), allocationDate: titleLastAllocationDate(input.type) })
      .from(table).where(and(eq(table.id, input.id), eq(table.organizationId, org), isNull(table.deletedAt))).for("update").limit(1);
    if (!before) throw new AccessDeniedError();
    const [previous] = await tx.select().from(financialLegacyReleases).where(and(eq(financialLegacyReleases.organizationId, org), eq(financialLegacyReleases.requestId, input.requestId))).limit(1);
    if (previous) {
      if ((input.type === "receivable" ? previous.financialEntryId : previous.financialExpenseId) !== input.id || previous.amount !== input.amount || previous.reason !== input.reason || previous.evidence !== input.evidence) {
        throw new FinancialLegacyReviewError("Esta solicitação já foi utilizada com outros dados. Atualize a página.");
      }
      return previous;
    }
    if (before.status === "cancelled" || moneyToCents(input.amount) > moneyToCents(before.reserved)) {
      throw new FinancialLegacyReviewError("O valor excede a reserva disponível ou o título está cancelado. Atualize e confira o histórico.");
    }
    const settled = moneyToCents(before.reserved) - moneyToCents(input.amount) + moneyToCents(before.confirmedAmount);
    if (settled < 0 || settled > moneyToCents(before.amount)) throw new FinancialLegacyReviewError("Saldo inconsistente. Confira a origem antes de revisar.");
    const [release] = await tx.insert(financialLegacyReleases).values({ organizationId: org, requestId: input.requestId,
      financialEntryId: input.type === "receivable" ? input.id : null, financialExpenseId: input.type === "payable" ? input.id : null,
      amount: input.amount, reason: input.reason, evidence: input.evidence, createdByUserId: context.userId }).returning();
    const complete = settled === moneyToCents(before.amount);
    const [after] = input.type === "receivable"
      ? await tx.update(financialEntries).set({ receivedAmount: centsToMoney(settled), status: complete ? "received" : "planned", receivedDate: complete ? before.allocationDate : null, updatedAt: new Date() }).where(and(eq(financialEntries.id, input.id), eq(financialEntries.organizationId, org))).returning()
      : await tx.update(financialExpenses).set({ paidAmount: centsToMoney(settled), status: complete ? "paid" : "planned", paidDate: complete ? before.allocationDate : null, updatedAt: new Date() }).where(and(eq(financialExpenses.id, input.id), eq(financialExpenses.organizationId, org))).returning();
    await tx.insert(auditLogs).values(createAuditLogValues(context, { action: "create", entityType: "financial_legacy_release", entityId: release.id, after: release }));
    await tx.insert(auditLogs).values(createAuditLogValues(context, { action: "update", entityType: input.type === "receivable" ? "financial_entry" : "financial_expense", entityId: input.id, before, after, metadata: { legacyReleaseId: release.id } }));
    return release;
  });
}
