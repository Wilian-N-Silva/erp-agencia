import { and, asc, eq, isNull } from "drizzle-orm";
import { writeAuditLog } from "@/lib/audit";
import { withTenantDb } from "@/lib/db";
import { financialExpenses, provisionCycles, provisions, suppliers } from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCan } from "@/lib/rbac";
import { cancelCycleSchema, planCycleSchema, ProvisionCycleError, realizeCycleSchema } from "./rules";

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
    if (before.status !== "planned") throw new ProvisionCycleError("Ocorrência realizada possui conta a pagar. Corrija a obrigação pelo Financeiro.");
    const [after] = await tx.update(provisionCycles).set({ status: "cancelled", cancellationReason: input.reason, updatedAt: new Date() }).where(and(eq(provisionCycles.id, before.id), eq(provisionCycles.organizationId, org))).returning();
    await writeAuditLog(context, { action: "status_change", entityType: "provision_cycle", entityId: before.id, before, after });
    return after;
  });
}

export async function listProvisionCycles(context: AccessContext) {
  const org = authorize(context, "finance.read");
  return withTenantDb(context, tx => tx.select().from(provisionCycles).where(eq(provisionCycles.organizationId, org)).orderBy(asc(provisionCycles.competence), asc(provisionCycles.id)));
}
