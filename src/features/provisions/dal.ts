import { and, asc, eq, isNull, getTableColumns } from "drizzle-orm";
import { writeAuditLog } from "@/lib/audit";
import { withTenantDb } from "@/lib/db";
import { financialExpenses, provisionCycles, provisions, suppliers } from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCan } from "@/lib/rbac";
import { cancelCycleSchema, correctRealizedCycleSchema, planCycleSchema, ProvisionCycleError, realizeCycleSchema } from "./rules";
import { titleSettledAmount } from "@/features/finance/ledger";
import { centsToMoney, moneyToCents } from "@/features/finance/rules";

function authorize(context: AccessContext, permission: "finance.write" | "finance.read") {
  assertCan(permission, context);
  if (!context.organizationId) throw new AccessDeniedError();
  return context.organizationId;
}

export async function planProvisionCycle(context: AccessContext, raw: unknown) {
  const org = authorize(context, "finance.write");
  const input = planCycleSchema.parse(raw);
  return withTenantDb(context, async tx => {
    // Serialize occurrence creation, including non-recurring provisions.
    const [provision] = await tx.select().from(provisions).where(and(eq(provisions.id, input.provisionId), eq(provisions.organizationId, org), isNull(provisions.deletedAt))).for("update").limit(1);
    if (!provision) throw new AccessDeniedError();
    const cycles = await tx.select().from(provisionCycles).where(and(eq(provisionCycles.provisionId, provision.id), eq(provisionCycles.organizationId, org)));
    const existing = cycles.find(cycle => cycle.competence === input.competence);
    if (existing) return existing; // Retrying cannot reset a realized/cancelled occurrence.
    if (provision.status !== "active") throw new ProvisionCycleError("Provisão inativa: não é possível planejar uma nova ocorrência.");
    if (!provision.recurring && cycles.length) throw new ProvisionCycleError("Esta provisão não recorrente já possui uma ocorrência.");
    const [after] = await tx.insert(provisionCycles).values({ ...input, organizationId: org, createdByUserId: context.userId }).returning();
    await writeAuditLog(context, { action: "create", entityType: "provision_cycle", entityId: after.id, after });
    return after;
  });
}

export async function realizeProvisionCycle(context: AccessContext, raw: unknown) {
  const org = authorize(context, "finance.write");
  const input = realizeCycleSchema.parse(raw);
  return withTenantDb(context, async tx => {
    const [before] = await tx.select().from(provisionCycles).where(and(eq(provisionCycles.id, input.id), eq(provisionCycles.organizationId, org))).for("update").limit(1);
    if (!before) throw new AccessDeniedError();
    if (before.status === "realized") return before;
    if (before.status !== "planned") throw new ProvisionCycleError("Ocorrência cancelada não pode gerar conta a pagar.");
    const [provision] = await tx.select().from(provisions).where(and(eq(provisions.id, before.provisionId), eq(provisions.organizationId, org), isNull(provisions.deletedAt))).limit(1);
    const [supplier] = await tx.select().from(suppliers).where(and(eq(suppliers.id, input.supplierId), eq(suppliers.organizationId, org))).for("share").limit(1);
    if (!provision || !supplier) throw new AccessDeniedError();
    if (!supplier.isActive) throw new ProvisionCycleError("Selecione um fornecedor ativo.");
    const [payable] = await tx.insert(financialExpenses).values({
      organizationId: org, supplierId: supplier.id, supplier: supplier.name,
      category: provision.category, description: `Provisão ${before.competence} · ${provision.name}`,
      amount: input.amount, dueDate: input.dueDate, competence: before.competence,
      status: "planned", responsibleUserId: context.userId,
    }).returning();
    const [after] = await tx.update(provisionCycles).set({ status: "realized", financialExpenseId: payable.id, updatedAt: new Date() }).where(and(eq(provisionCycles.id, before.id), eq(provisionCycles.organizationId, org))).returning();
    await writeAuditLog(context, { action: "create", entityType: "financial_expense", entityId: payable.id, after: payable, metadata: { provisionCycleId: before.id } });
    await writeAuditLog(context, { action: "status_change", entityType: "provision_cycle", entityId: before.id, before, after });
    return after;
  });
}

export async function cancelProvisionCycle(context: AccessContext, raw: unknown) {
  const org = authorize(context, "finance.write");
  const input = cancelCycleSchema.parse(raw);
  return withTenantDb(context, async tx => {
    const [before] = await tx.select().from(provisionCycles).where(and(eq(provisionCycles.id, input.id), eq(provisionCycles.organizationId, org))).for("update").limit(1);
    if (!before) throw new AccessDeniedError();
    if (before.status === "cancelled") return before;
    if (before.status === "realized") {
      assertCan("finance.reverse", context);
      if (!before.financialExpenseId) throw new ProvisionCycleError("Ocorrência sem vínculo financeiro confiável. Confira o histórico.");
      const [payable] = await tx.select({ ...getTableColumns(financialExpenses), ledgerSettled: titleSettledAmount("payable") }).from(financialExpenses)
        .where(and(eq(financialExpenses.id, before.financialExpenseId), eq(financialExpenses.organizationId, org), isNull(financialExpenses.deletedAt))).for("update").limit(1);
      if (!payable) throw new AccessDeniedError();
      if (moneyToCents(payable.ledgerSettled) > 0) throw new ProvisionCycleError("Estorne as movimentações conciliadas ou revise a reserva histórica antes de cancelar esta cobrança.");
      const [afterPayable] = await tx.update(financialExpenses).set({ status: "cancelled", paidAmount: "0.00", paidDate: null, updatedAt: new Date() })
        .where(and(eq(financialExpenses.id, payable.id), eq(financialExpenses.organizationId, org))).returning();
      await writeAuditLog(context, { action: "status_change", entityType: "financial_expense", entityId: payable.id, before: payable, after: afterPayable, metadata: { provisionCycleId: before.id, reason: input.reason } });
    } else if (before.status !== "planned") throw new ProvisionCycleError("Estado da ocorrência indisponível para cancelamento.");
    const [after] = await tx.update(provisionCycles).set({ status: "cancelled", cancellationReason: input.reason, updatedAt: new Date() }).where(and(eq(provisionCycles.id, before.id), eq(provisionCycles.organizationId, org))).returning();
    await writeAuditLog(context, { action: "status_change", entityType: "provision_cycle", entityId: before.id, before, after });
    return after;
  });
}

export async function listProvisionCycles(context: AccessContext) {
  const org = authorize(context, "finance.read");
  return withTenantDb(context, tx => tx.select({ ...getTableColumns(provisionCycles), actualAmount: financialExpenses.amount, actualDueDate: financialExpenses.dueDate })
    .from(provisionCycles).leftJoin(financialExpenses, and(eq(financialExpenses.id, provisionCycles.financialExpenseId), eq(financialExpenses.organizationId, org), isNull(financialExpenses.deletedAt)))
    .where(eq(provisionCycles.organizationId, org)).orderBy(asc(provisionCycles.competence), asc(provisionCycles.id)));
}

export async function correctRealizedProvisionCycle(context: AccessContext, raw: unknown) {
  const org = authorize(context, "finance.write");
  assertCan("finance.reverse", context);
  const input = correctRealizedCycleSchema.parse(raw);
  return withTenantDb(context, async tx => {
    const [cycle] = await tx.select().from(provisionCycles).where(and(eq(provisionCycles.id, input.id), eq(provisionCycles.organizationId, org))).for("update").limit(1);
    if (!cycle) throw new AccessDeniedError();
    if (cycle.status !== "realized" || !cycle.financialExpenseId) throw new ProvisionCycleError("Corrija somente uma ocorrência realizada com conta a pagar vinculada.");
    const [before] = await tx.select({ ...getTableColumns(financialExpenses), ledgerSettled: titleSettledAmount("payable") }).from(financialExpenses)
      .where(and(eq(financialExpenses.id, cycle.financialExpenseId), eq(financialExpenses.organizationId, org), isNull(financialExpenses.deletedAt))).for("update").limit(1);
    if (!before) throw new AccessDeniedError();
    if (before.status === "cancelled" || moneyToCents(before.ledgerSettled) > 0) throw new ProvisionCycleError("Estorne as movimentações conciliadas ou revise a reserva histórica antes de corrigir esta cobrança.");
    const amount = centsToMoney(moneyToCents(input.amount));
    if (amount === before.amount && input.dueDate === before.dueDate) return cycle;
    const [after] = await tx.update(financialExpenses).set({ amount, dueDate: input.dueDate, updatedAt: new Date() })
      .where(and(eq(financialExpenses.id, before.id), eq(financialExpenses.organizationId, org))).returning();
    await writeAuditLog(context, { action: "update", entityType: "financial_expense", entityId: before.id, before, after, metadata: { provisionCycleId: cycle.id, reason: input.reason, origin: "provision_cycle_correction" } });
    await writeAuditLog(context, { action: "update", entityType: "provision_cycle", entityId: cycle.id, before: cycle, after: cycle, metadata: { financialExpenseId: before.id, reason: input.reason, correctedFields: ["amount", "dueDate"] } });
    return cycle;
  });
}
