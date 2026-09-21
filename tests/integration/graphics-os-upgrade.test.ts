import { readFile } from "node:fs/promises";

import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabase, type Database } from "@/lib/db";

const adminUrl = process.env.DATABASE_TEST_ADMIN_URL;
if (!adminUrl) throw new Error("GRF-005 upgrade tests require an admin database URL.");

const schemaName = "grf_005_upgrade_0025";
const ids = {
  orgA: "73600000-0000-4000-8000-000000000001",
  orgB: "73600000-0000-4000-8000-000000000002",
  areaA: "73600000-0000-4000-8000-000000000003",
  positionA: "73600000-0000-4000-8000-000000000004",
  employeeA: "73600000-0000-4000-8000-000000000005",
  clientA: "73600000-0000-4000-8000-000000000006",
  supplierA: "73600000-0000-4000-8000-000000000007",
  jobA: "73600000-0000-4000-8000-000000000008",
  quoteA: "73600000-0000-4000-8000-000000000009",
} as const;
const userA = "grf-005-reviewer-a";
const userB = "grf-005-reviewer-b";
let adminDb: Database;

beforeAll(() => {
  adminDb = createDatabase(adminUrl, { allowExitOnIdle: true, max: 1 });
});

afterAll(async () => {
  await dropUpgradeSchema();
  await adminDb?.$client.end();
});

describe("OS migration upgrade 0025 -> 0028", () => {
  it("upgrades 0028 to client decisions without modifying an existing OS or document", async () => {
    await dropUpgradeSchema();
    try {
      await adminDb.transaction(async transaction => {
        await transaction.execute(sql.raw("create schema " + schemaName));
        await transaction.execute(sql.raw("set local search_path to " + schemaName + ", public"));
        for (let i = 0; i <= 28; i++) await applyMigration(transaction, i);
        await createPreMigrationFixtures(transaction);
        await transaction.execute(sql.raw(`insert into files (id,organization_id,storage_provider,storage_key,original_name,mime_type,extension,byte_size,sensitivity,uploaded_by_user_id)
          values ('73600000-0000-4000-8000-000000000010','${ids.orgA}','local','upgrade/os.pdf','os.pdf','application/pdf','pdf',100,'restricted','${userA}')`));
        await transaction.execute(sql.raw(`insert into graphic_os_versions (organization_id,job_id,version,external_number,issued_at,presented_amount,file_id,created_by_user_id)
          values ('${ids.orgA}','${ids.jobA}',1,'OS-UPGRADE','2026-09-21',1500,'73600000-0000-4000-8000-000000000010','${userA}')`));
        const before = (await transaction.execute(sql.raw("select * from graphic_os_versions"))).rows;
        for (let i = 29; i <= 30; i++) await applyMigration(transaction, i);
        expect((await transaction.execute(sql.raw("select * from graphic_os_versions"))).rows).toEqual(before);
        expect((await transaction.execute(sql.raw("select count(*)::int n from graphic_client_decisions"))).rows).toEqual([{ n: 0 }]);
        expect((await transaction.execute(sql.raw("select relrowsecurity, relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='" + schemaName + "' and c.relname='graphic_client_decisions'"))).rows).toEqual([{relrowsecurity:true,relforcerowsecurity:true}]);
      });
    } finally { await dropUpgradeSchema(); }
  }, 30_000);
  it("preserves existing jobs and quotes and creates forced tenant isolation", async () => {
    await dropUpgradeSchema();
    try {
      await adminDb.transaction(async transaction => {
        await transaction.execute(sql.raw("create schema " + schemaName));
        await transaction.execute(sql.raw("set local search_path to " + schemaName + ", public"));
        for (let i = 0; i <= 25; i++) await applyMigration(transaction, i);
        await createPreMigrationFixtures(transaction);
        const before = await transaction.execute(sql.raw("select id, operational_status from graphic_jobs"));
        for (let i = 26; i <= 28; i++) await applyMigration(transaction, i);
        expect((await transaction.execute(sql.raw("select id, operational_status from graphic_jobs"))).rows).toEqual(before.rows);
        expect((await transaction.execute(sql.raw("select count(*)::int n from graphic_supplier_quotes"))).rows).toEqual([{n:1}]);
        expect((await transaction.execute(sql.raw("select count(*)::int n from graphic_os_versions"))).rows).toEqual([{n:0}]);
        const protection = await transaction.execute(sql.raw("select relrowsecurity, relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='" + schemaName + "' and c.relname='graphic_os_versions'"));
        expect(protection.rows).toEqual([{relrowsecurity:true,relforcerowsecurity:true}]);
        const policies = await transaction.execute(sql.raw("select policyname from pg_policies where schemaname='" + schemaName + "' and tablename='graphic_os_versions'"));
        expect(policies.rows).toEqual([{policyname:'graphic_os_versions_tenant_isolation'}]);
      });
    } finally { await dropUpgradeSchema(); }
  }, 30_000);
});

async function createPreMigrationFixtures(database: Pick<Database, "execute">) {
  await database.execute(sql.raw(`insert into organizations (id, name, slug) values
    ('${ids.orgA}', 'GRF-005 A', 'grf-005-a'), ('${ids.orgB}', 'GRF-005 B', 'grf-005-b')`));
  await database.execute(sql.raw(`insert into "user" (id, organization_id, name, email) values
    ('${userA}', '${ids.orgA}', 'Reviewer A', 'grf-005-a@example.test'),
    ('${userB}', '${ids.orgB}', 'Reviewer B', 'grf-005-b@example.test')`));
  await database.execute(sql.raw(`insert into roles (key, name) values
    ('technical_admin', 'Technical admin'), ('director', 'Director') on conflict (key) do nothing`));
  await database.execute(sql.raw(`insert into areas (id, organization_id, name) values
    ('${ids.areaA}', '${ids.orgA}', 'Graphics')`));
  await database.execute(sql.raw(`insert into positions (id, organization_id, name) values
    ('${ids.positionA}', '${ids.orgA}', 'Operator')`));
  await database.execute(sql.raw(`insert into employees (
    id, organization_id, registration_number, full_name, position_id, area_id,
    employment_type, start_date, current_compensation
  ) values (
    '${ids.employeeA}', '${ids.orgA}', 'GRF-005', 'Operator', '${ids.positionA}',
    '${ids.areaA}', 'clt', '2026-01-01', 1000
  )`));
  await database.execute(sql.raw(`insert into clients (id, organization_id, name, code) values
    ('${ids.clientA}', '${ids.orgA}', 'Client A', 'GRF-005')`));
  await database.execute(sql.raw(`insert into suppliers (id, organization_id, name) values
    ('${ids.supplierA}', '${ids.orgA}', 'Supplier A')`));
  await database.execute(sql.raw(`insert into graphic_jobs (
    id, organization_id, internal_code, client_id, title, description, responsible_employee_id
  ) values (
    '${ids.jobA}', '${ids.orgA}', 'GRF-005', '${ids.clientA}', 'Banner', 'Description',
    '${ids.employeeA}'
  )`));
  await database.execute(sql.raw(`insert into graphic_supplier_quotes (
    id, organization_id, job_id, supplier_id, description, quoted_amount, quoted_at
  ) values (
    '${ids.quoteA}', '${ids.orgA}', '${ids.jobA}', '${ids.supplierA}', 'Quote', 100, now()
  )`));
}

async function applyMigration(database: Pick<Database, "execute">, migrationIndex: number) {
  const journal = JSON.parse(
    await readFile(new URL("../../drizzle/meta/_journal.json", import.meta.url), "utf8"),
  ) as { entries: Array<{ idx: number; tag: string }> };
  const entry = journal.entries.find(({ idx }) => idx === migrationIndex);
  if (!entry) throw new Error(`Migration ${migrationIndex} is missing from the journal.`);
  const migration = (
    await readFile(new URL(`../../drizzle/${entry.tag}.sql`, import.meta.url), "utf8")
  ).replaceAll('"public".', `"${schemaName}".`);
  for (const statement of migration
    .split("--> statement-breakpoint")
    .map((value) => value.trim())
    .filter(Boolean)) {
    await database.execute(sql.raw(statement));
  }
}

async function dropUpgradeSchema() {
  if (adminDb) await adminDb.execute(sql.raw(`drop schema if exists ${schemaName} cascade`));
}
