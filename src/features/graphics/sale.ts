import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { writeAuditLog } from "@/lib/audit";
import { db, withTenantDb } from "@/lib/db";
import { financialEntries, graphicClientDecisions, graphicJobs, graphicOsVersions, graphicSaleInstallments, graphicSales } from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCan } from "@/lib/rbac";
import { GraphicFlowError } from "./client-decision-rules";
import { graphicSaleSchema } from "./sale-rules";
import { canReadGraphicJobs } from "./rules";

export async function registerGraphicSale(context: AccessContext, raw: unknown) {
  assertCan("graphics.client_approval_write", context);
  if (!context.organizationId) throw new AccessDeniedError();
  const organizationId = context.organizationId;
  const input = graphicSaleSchema.parse(raw);
  return withTenantDb(context, async () => {
    const [job] = await db.select().from(graphicJobs).where(and(eq(graphicJobs.id, input.jobId), eq(graphicJobs.organizationId, organizationId), isNull(graphicJobs.deletedAt))).for("update").limit(1);
    if (!job) throw new AccessDeniedError();
    const [existing] = await db.select().from(graphicSales).where(and(eq(graphicSales.organizationId, organizationId), eq(graphicSales.jobId, job.id))).limit(1);
    if (existing) return existing;
    if (!["approved", "in_production", "waiting", "ready", "delivered"].includes(job.operationalStatus)) throw new GraphicFlowError("Registre a venda após a aprovação do cliente e antes do encerramento.");
    const [os] = await db.select().from(graphicOsVersions).where(and(eq(graphicOsVersions.jobId, job.id), eq(graphicOsVersions.organizationId, organizationId))).orderBy(desc(graphicOsVersions.version)).limit(1);
    const [decision] = await db.select().from(graphicClientDecisions).where(and(eq(graphicClientDecisions.jobId, job.id), eq(graphicClientDecisions.organizationId, organizationId))).orderBy(desc(graphicClientDecisions.createdAt), desc(graphicClientDecisions.id)).limit(1);
    if (!os || os.id !== input.osVersionId || decision?.osVersionId !== os.id || decision.decision !== "approved") throw new GraphicFlowError("Confirme a aprovação da versão atual da OS antes de registrar a venda.");
    const [sale] = await db.insert(graphicSales).values({ organizationId, jobId: job.id, osVersionId: os.id, amount: input.amount, competence: input.competence, notes: input.notes, createdByUserId: context.userId }).returning();
    for (const [index, installment] of input.installments.entries()) {
      const [entry] = await db.insert(financialEntries).values({ organizationId, clientId: job.clientId, amount: installment.amount, receivedAmount: "0.00", dueDate: installment.dueDate,
        description: `Gráfica ${job.internalCode} · ${installment.label}`.slice(0,180), competence: input.competence, status: "planned", notes: input.notes, responsibleUserId: context.userId }).returning();
      await db.insert(graphicSaleInstallments).values({ organizationId, saleId: sale.id, entryId: entry.id, ordinal: index + 1, label: installment.label });
      await writeAuditLog(context, { action: "create", entityType: "financial_entry", entityId: entry.id, after: entry, metadata: { origin: "graphic_job", graphicJobId: job.id, saleId: sale.id, installment: index + 1 } });
    }
    await writeAuditLog(context, { action: "create", entityType: "graphic_sale", entityId: sale.id, after: sale });
    return sale;
  });
}

export async function getGraphicSale(context: AccessContext, jobId: string) {
  if (!context.organizationId || !canReadGraphicJobs(context)) throw new AccessDeniedError();
  return withTenantDb(context, async () => {
    const [sale] = await db.select().from(graphicSales).where(and(eq(graphicSales.organizationId, context.organizationId!), eq(graphicSales.jobId, jobId))).limit(1);
    if (!sale) return null;
    const installments = await db.select({ id: graphicSaleInstallments.id, ordinal: graphicSaleInstallments.ordinal, label: graphicSaleInstallments.label,
      entryId: financialEntries.id, amount: financialEntries.amount, dueDate: financialEntries.dueDate })
      .from(graphicSaleInstallments).innerJoin(financialEntries, and(eq(financialEntries.id, graphicSaleInstallments.entryId), eq(financialEntries.organizationId, graphicSaleInstallments.organizationId)))
      .where(and(eq(graphicSaleInstallments.organizationId, context.organizationId!), eq(graphicSaleInstallments.saleId, sale.id))).orderBy(asc(graphicSaleInstallments.ordinal));
    return { sale, installments };
  });
}
