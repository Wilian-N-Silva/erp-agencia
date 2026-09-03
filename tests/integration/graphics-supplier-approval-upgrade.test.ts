import { readFile } from "node:fs/promises";

import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabase, type Database } from "@/lib/db";

const adminUrl = process.env.DATABASE_TEST_ADMIN_URL;
if (!adminUrl) throw new Error("GRF-004 upgrade tests require an admin database URL.");

const schemaName = "grf_004_upgrade_0024";
const ids = {
  orgA: "73500000-0000-4000-8000-000000000001",
  orgB: "73500000-0000-4000-8000-000000000002",
  areaA: "73500000-0000-4000-8000-000000000003",
  positionA: "73500000-0000-4000-8000-000000000004",
  employeeA: "73500000-0000-4000-8000-000000000005",
  clientA: "73500000-0000-4000-8000-000000000006",
  supplierA: "73500000-0000-4000-8000-000000000007",
  jobA: "73500000-0000-4000-8000-000000000008",
  quoteA: "73500000-0000-4000-8000-000000000009",
} as const;
const userA = "grf-004-reviewer-a";
const userB = "grf-004-reviewer-b";
let adminDb: Database;

beforeAll(() => {
  adminDb = createDatabase(adminUrl, { allowExitOnIdle: true, max: 1 });
});

afterAll(async () => {
  await dropUpgradeSchema();
  await adminDb?.$client.end();
});

describe("Graphics supplier approval migration upgrade 0024 -> 0025", () => {
  it("preserves pending quotes, grants the permission, and enforces reviewer tenant scope", async () => {
    await dropUpgradeSchema();
    try {
      await adminDb.transaction(async (transaction) => {
        await transaction.execute(sql.raw(`create schema ${schemaName}`));
        await transaction.execute(sql.raw(`set local search_path to ${schemaName}, public`));
        for (let index = 0; index <= 24; index += 1) {
          await applyMigration(transaction, index);
        }
        await createPreMigrationFixtures(transaction);
        await applyMigration(transaction, 25);

        const result = await transaction.execute(sql.raw(`
          select
            (select count(*)::int from graphic_supplier_quotes where id = '${ids.quoteA}' and status = 'pending') as quotes,
            (select count(*)::int from permissions where key = 'graphics.supplier_quote_approve') as permissions,
            (select count(*)::int from work_items
              where kind = 'graphic_supplier_quote_approval'
                and source_id = '${ids.quoteA}') as "workItems",
            (select count(*)::int from audit_logs
              where entity_type = 'work_item'
                and metadata ->> 'backfill' = 'GRF-004') as audits,
            (select count(*)::int from role_permissions grant_row
              join roles role on role.id = grant_row.role_id
              join permissions permission on permission.id = grant_row.permission_id
              where role.key in ('technical_admin', 'director')
                and permission.key = 'graphics.supplier_quote_approve') as grants
        `));
        expect(result.rows).toEqual([{
          audits: 1,
          grants: 2,
          permissions: 1,
          quotes: 1,
          workItems: 1,
        }]);

        await expect(transaction.transaction(async (savepoint) => {
          await savepoint.execute(sql.raw(`
            update graphic_supplier_quotes set reviewer_user_id = '${userB}'
            where id = '${ids.quoteA}'
          `));
        })).rejects.toThrow();

        await transaction.execute(sql.raw(`
          update graphic_supplier_quotes set reviewer_user_id = '${userA}'
          where id = '${ids.quoteA}'
        `));
        const reviewer = await transaction.execute(sql.raw(`
          select reviewer_user_id as reviewer from graphic_supplier_quotes where id = '${ids.quoteA}'
        `));
        expect(reviewer.rows).toEqual([{ reviewer: userA }]);
      });
    } finally {
      await dropUpgradeSchema();
    }
  }, 30_000);
});

async function createPreMigrationFixtures(database: Pick<Database, "execute">) {
  await database.execute(sql.raw(`insert into organizations (id, name, slug) values
    ('${ids.orgA}', 'GRF-004 A', 'grf-004-a'), ('${ids.orgB}', 'GRF-004 B', 'grf-004-b')`));
  await database.execute(sql.raw(`insert into "user" (id, organization_id, name, email) values
    ('${userA}', '${ids.orgA}', 'Reviewer A', 'grf-004-a@example.test'),
    ('${userB}', '${ids.orgB}', 'Reviewer B', 'grf-004-b@example.test')`));
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
    '${ids.employeeA}', '${ids.orgA}', 'GRF-004', 'Operator', '${ids.positionA}',
    '${ids.areaA}', 'clt', '2026-01-01', 1000
  )`));
  await database.execute(sql.raw(`insert into clients (id, organization_id, name, code) values
    ('${ids.clientA}', '${ids.orgA}', 'Client A', 'GRF-004')`));
  await database.execute(sql.raw(`insert into suppliers (id, organization_id, name) values
    ('${ids.supplierA}', '${ids.orgA}', 'Supplier A')`));
  await database.execute(sql.raw(`insert into graphic_jobs (
    id, organization_id, internal_code, client_id, title, description, responsible_employee_id,
    operational_status
  ) values (
    '${ids.jobA}', '${ids.orgA}', 'GRF-004', '${ids.clientA}', 'Banner', 'Description',
    '${ids.employeeA}', 'supplier_approval_pending'
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
