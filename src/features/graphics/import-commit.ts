import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { createFinancialTransactionRecord } from "@/features/finance-transactions/dal";
import { generateWorkItem, resolveWorkItem } from "@/features/work-items/dal";
import { writeAuditLog } from "@/lib/audit";
import { withTenantDb, type TenantTransaction } from "@/lib/db";
import { clients, employees, financialAccounts, financialEntries, financialTransactions, graphicImportBatches, graphicImportRows, graphicJobs, graphicProjects, graphicSaleInstallments, graphicSales, suppliers, workItems } from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCan } from "@/lib/rbac";
import { GraphicImportError, graphicImportResolutionSchema, reviewGraphicImportRowSchema } from "./import-rules";

type Resolution = z.infer<typeof graphicImportResolutionSchema>;
function authorize(context: AccessContext) { assertCan("graphics.import", context); if (!context.organizationId) throw new AccessDeniedError(); return context.organizationId; }

export async function reviewGraphicImportRow(context: AccessContext, raw: unknown) {
  const organizationId = authorize(context), input = reviewGraphicImportRowSchema.parse(raw);
  return withTenantDb(context, async tx => {
    const [row] = await tx.select().from(graphicImportRows).where(and(eq(graphicImportRows.organizationId, organizationId), eq(graphicImportRows.id, input.rowId))).for("update").limit(1);
    if (!row) throw new AccessDeniedError();
    if (!["pending", "ready"].includes(row.status) || row.revision !== input.expectedRevision) throw new GraphicImportError("A linha mudou ou já foi finalizada. Atualize a prévia.");
    if (input.resolution.kind !== row.kind) throw new GraphicImportError("O tipo da linha deve corresponder ao bloco original.");
    await validateReferences(tx, context, input.resolution);
    const [after] = await tx.update(graphicImportRows).set({ resolution: input.resolution, status: "ready", revision: row.revision + 1, reviewedByUserId: context.userId, reviewedAt: new Date() }).where(and(eq(graphicImportRows.organizationId, organizationId), eq(graphicImportRows.id, row.id))).returning();
    await writeAuditLog(context, { action: "update", entityType: "graphic_import_row", entityId: row.id, before: { resolution: row.resolution, revision: row.revision, status: row.status }, after: { resolution: after.resolution, revision: after.revision, status: after.status }, metadata: { batchId: row.batchId } });
    return after;
  });
}

export async function ignoreGraphicImportRow(context: AccessContext, raw: unknown) {
  const organizationId = authorize(context);
  const input = z.strictObject({ rowId: z.string().uuid(), expectedRevision: z.number().int().min(0), reason: z.string().trim().min(3).max(1000) }).parse(raw);
  return withTenantDb(context, async tx => {
    const [row] = await tx.select().from(graphicImportRows).where(and(eq(graphicImportRows.organizationId, organizationId), eq(graphicImportRows.id, input.rowId))).for("update").limit(1);
    if (!row) throw new AccessDeniedError();
    if (row.status === "ignored") return row;
    if (row.status === "imported" || row.revision !== input.expectedRevision) throw new GraphicImportError("A linha já foi alterada. Atualize a página.");
    const [after] = await tx.update(graphicImportRows).set({ status: "ignored", resolution: { reason: input.reason }, reviewedByUserId: context.userId, reviewedAt: new Date(), revision: row.revision + 1 }).where(and(eq(graphicImportRows.organizationId, organizationId), eq(graphicImportRows.id, row.id))).returning();
    await resolveImportItems(tx, context, row.id, `Linha ignorada: ${input.reason}`);
    await writeAuditLog(context, { action: "status_change", entityType: "graphic_import_row", entityId: row.id, before: { status: row.status }, after: { status: after.status, reason: input.reason }, metadata: { batchId: row.batchId } });
    return after;
  });
}

export async function commitGraphicImport(context: AccessContext, raw: unknown) {
  const organizationId = authorize(context);
  const input = z.strictObject({ batchId: z.string().uuid(), confirmed: z.literal("on") }).parse(raw);
  return withTenantDb(context, async tx => {
    const [batch] = await tx.select().from(graphicImportBatches).where(and(eq(graphicImportBatches.organizationId, organizationId), eq(graphicImportBatches.id, input.batchId))).for("update").limit(1);
    if (!batch) throw new AccessDeniedError();
    const rows = await tx.select().from(graphicImportRows).where(and(eq(graphicImportRows.organizationId, organizationId), eq(graphicImportRows.batchId, batch.id), eq(graphicImportRows.status, "ready"))).orderBy(asc(graphicImportRows.id)).for("update").limit(100);
    for (const row of rows) {
      const resolution = graphicImportResolutionSchema.parse(row.resolution);
      await validateReferences(tx, context, resolution);
      const metadata = { origin: "graphics_import", importBatchId: batch.id, sourceRowId: row.id, sourceSheet: row.sourceSheet, sourceRow: row.sourceRow, checksum: batch.checksum };
      let jobId: string | null = null, entryId: string | null = null, transactionId: string | null = null;
      if (resolution.kind === "sales") {
        const [job] = await tx.insert(graphicJobs).values({ organizationId, internalCode: `IMP-${row.id}`, clientId: resolution.clientId, title: resolution.description, description: resolution.description,
          responsibleEmployeeId: resolution.responsibleEmployeeId, projectId: resolution.projectId, requestedAt: new Date(`${resolution.date}T12:00:00Z`), operationalStatus: resolution.operationalStatus,
          notes: `Importação histórica: ${batch.fileName} · ${row.sourceSheet}:${row.sourceRow}. OS informada: ${resolution.osNumber || "ausente"}. Sem PDF ou aprovação inferida. ${resolution.reason}` }).returning();
        const [entry] = await tx.insert(financialEntries).values({ organizationId, clientId: resolution.clientId, description: `Gráfica ${job.internalCode} · Histórico`.slice(0,180), amount: resolution.amount, receivedAmount: "0.00", dueDate: resolution.dueDate, competence: resolution.competence, status: "planned", responsibleUserId: context.userId, notes: resolution.reason }).returning();
        const [sale] = await tx.insert(graphicSales).values({ organizationId, jobId: job.id, historicalImportRowId: row.id, amount: resolution.amount, competence: resolution.competence, notes: `Venda histórica revisada. OS: ${resolution.osNumber || "ausente"}. ${resolution.reason}`, createdByUserId: context.userId }).returning();
        await tx.insert(graphicSaleInstallments).values({ organizationId, saleId: sale.id, entryId: entry.id, ordinal: 1, label: "Saldo histórico confirmado" });
        jobId = job.id; entryId = entry.id;
        await writeAuditLog(context, { action: "create", entityType: "graphic_job", entityId: job.id, after: job, metadata });
        await writeAuditLog(context, { action: "create", entityType: "financial_entry", entityId: entry.id, after: entry, metadata });
        await writeAuditLog(context, { action: "create", entityType: "graphic_sale", entityId: sale.id, after: sale, metadata });
      } else {
        const movement = await createFinancialTransactionRecord(context, { accountId: resolution.accountId, direction: resolution.kind === "incoming" ? "in" : "out", amount: resolution.amount, occurredAt: new Date(`${resolution.date}T12:00:00Z`), clientId: resolution.clientId, supplierId: resolution.supplierId, counterpartyName: resolution.counterpartyName || null, method: null, reference: resolution.reference || resolution.description });
        const [after] = await tx.update(financialTransactions).set({ origin: "import", importMetadata: metadata }).where(and(eq(financialTransactions.organizationId, organizationId), eq(financialTransactions.id, movement.id))).returning();
        transactionId = movement.id;
        await writeAuditLog(context, { action: "update", entityType: "financial_transaction", entityId: movement.id, before: movement, after, metadata });
      }
      await tx.update(graphicImportRows).set({ status: "imported", importedAt: new Date(), jobId, entryId, transactionId, revision: row.revision + 1 }).where(and(eq(graphicImportRows.organizationId, organizationId), eq(graphicImportRows.id, row.id)));
      await resolveImportItems(tx, context, row.id, "Linha revisada e importada; vínculos financeiros permanecem sujeitos à conciliação.");
      await writeAuditLog(context, { action: "status_change", entityType: "graphic_import_row", entityId: row.id, before: { status: "ready" }, after: { status: "imported", jobId, entryId, transactionId }, metadata });
    }
    const remaining = await tx.select({ id: graphicImportRows.id, status: graphicImportRows.status, sourceSheet: graphicImportRows.sourceSheet, sourceRow: graphicImportRows.sourceRow }).from(graphicImportRows).where(and(eq(graphicImportRows.organizationId, organizationId), eq(graphicImportRows.batchId, batch.id), inArray(graphicImportRows.status, ["pending", "ready"])));
    for (const row of remaining.filter(row => row.status === "pending")) await generateWorkItem(context, { kind: "graphic_import_review", sourceType: "graphic_import_row", sourceId: row.id, occurrenceKey: "initial", title: `Revisar importação · ${row.sourceSheet}:${row.sourceRow}`.slice(0,200), description: "A linha histórica precisa de revisão explícita. Abra o lote de importação para confirmar os dados ou ignorar a linha com justificativa.", assignedUserId: context.userId });
    const status = remaining.length ? "partial" : "complete";
    await tx.update(graphicImportBatches).set({ status }).where(and(eq(graphicImportBatches.organizationId, organizationId), eq(graphicImportBatches.id, batch.id)));
    await writeAuditLog(context, { action: "status_change", entityType: "graphic_import_batch", entityId: batch.id, before: { status: batch.status }, after: { status, importedThisRun: rows.length, remaining: remaining.length } });
    return { batchId: batch.id, imported: rows.length, remaining: remaining.length, status };
  });
}

async function validateReferences(tx: TenantTransaction, context: AccessContext, input: Resolution) {
  const organizationId = context.organizationId!;
  if (input.clientId && !(await tx.select({ id: clients.id }).from(clients).where(and(eq(clients.organizationId, organizationId), eq(clients.id, input.clientId), isNull(clients.deletedAt))).limit(1)).length) throw new AccessDeniedError();
  if (input.kind === "sales") {
    if (!(await tx.select({ id: employees.id }).from(employees).where(and(eq(employees.organizationId, organizationId), eq(employees.id, input.responsibleEmployeeId), isNull(employees.deletedAt))).limit(1)).length) throw new AccessDeniedError();
    if (input.projectId && !(await tx.select({ id: graphicProjects.id }).from(graphicProjects).where(and(eq(graphicProjects.organizationId, organizationId), eq(graphicProjects.id, input.projectId), isNull(graphicProjects.deletedAt))).limit(1)).length) throw new AccessDeniedError();
  } else {
    assertCan("finance.write", context);
    if ((input.kind === "incoming" && input.supplierId) || (input.kind === "outgoing" && input.clientId)) throw new GraphicImportError("Entrada aceita cliente; saída aceita fornecedor. Não troque a contraparte.");
    if (!(await tx.select({ id: financialAccounts.id }).from(financialAccounts).where(and(eq(financialAccounts.organizationId, organizationId), eq(financialAccounts.id, input.accountId), eq(financialAccounts.status, "active"))).limit(1)).length) throw new AccessDeniedError();
    if (input.supplierId && !(await tx.select({ id: suppliers.id }).from(suppliers).where(and(eq(suppliers.organizationId, organizationId), eq(suppliers.id, input.supplierId), eq(suppliers.isActive, true))).limit(1)).length) throw new AccessDeniedError();
  }
}
async function resolveImportItems(tx: TenantTransaction, context: AccessContext, rowId: string, resolution: string) {
  const items = await tx.select({ id: workItems.id }).from(workItems).where(and(eq(workItems.organizationId, context.organizationId!), eq(workItems.sourceType, "graphic_import_row"), eq(workItems.sourceId, rowId), inArray(workItems.status, ["open", "in_progress"])));
  for (const item of items) await resolveWorkItem(context, { id: item.id, resolution });
}
