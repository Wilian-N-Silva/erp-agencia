import { readFile } from "node:fs/promises";

import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabase, type Database } from "@/lib/db";

const adminUrl = process.env.DATABASE_TEST_ADMIN_URL;
if (!adminUrl) {
  throw new Error("FIN-003 upgrade tests require an admin database URL.");
}

const schemaName = "fin_003_upgrade_0019";
const orgId = "73100000-0000-4000-8000-000000000001";
const accountId = "73100000-0000-4000-8000-000000000011";
const entryId = "73100000-0000-4000-8000-000000000021";
let adminDb: Database;

beforeAll(() => {
  adminDb = createDatabase(adminUrl, { allowExitOnIdle: true, max: 1 });
});

afterAll(async () => {
  await dropUpgradeSchema();
  await adminDb?.$client.end();
});

describe("FIN-003 real migration upgrade 0019 -> 0020", () => {
  it("preserves existing finance data and expands with an empty RLS-protected transaction table", async () => {
    await dropUpgradeSchema();

    try {
      await adminDb.transaction(async (transaction) => {
        await transaction.execute(sql.raw(`create schema ${schemaName}`));
        await transaction.execute(sql.raw(`set local search_path to ${schemaName}, public`));
        await applyMigrationsThrough(transaction, 19);

        await transaction.execute(sql.raw(`
          insert into organizations (id, name, slug)
          values ('${orgId}', 'FIN-003 Upgrade', 'fin-003-upgrade')
        `));
        await transaction.execute(sql.raw(`
          insert into "user" (id, organization_id, name, email)
          values ('fin-003-upgrade-user', '${orgId}', 'Upgrade User', 'fin-003-upgrade@example.test')
        `));
        await transaction.execute(sql.raw(`
          insert into financial_accounts (id, organization_id, name, type)
          values ('${accountId}', '${orgId}', 'Existing account', 'bank')
        `));
        await transaction.execute(sql.raw(`
          insert into financial_entries (
            id, organization_id, description, amount, due_date, competence,
            responsible_user_id
          ) values (
            '${entryId}', '${orgId}', 'Existing receivable', 100.00,
            '2026-09-10', '2026-09', 'fin-003-upgrade-user'
          )
        `));

        const before = await existingFinanceSnapshot(transaction);
        await expect(applyMigration(transaction, 20)).resolves.toBeUndefined();
        expect(await existingFinanceSnapshot(transaction)).toEqual(before);

        const tableState = await transaction.execute(sql.raw(`
          select
            (select count(*)::int from financial_transactions) as transactions,
            c.relrowsecurity as "rlsEnabled",
            c.relforcerowsecurity as "rlsForced"
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = '${schemaName}' and c.relname = 'financial_transactions'
        `));
        expect(tableState.rows).toEqual([{
          rlsEnabled: true,
          rlsForced: true,
          transactions: 0,
        }]);

        const policies = await transaction.execute(sql.raw(`
          select policyname, cmd, qual is not null as "hasUsing",
            with_check is not null as "hasWithCheck"
          from pg_policies
          where schemaname = '${schemaName}' and tablename = 'financial_transactions'
        `));
        expect(policies.rows).toEqual([{
          cmd: "ALL",
          hasUsing: true,
          hasWithCheck: true,
          policyname: "financial_transactions_tenant_isolation",
        }]);
      });
    } finally {
      await dropUpgradeSchema();
    }
  }, 30_000);
});

async function existingFinanceSnapshot(database: Pick<Database, "execute">) {
  const result = await database.execute(sql.raw(`
    select
      (select count(*)::int from financial_accounts where id = '${accountId}') as accounts,
      (select count(*)::int from financial_entries where id = '${entryId}') as entries,
      (select amount::text from financial_entries where id = '${entryId}') as amount
  `));
  return result.rows;
}

async function applyMigrationsThrough(
  database: Pick<Database, "execute">,
  lastMigrationIndex: number,
) {
  for (let migrationIndex = 0; migrationIndex <= lastMigrationIndex; migrationIndex += 1) {
    await applyMigration(database, migrationIndex);
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
