import { and, asc, desc, eq, getTableColumns, isNull } from "drizzle-orm";
import { writeAuditLog } from "@/lib/audit";
import { withTenantDb } from "@/lib/db";
import {
  financialEntries,
  graphicJobs,
  graphicSaleInstallments,
  graphicSaleRevisions,
  graphicSales,
} from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCan } from "@/lib/rbac";
import { titleSettledAmount } from "@/features/finance/ledger";
import { moneyToCents } from "@/features/finance/rules";
import {
  correctGraphicSaleSchema,
  graphicSaleRevisionToken,
  GraphicSaleCorrectionError,
} from "./sale-correction-rules";

export async function correctGraphicSale(context: AccessContext, raw: unknown) {
  assertCan("finance.write", context);
  assertCan("finance.reverse", context);
  if (!context.organizationId) throw new AccessDeniedError();
  const input = correctGraphicSaleSchema.parse(raw),
    org = context.organizationId;
  return withTenantDb(context, async (tx) => {
    const [job] = await tx
      .select()
      .from(graphicJobs)
      .where(
        and(
          eq(graphicJobs.id, input.jobId),
          eq(graphicJobs.organizationId, org),
          isNull(graphicJobs.deletedAt),
        ),
      )
      .for("update")
      .limit(1);
    if (!job) throw new AccessDeniedError();
    const [sale] = await tx
      .select()
      .from(graphicSales)
      .where(
        and(
          eq(graphicSales.id, input.saleId),
          eq(graphicSales.jobId, job.id),
          eq(graphicSales.organizationId, org),
        ),
      )
      .for("update")
      .limit(1);
    if (!sale) throw new AccessDeniedError();
    const [latest] = await tx
      .select()
      .from(graphicSaleRevisions)
      .where(
        and(
          eq(graphicSaleRevisions.organizationId, org),
          eq(graphicSaleRevisions.saleId, sale.id),
        ),
      )
      .orderBy(desc(graphicSaleRevisions.version))
      .limit(1);
    const links = await tx
      .select()
      .from(graphicSaleInstallments)
      .where(
        and(
          eq(graphicSaleInstallments.organizationId, org),
          eq(graphicSaleInstallments.saleId, sale.id),
        ),
      )
      .orderBy(asc(graphicSaleInstallments.entryId));
    if (
      !links.length ||
      links.length !== input.installments.length ||
      links.some(
        (link) =>
          !input.installments.some((row) => row.entryId === link.entryId),
      )
    )
      throw new GraphicSaleCorrectionError(
        "Corrija todas as parcelas existentes desta venda. Não acrescente ou remova vínculos nesta operação.",
      );
    const before = [];
    for (const link of links) {
      const [entry] = await tx
        .select(getTableColumns(financialEntries))
        .from(financialEntries)
        .where(
          and(
            eq(financialEntries.id, link.entryId),
            eq(financialEntries.organizationId, org),
            isNull(financialEntries.deletedAt),
          ),
        )
        .for("update")
        .limit(1);
      if (!entry || entry.clientId !== job.clientId)
        throw new AccessDeniedError();
      const [balance] = await tx
        .select({ settled: titleSettledAmount("receivable") })
        .from(financialEntries)
        .where(
          and(
            eq(financialEntries.id, entry.id),
            eq(financialEntries.organizationId, org),
          ),
        )
        .limit(1);
      if (
        !balance ||
        entry.status === "cancelled" ||
        moneyToCents(balance.settled) > 0
      )
        throw new GraphicSaleCorrectionError(
          "Estorne os recebimentos ou revise as reservas históricas antes de corrigir a venda. Parcelas canceladas exigem conferência da origem.",
        );
      before.push(entry);
    }
    const amount = latest?.amount ?? sale.amount,
      competence = latest?.competence ?? sale.competence;
    if (
      amount === input.amount &&
      competence === input.competence &&
      before.every((entry) => {
        const wanted = input.installments.find(
          (row) => row.entryId === entry.id,
        )!;
        return (
          entry.amount === wanted.amount &&
          entry.dueDate === wanted.dueDate &&
          entry.competence === input.competence
        );
      })
    )
      return sale;
    const token = graphicSaleRevisionToken({
      saleId: sale.id,
      revisionId: latest?.id ?? null,
      amount,
      competence,
      installments: before.map((entry) => ({
        entryId: entry.id,
        amount: entry.amount,
        dueDate: entry.dueDate,
        competence: entry.competence,
      })),
    });
    if (token !== input.revision)
      throw new GraphicSaleCorrectionError(
        "Esta venda foi alterada desde sua consulta. Atualize a página antes de corrigir.",
      );
    const [revision] = await tx
      .insert(graphicSaleRevisions)
      .values({
        organizationId: org,
        saleId: sale.id,
        version: (latest?.version ?? 0) + 1,
        beforeAmount: amount,
        amount: input.amount,
        beforeCompetence: competence,
        competence: input.competence,
        beforeInstallments: before.map((entry) => ({
          entryId: entry.id,
          amount: entry.amount,
          dueDate: entry.dueDate,
          competence: entry.competence,
        })),
        installments: [...input.installments]
          .sort((a, b) => a.entryId.localeCompare(b.entryId))
          .map((row) => ({ ...row, competence: input.competence })),
        reason: input.reason,
        createdByUserId: context.userId,
      })
      .returning();
    for (const entry of before) {
      const wanted = input.installments.find(
        (row) => row.entryId === entry.id,
      )!;
      const [after] = await tx
        .update(financialEntries)
        .set({
          amount: wanted.amount,
          dueDate: wanted.dueDate,
          competence: input.competence,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(financialEntries.id, entry.id),
            eq(financialEntries.organizationId, org),
          ),
        )
        .returning();
      await writeAuditLog(context, {
        action: "update",
        entityType: "financial_entry",
        entityId: entry.id,
        before: entry,
        after,
        metadata: {
          origin: "graphic_sale_correction",
          graphicJobId: job.id,
          saleRevisionId: revision.id,
          reason: input.reason,
        },
      });
    }
    await writeAuditLog(context, {
      action: "create",
      entityType: "graphic_sale_revision",
      entityId: revision.id,
      after: revision,
    });
    return sale;
  });
}
