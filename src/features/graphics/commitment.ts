import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { writeAuditLog } from "@/lib/audit";
import { db, withTenantDb } from "@/lib/db";
import { costCenters, financialCategories, financialExpenses, graphicClientDecisions, graphicJobs, graphicOsVersions, graphicSupplierCommitments, graphicSupplierQuotes, suppliers } from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCan } from "@/lib/rbac";
import { GraphicFlowError } from "./client-decision-rules";
import { graphicCommitmentSchema } from "./commitment-rules";
import { canReadGraphicJobs } from "./rules";

export async function contractGraphicSupplier(context: AccessContext, raw: unknown) {
  assertCan("graphics.production_write", context);
  if (!context.organizationId) throw new AccessDeniedError();
  const organizationId = context.organizationId;
  const input = graphicCommitmentSchema.parse(raw);
  return withTenantDb(context, async () => {
    const [job] = await db.select().from(graphicJobs).where(and(eq(graphicJobs.id, input.jobId), eq(graphicJobs.organizationId, organizationId), isNull(graphicJobs.deletedAt))).for("update").limit(1);
    if (!job) throw new AccessDeniedError();
    const [existing] = await db.select().from(graphicSupplierCommitments).where(and(eq(graphicSupplierCommitments.organizationId, organizationId), eq(graphicSupplierCommitments.jobId, job.id), eq(graphicSupplierCommitments.quoteId, input.quoteId))).limit(1);
    if (existing) return existing;
    if (!["approved", "waiting"].includes(job.operationalStatus)) throw new GraphicFlowError("A contratação exige aprovação do cliente e deve anteceder a produção.");
    const [os] = await db.select({ id: graphicOsVersions.id }).from(graphicOsVersions).where(and(eq(graphicOsVersions.jobId, job.id), eq(graphicOsVersions.organizationId, organizationId))).orderBy(desc(graphicOsVersions.version)).limit(1);
    const [decision] = await db.select().from(graphicClientDecisions).where(and(eq(graphicClientDecisions.jobId, job.id), eq(graphicClientDecisions.organizationId, organizationId))).orderBy(desc(graphicClientDecisions.createdAt), desc(graphicClientDecisions.id)).limit(1);
    if (!os || decision?.osVersionId !== os.id || decision.decision !== "approved") throw new GraphicFlowError("Confirme a aprovação do cliente sobre a versão atual da OS.");
    const [quote] = await db.select().from(graphicSupplierQuotes).where(and(eq(graphicSupplierQuotes.id, input.quoteId), eq(graphicSupplierQuotes.jobId, job.id), eq(graphicSupplierQuotes.organizationId, organizationId), eq(graphicSupplierQuotes.status, "approved"))).limit(1);
    if (!quote) throw new GraphicFlowError("Selecione a cotação aprovada para este trabalho.");
    if (Number(quote.quotedAmount) >= 1e10) throw new GraphicFlowError("O valor excede o limite financeiro permitido.");
    const [supplier] = await db.select().from(suppliers).where(and(eq(suppliers.id, quote.supplierId), eq(suppliers.organizationId, organizationId), eq(suppliers.isActive, true))).limit(1);
    const [category] = await db.select().from(financialCategories).where(and(eq(financialCategories.id, input.categoryId), eq(financialCategories.organizationId, organizationId), eq(financialCategories.isActive, true), inArray(financialCategories.nature, ["expense", "both"]))).limit(1);
    const [center] = input.costCenterId ? await db.select().from(costCenters).where(and(eq(costCenters.id, input.costCenterId), eq(costCenters.organizationId, organizationId), eq(costCenters.isActive, true))).limit(1) : [];
    if (!supplier || !category || (input.costCenterId && !center)) throw new AccessDeniedError();
    const [expense] = await db.insert(financialExpenses).values({ organizationId, supplierId: supplier.id, supplier: supplier.name, categoryId: category.id, category: category.name,
      costCenterId: center?.id ?? null, costCenter: center?.name ?? null, description: `Gráfica ${job.internalCode} · ${job.title}`.slice(0,180), amount: quote.quotedAmount, dueDate: input.dueDate,
      competence: input.competence, status: "planned", paidAmount: "0.00", notes: input.notes, responsibleUserId: context.userId }).returning();
    const [commitment] = await db.insert(graphicSupplierCommitments).values({ organizationId, jobId: job.id, quoteId: quote.id, expenseId: expense.id, contractedAt: input.contractedAt, notes: input.notes, createdByUserId: context.userId }).returning();
    await writeAuditLog(context, { action: "create", entityType: "financial_expense", entityId: expense.id, after: expense, metadata: { origin: "graphic_job", graphicJobId: job.id, commitmentId: commitment.id } });
    await writeAuditLog(context, { action: "create", entityType: "graphic_supplier_commitment", entityId: commitment.id, after: commitment });
    return commitment;
  });
}

export async function getGraphicCommitments(context: AccessContext, jobId: string) {
  if (!context.organizationId || !canReadGraphicJobs(context)) throw new AccessDeniedError();
  return withTenantDb(context, () => db.select({ commitment: graphicSupplierCommitments, supplier: financialExpenses.supplier, amount: financialExpenses.amount, dueDate: financialExpenses.dueDate })
    .from(graphicSupplierCommitments).innerJoin(financialExpenses, and(eq(financialExpenses.id, graphicSupplierCommitments.expenseId), eq(financialExpenses.organizationId, graphicSupplierCommitments.organizationId)))
    .where(and(eq(graphicSupplierCommitments.organizationId, context.organizationId!), eq(graphicSupplierCommitments.jobId, jobId))).orderBy(desc(graphicSupplierCommitments.createdAt)));
}

export async function getGraphicCommitmentOptions(context: AccessContext) {
  assertCan("graphics.production_write", context);
  if (!context.organizationId) throw new AccessDeniedError();
  return withTenantDb(context, async () => ({
    categories: await db.select({ id: financialCategories.id, name: financialCategories.name }).from(financialCategories).where(and(eq(financialCategories.organizationId, context.organizationId!), eq(financialCategories.isActive, true), inArray(financialCategories.nature, ["expense", "both"]))).orderBy(asc(financialCategories.name)),
    centers: await db.select({ id: costCenters.id, name: costCenters.name }).from(costCenters).where(and(eq(costCenters.organizationId, context.organizationId!), eq(costCenters.isActive, true))).orderBy(asc(costCenters.name)),
  }));
}
