import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { createDatabase, getDb, withTenantDb } from "@/lib/db";
import type { AccessContext } from "@/lib/dal";
import { getGraphicImport, listGraphicImports, stageGraphicImport } from "@/features/graphics/import-staging";

const audit = vi.hoisted(() => ({ fail: false }));
vi.mock("@/lib/audit", async original => {
  const actual = await original<typeof import("@/lib/audit")>();
  return { ...actual, writeAuditLog: (...args: Parameters<typeof actual.writeAuditLog>) => { if (audit.fail) throw new Error("Import audit failure"); return actual.writeAuditLog(...args); } };
});
const admin = createDatabase(process.env.DATABASE_TEST_ADMIN_URL!, { allowExitOnIdle: true });
const orgs = [randomUUID(), randomUUID()];
const users = orgs.map(id => `import-${id}`);
const contexts: AccessContext[] = orgs.map((organizationId, i) => ({ organizationId, userId: users[i], employeeId: null, roles: [], permissions: ["graphics.import"] }));
const mapping = { blocks: [{ kind: "sales", sheet: "Vendas", firstRow: 2, lastRow: 3, columns: { osNumber: 1, date: 2, amount: 3 } }] };
let file: File, batchId: string, rowId: string;
beforeAll(async () => {
  for (const [i, org] of orgs.entries()) {
    await admin.execute(sql`insert into organizations (id,name,slug) values (${org},'Import QA',${org})`);
    await admin.execute(sql`insert into "user" (id,organization_id,name,email,access_status) values (${users[i]},${org},'Import QA',${`${users[i]}@example.test`},'active')`);
  }
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Vendas");
  sheet.addRows([["OS", "Data", "Valor"], ["100", "2026-09-22", "100,00"], ["100 e 101", "inválida", "50,00"]]);
  file = new File([new Uint8Array(await workbook.xlsx.writeBuffer())], "historico.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
});
afterAll(async () => {
  await admin.transaction(async tx => {
    await tx.execute(sql`alter table graphic_import_rows disable trigger graphic_import_rows_provenance`);
    await tx.execute(sql`alter table graphic_import_batches disable trigger graphic_import_batches_provenance`);
    for (const org of orgs) for (const table of ["audit_logs", "graphic_import_rows", "graphic_import_batches", "user"]) await tx.execute(sql`delete from ${sql.identifier(table)} where organization_id=${org}`);
    for (const org of orgs) await tx.execute(sql`delete from organizations where id=${org}`);
    await tx.execute(sql`alter table graphic_import_rows enable trigger graphic_import_rows_provenance`);
    await tx.execute(sql`alter table graphic_import_batches enable trigger graphic_import_batches_provenance`);
  });
  await admin.$client.end();
});
it("rolls back staging when audit fails and makes concurrent dry runs idempotent without financial writes", async () => {
  audit.fail = true;
  try { await expect(stageGraphicImport(contexts[0], file, mapping)).rejects.toThrow("Import audit failure"); }
  finally { audit.fail = false; }
  expect(await listGraphicImports(contexts[0])).toEqual([]);
  const results = await Promise.all([stageGraphicImport(contexts[0], file, mapping), stageGraphicImport(contexts[0], file, mapping)]);
  expect(results[0].batch.id).toBe(results[1].batch.id);
  expect(results.map(result => result.reused).sort()).toEqual([false, true]);
  batchId = results[0].batch.id;
  const preview = await getGraphicImport(contexts[0], batchId);
  expect(preview?.rows).toHaveLength(2);
  rowId = preview!.rows[0].id;
  expect(preview?.rows[0]).toMatchObject({ sourceSheet: "Vendas", sourceRow: 2, raw: { amount: "100,00" }, normalized: { amount: "100.00" }, status: "pending" });
  expect(preview?.rows[1].classification).toBe("invalid");
  for (const table of ["financial_transactions", "financial_entries", "financial_expenses", "graphic_jobs"]) expect((await admin.execute(sql`select count(*)::int n from ${sql.identifier(table)} where organization_id=${orgs[0]}`)).rows).toEqual([{ n: 0 }]);
  await expect(stageGraphicImport(contexts[0], file, { blocks: [{ ...mapping.blocks[0], lastRow: 2 }] })).rejects.toThrow("outro mapeamento");
});
it("protects staging permissions, provenance and cross-tenant reads and writes", async () => {
  await expect(stageGraphicImport({ ...contexts[0], permissions: ["graphics.write"] }, file, mapping)).rejects.toThrow();
  expect(await getGraphicImport(contexts[1], batchId)).toBeNull();
  for (const table of ["graphic_import_batches", "graphic_import_rows"]) {
    expect((await getDb().execute(sql`select id from ${sql.identifier(table)} where organization_id=${orgs[0]}`)).rows).toEqual([]);
    await withTenantDb(contexts[1], async tx => {
      expect((await tx.execute(sql`select id from ${sql.identifier(table)} where organization_id=${orgs[0]}`)).rows).toEqual([]);
      expect((await tx.execute(sql`update ${sql.identifier(table)} set status=status where organization_id=${orgs[0]} returning id`)).rows).toEqual([]);
      expect((await tx.execute(sql`delete from ${sql.identifier(table)} where organization_id=${orgs[0]} returning id`)).rows).toEqual([]);
    });
  }
  await expect(withTenantDb(contexts[1], tx => tx.execute(sql`insert into graphic_import_batches (organization_id,checksum,file_name,byte_size,mapping,created_by_user_id) values (${orgs[0]},${"a".repeat(64)},'bad.xlsx',100,'{}',${users[0]})`))).rejects.toThrow();
  await expect(withTenantDb(contexts[1], tx => tx.execute(sql`insert into graphic_import_rows (organization_id,batch_id,kind,source_sheet,source_row,raw,normalized,classification,issues) values (${orgs[0]},${batchId},'sales','Bad',1,'{}','{}','clear','[]')`))).rejects.toThrow();
  await expect(admin.execute(sql`update graphic_import_rows set raw='{}' where id=${rowId}`)).rejects.toThrow();
  await expect(admin.execute(sql`delete from graphic_import_batches where id=${batchId}`)).rejects.toThrow();
  const independent = await stageGraphicImport(contexts[1], file, mapping);
  expect(independent.batch.id).not.toBe(batchId);
});
