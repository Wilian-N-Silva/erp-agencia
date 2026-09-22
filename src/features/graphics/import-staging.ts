import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";
import { withTenantDb } from "@/lib/db";
import { graphicImportBatches, graphicImportRows } from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCan } from "@/lib/rbac";
import { parseGraphicWorkbook } from "./import-xlsx";
import { GraphicImportError } from "./import-rules";

export async function stageGraphicImport(context: AccessContext, upload: File, mapping: unknown) {
  assertCan("graphics.import", context);
  if (!context.organizationId) throw new AccessDeniedError();
  const organizationId = context.organizationId;
  if (upload.size < 1 || upload.size > 10485760 || !/\.xlsx$/i.test(upload.name) || upload.name.length > 200 || /[\\/\u0000-\u001f]/.test(upload.name)) throw new GraphicImportError("Envie um arquivo .xlsx de até 10 MB com nome simples.");
  if (upload.type && !["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream"].includes(upload.type)) throw new GraphicImportError("O tipo do arquivo não corresponde a uma planilha XLSX.");
  const parsed = await parseGraphicWorkbook(Buffer.from(await upload.arrayBuffer()), mapping);
  return withTenantDb(context, async tx => {
    const [created] = await tx.insert(graphicImportBatches).values({ organizationId, checksum: parsed.checksum, fileName: upload.name, byteSize: upload.size, mapping: parsed.mapping, createdByUserId: context.userId })
      .onConflictDoNothing({ target: [graphicImportBatches.organizationId, graphicImportBatches.checksum] }).returning();
    if (!created) {
      const [existing] = await tx.select().from(graphicImportBatches).where(and(eq(graphicImportBatches.organizationId, organizationId), eq(graphicImportBatches.checksum, parsed.checksum))).limit(1);
      if (!existing) throw new GraphicImportError("A prévia está sendo preparada. Aguarde e tente novamente.");
      if (JSON.stringify(existing.mapping) !== JSON.stringify(parsed.mapping)) {
        // jsonb key order is not stable; compare canonical field order by parsing.
        const { graphicImportMappingSchema } = await import("./import-rules");
        if (JSON.stringify(graphicImportMappingSchema.parse(existing.mapping)) !== JSON.stringify(parsed.mapping)) throw new GraphicImportError("Este arquivo já possui prévia com outro mapeamento. Abra o lote existente para evitar duplicação.");
      }
      return { batch: existing, reused: true };
    }
    for (let offset = 0; offset < parsed.rows.length; offset += 200) await tx.insert(graphicImportRows).values(parsed.rows.slice(offset, offset + 200).map(row => ({ ...row, organizationId, batchId: created.id })));
    const counts = { clear: 0, ambiguous: 0, invalid: 0 };
    for (const row of parsed.rows) counts[row.classification]++;
    await writeAuditLog(context, { action: "create", entityType: "graphic_import_batch", entityId: created.id, after: { checksum: created.checksum, fileName: created.fileName, rowCount: parsed.rows.length, counts }, metadata: { phase: "dry_run", financialWrites: false } });
    return { batch: created, reused: false };
  });
}

export async function listGraphicImports(context: AccessContext) {
  assertCan("graphics.import", context);
  if (!context.organizationId) throw new AccessDeniedError();
  const organizationId = context.organizationId;
  return withTenantDb(context, tx => tx.select().from(graphicImportBatches).where(eq(graphicImportBatches.organizationId, organizationId)).orderBy(desc(graphicImportBatches.createdAt)).limit(100));
}

export async function getGraphicImport(context: AccessContext, rawId: unknown) {
  assertCan("graphics.import", context);
  if (!context.organizationId) throw new AccessDeniedError();
  const organizationId = context.organizationId, id = z.string().uuid().parse(rawId);
  return withTenantDb(context, async tx => {
    const [batch] = await tx.select().from(graphicImportBatches).where(and(eq(graphicImportBatches.organizationId, organizationId), eq(graphicImportBatches.id, id))).limit(1);
    if (!batch) return null;
    const rows = await tx.select().from(graphicImportRows).where(and(eq(graphicImportRows.organizationId, organizationId), eq(graphicImportRows.batchId, id))).orderBy(asc(graphicImportRows.kind), asc(graphicImportRows.sourceSheet), asc(graphicImportRows.sourceRow));
    return { batch, rows };
  });
}
