import { readFile } from "node:fs/promises";

import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabase, type Database } from "@/lib/db";

const adminUrl = process.env.DATABASE_TEST_ADMIN_URL;
if (!adminUrl) {
  throw new Error("GRF-001 upgrade tests require an admin database URL.");
}

const schemaName = "grf_001_upgrade_0017";
const orgId = "73100000-0000-4000-8000-000000000001";
const areaId = "73100000-0000-4000-8000-000000000002";
const positionId = "73100000-0000-4000-8000-000000000003";
const employeeId = "73100000-0000-4000-8000-000000000004";
const clientId = "73100000-0000-4000-8000-000000000005";
let adminDb: Database;

beforeAll(() => {
  adminDb = createDatabase(adminUrl, { allowExitOnIdle: true, max: 1 });
});

afterAll(async () => {
  await dropUpgradeSchema();
  await adminDb?.$client.end();
});

describe("GRF-001 real migration upgrade 0017 -> 0018", () => {
  it("preserves existing tenant data and installs protected empty graphics tables", async () => {
    await dropUpgradeSchema();

    try {
      await adminDb.transaction(async (transaction) => {
        await transaction.execute(sql.raw(`create schema ${schemaName}`));
        await transaction.execute(sql.raw(`set local search_path to ${schemaName}, public`));
        await applyMigrationsThrough(transaction, 17);

        await transaction.execute(sql.raw(`
          insert into organizations (id, name, slug)
          values ('${orgId}', 'GRF-001 Upgrade', 'grf-001-upgrade')
        `));
        await transaction.execute(sql.raw(`
          insert into areas (id, organization_id, name)
          values ('${areaId}', '${orgId}', 'Graphics')
        `));
        await transaction.execute(sql.raw(`
          insert into positions (id, organization_id, name)
          values ('${positionId}', '${orgId}', 'Operator')
        `));
        await transaction.execute(sql.raw(`
          insert into employees (
            id, organization_id, registration_number, full_name, position_id,
            area_id, employment_type, start_date, current_compensation
          ) values (
            '${employeeId}', '${orgId}', 'UPGRADE-EMP', 'Existing Employee',
            '${positionId}', '${areaId}', 'clt', '2026-01-01', 1000
          )
        `));
        await transaction.execute(sql.raw(`
          insert into clients (id, organization_id, name, code)
          values ('${clientId}', '${orgId}', 'Existing Client', 'UPGRADE-CLIENT')
        `));

        await applyMigration(transaction, 18);

        const result = await transaction.execute(sql.raw(`
          select
            (select count(*)::int from clients where id = '${clientId}') as clients,
            (select count(*)::int from employees where id = '${employeeId}') as employees,
            (select count(*)::int from graphic_jobs) as jobs,
            (select count(*)::int from graphic_projects) as projects,
            (select count(*)::int from pg_policies
              where schemaname = '${schemaName}'
                and tablename in ('graphic_jobs', 'graphic_projects')
                and cmd = 'ALL'
                and qual like '%app.organization_id%'
                and with_check like '%app.organization_id%') as policies,
            (select count(*)::int from pg_class c
              join pg_namespace n on n.oid = c.relnamespace
              where n.nspname = '${schemaName}'
                and c.relname in ('graphic_jobs', 'graphic_projects')
                and c.relrowsecurity and c.relforcerowsecurity) as "protectedTables"
        `));

        expect(result.rows).toEqual([{
          clients: 1,
          employees: 1,
          jobs: 0,
          policies: 2,
          projects: 0,
          protectedTables: 2,
        }]);
      });
    } finally {
      await dropUpgradeSchema();
    }
  }, 30_000);
});

async function applyMigrationsThrough(
  database: Pick<Database, "execute">,
  lastMigrationIndex: number,
) {
  for (let index = 0; index <= lastMigrationIndex; index += 1) {
    await applyMigration(database, index);
  }
}

async function applyMigration(
  database: Pick<Database, "execute">,
  migrationIndex: number,
) {
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
  if (!adminDb) return;
  await adminDb.execute(sql.raw(`drop schema if exists ${schemaName} cascade`));
}
