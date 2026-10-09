import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { writeAuditLog } from "@/lib/audit";
import { withTenantDb } from "@/lib/db";
import { financialExpenses, saasSubscriptionCharges, saasSubscriptions } from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCan } from "@/lib/rbac";
import { centsToMoney, deriveFinancialObligation, type FinancialObligationStatus } from "@/features/finance/rules";
import { activeTitleAllocations, titleLegacyReserved, titleSettledAmount } from "@/features/finance/ledger";
import { saasChargeRevision } from "./charge-correction";

import { calculatePrincipalAmount, recordSaasChargeSchema, type RecordSaasChargeInput } from "./charge-rules";

export type SaasChargeRecord = {
  id: string;
  subscriptionId: string;
  competence: string;
  chargedAt: string;
  dueDate: string;
  originalCurrency: string;
  originalAmount: string;
  effectiveExchangeRate: string;
  principalAmountBrl: string;
  iofAmountBrl: string;
  feeAmountBrl: string;
  totalAmountBrl: string;
  chargesIncludedInTotal: boolean;
  financialExpenseId: string | null;
  financialExpenseStatus: FinancialObligationStatus | null;
  settledAmount: string;
  confirmedAmount: string;
  reservedAmount: string;
  revision: string;
  corrections: Array<{ id: string; occurredAt: string; amountBefore: string; amountAfter: string; rateBefore: string; rateAfter: string; actorName: string | null; reason: string | null }>;
  notes: string | null;
  createdAt: Date;
};

function authorize(context: AccessContext, permission: "finance.read" | "finance.write") {
  assertCan(permission, context);
  if (!context.organizationId) throw new AccessDeniedError();
  return context.organizationId;
}

export async function listSaasCharges(context: AccessContext, subscriptionId: string) {
  const organizationId = authorize(context, "finance.read");
  return withTenantDb(context, async tx => {
    const rows = await tx
      .select({
        id: saasSubscriptionCharges.id,
        subscriptionId: saasSubscriptionCharges.subscriptionId,
        competence: saasSubscriptionCharges.competence,
        chargedAt: saasSubscriptionCharges.chargedAt,
        dueDate: saasSubscriptionCharges.dueDate,
        originalCurrency: saasSubscriptionCharges.originalCurrency,
        originalAmount: saasSubscriptionCharges.originalAmount,
        effectiveExchangeRate: saasSubscriptionCharges.effectiveExchangeRate,
        principalAmountBrl: saasSubscriptionCharges.principalAmountBrl,
        iofAmountBrl: saasSubscriptionCharges.iofAmountBrl,
        feeAmountBrl: saasSubscriptionCharges.feeAmountBrl,
        totalAmountBrl: saasSubscriptionCharges.totalAmountBrl,
        chargesIncludedInTotal: saasSubscriptionCharges.chargesIncludedInTotal,
        financialExpenseId: saasSubscriptionCharges.financialExpenseId,
        financialExpenseStatus: financialExpenses.status,
        payableAmount: financialExpenses.amount,
        payableDueDate: financialExpenses.dueDate,
        settledAmount: titleSettledAmount("payable"),
        confirmedAmount: activeTitleAllocations("payable"),
        reservedAmount: titleLegacyReserved("payable"),
        notes: saasSubscriptionCharges.notes,
        createdAt: saasSubscriptionCharges.createdAt,
        corrections: sql<SaasChargeRecord["corrections"]>`coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'occurredAt',h.created_at,'amountBefore',h.before->>'totalAmountBrl','amountAfter',h.after->>'totalAmountBrl','rateBefore',h.before->>'effectiveExchangeRate','rateAfter',h.after->>'effectiveExchangeRate','actorName',h.actor_name,'reason',h.metadata->>'reason') order by h.created_at desc,h.id desc)
          from (select id,created_at,before,after,metadata,(select name from "user" u where u.id=audit_logs.actor_user_id and u.organization_id=audit_logs.organization_id) as actor_name from audit_logs where organization_id=${organizationId} and entity_type='saas_subscription_charge' and entity_id=saas_subscription_charges.id::text and action='update' and before->>'totalAmountBrl' is not null) h),'[]'::jsonb)`,
      })
      .from(saasSubscriptionCharges)
      .leftJoin(financialExpenses, and(eq(financialExpenses.id, saasSubscriptionCharges.financialExpenseId), eq(financialExpenses.organizationId, organizationId), isNull(financialExpenses.deletedAt)))
      .where(and(eq(saasSubscriptionCharges.organizationId, organizationId), eq(saasSubscriptionCharges.subscriptionId, subscriptionId)))
      .orderBy(asc(saasSubscriptionCharges.competence));
    return rows.map(({ payableAmount, payableDueDate, financialExpenseStatus, ...row }) => ({ ...row,
      financialExpenseStatus: payableAmount && payableDueDate ? deriveFinancialObligation({ amount: payableAmount, settledAmount: row.settledAmount, dueDate: payableDueDate, cancelled: financialExpenseStatus === "cancelled" }).status : null,
      revision: saasChargeRevision(row),
    })) satisfies SaasChargeRecord[];
  });
}

export async function recordSaasCharge(context: AccessContext, raw: unknown) {
  const organizationId = authorize(context, "finance.write");
  const input: RecordSaasChargeInput = recordSaasChargeSchema.parse(raw);
  return withTenantDb(context, async tx => {
    const [subscription] = await tx
      .select()
      .from(saasSubscriptions)
      .where(and(eq(saasSubscriptions.id, input.subscriptionId), eq(saasSubscriptions.organizationId, organizationId), isNull(saasSubscriptions.deletedAt)))
      .for("update")
      .limit(1);
    if (!subscription) throw new AccessDeniedError();
    if (subscription.status === "cancelled") throw new Error("Não é possível registrar cobrança de uma assinatura cancelada.");

    const [existing] = await tx
      .select()
      .from(saasSubscriptionCharges)
      .where(and(eq(saasSubscriptionCharges.organizationId, organizationId), eq(saasSubscriptionCharges.subscriptionId, input.subscriptionId), eq(saasSubscriptionCharges.competence, input.competence)))
      .limit(1);
    if (existing) return existing;

    const principalAmountBrl = calculatePrincipalAmount(input.originalAmount, input.effectiveExchangeRate);
    const [expense] = await tx.insert(financialExpenses).values({
      organizationId,
      supplier: subscription.provider ?? subscription.name,
      category: "SaaS",
      description: `Cobrança ${input.competence} · ${subscription.name}`,
      amount: input.totalAmountBrl,
      dueDate: input.dueDate,
      competence: input.competence,
      status: "planned",
      recurring: false,
      notes: input.notes,
      responsibleUserId: context.userId,
    }).returning();

    const [charge] = await tx.insert(saasSubscriptionCharges).values({
      organizationId,
      subscriptionId: input.subscriptionId,
      competence: input.competence,
      chargedAt: input.chargedAt,
      dueDate: input.dueDate,
      originalCurrency: input.originalCurrency,
      originalAmount: input.originalAmount,
      effectiveExchangeRate: input.effectiveExchangeRate,
      principalAmountBrl: centsToMoney(principalAmountBrl),
      iofAmountBrl: input.iofAmountBrl,
      feeAmountBrl: input.feeAmountBrl,
      totalAmountBrl: input.totalAmountBrl,
      chargesIncludedInTotal: input.chargesIncludedInTotal,
      financialExpenseId: expense.id,
      notes: input.notes,
      createdByUserId: context.userId,
    }).returning();

    await writeAuditLog(context, { action: "create", entityType: "saas_subscription_charge", entityId: charge.id, after: charge, metadata: { financialExpenseId: expense.id } });
    await writeAuditLog(context, { action: "create", entityType: "financial_expense", entityId: expense.id, after: expense, metadata: { saasSubscriptionChargeId: charge.id } });
    return charge;
  });
}
