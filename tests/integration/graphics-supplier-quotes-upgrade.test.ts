import { readFile } from "node:fs/promises";

import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabase, type Database } from "@/lib/db";

const adminUrl = process.env.DATABASE_TEST_ADMIN_URL;
if (!adminUrl) throw new Error("GRF-003 upgrade tests require an admin database URL.");

const schemaName = "grf_003_upgrade_0023";
const orgId = "73400000-0000-4000-8000-000000000001";
let adminDb: Database;

beforeAll(() => { adminDb = createDatabase(adminUrl, { allowExitOnIdle: true, max: 1 }); });
afterAll(async () => { await dropUpgradeSchema(); await adminDb?.$client.end(); });

describe("Graphics supplier quote migration upgrade 0023 -> 0024", () => {
  it("preserves data and installs tables, tenant policies, and RBAC grants", async () => {
    await dropUpgradeSchema();
    try {
      await adminDb.transaction(async (transaction) => {
        await transaction.execute(sql.raw(`create schema ${schemaName}`));
        await transaction.execute(sql.raw(`set local search_path to ${schemaName}, public`));
        for (let index = 0; index <= 23; index += 1) await applyMigration(transaction, index);
        await transaction.execute(sql.raw(`insert into organizations (id, name, slug) values ('${orgId}', 'GRF-003 Upgrade', 'grf-003-upgrade')`));
        await transaction.execute(sql.raw(`insert into roles (key, name) values ('technical_admin', 'Technical admin'), ('director', 'Director') on conflict (key) do nothing`));
        await applyMigration(transaction, 24);

        const result = await transaction.execute(sql.raw(`
          select
            (select count(*)::int from organizations where id = '${orgId}') as organizations,
            (select count(*)::int from information_schema.tables where table_schema = '${schemaName}' and table_name in ('graphic_supplier_quotes', 'graphic_supplier_quote_attachments')) as tables,
            (select count(*)::int from pg_policies where schemaname = '${schemaName}' and tablename in ('graphic_supplier_quotes', 'graphic_supplier_quote_attachments') and cmd = 'ALL' and qual like '%app.organization_id%' and with_check like '%app.organization_id%') as policies,
            (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = '${schemaName}' and c.relname in ('graphic_supplier_quotes', 'graphic_supplier_quote_attachments') and c.relrowsecurity and c.relforcerowsecurity) as "protectedTables",
            (select count(*)::int from permissions where key = 'graphics.supplier_quote_write') as permissions,
            (select count(*)::int from role_permissions grant_row join roles role on role.id = grant_row.role_id join permissions permission on permission.id = grant_row.permission_id where role.key in ('technical_admin', 'director') and permission.key = 'graphics.supplier_quote_write') as grants
        `));
        expect(result.rows).toEqual([{ grants: 2, organizations: 1, permissions: 1, policies: 2, protectedTables: 2, tables: 2 }]);
      });
    } finally {
      await dropUpgradeSchema();
    }
  }, 30_000);
});

async function applyMigration(database: Pick<Database, "execute">, migrationIndex: number) {
  const journal = JSON.parse(await readFile(new URL("../../drizzle/meta/_journal.json", import.meta.url), "utf8")) as { entries: Array<{ idx: number; tag: string }> };
  const entry = journal.entries.find(({ idx }) => idx === migrationIndex);
  if (!entry) throw new Error(`Migration ${migrationIndex} is missing from the journal.`);
  const migration = (await readFile(new URL(`../../drizzle/${entry.tag}.sql`, import.meta.url), "utf8")).replaceAll('"public".', `"${schemaName}".`);
  for (const statement of migration.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) {
    await database.execute(sql.raw(statement));
  }
}

async function dropUpgradeSchema() {
  if (adminDb) await adminDb.execute(sql.raw(`drop schema if exists ${schemaName} cascade`));
}
