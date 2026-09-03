import { readFile } from "node:fs/promises";

import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabase, type Database } from "@/lib/db";

const adminUrl = process.env.DATABASE_TEST_ADMIN_URL;
if (!adminUrl) {
  throw new Error("FIN-004 upgrade tests require an admin database URL.");
}

const schemaName = "fin_004_upgrade_0020";
const orgId = "74100000-0000-4000-8000-000000000001";
const accountId = "74100000-0000-4000-8000-000000000011";
const transactionId = "74100000-0000-4000-8000-000000000021";
const paidExpenseId = "74100000-0000-4000-8000-000000000031";
const openExpenseId = "74100000-0000-4000-8000-000000000032";
let adminDb: Database;

beforeAll(() => {
  adminDb = createDatabase(adminUrl, { allowExitOnIdle: true, max: 1 });
});

afterAll(async () => {
  await dropUpgradeSchema();
  await adminDb?.$client.end();
});

describe("FIN-004 real migration upgrade 0020 -> 0022", () => {
  it("preserves data, enables allocation RLS, and guards allocated title mutations", async () => {
    await dropUpgradeSchema();

    try {
      await adminDb.transaction(async (transaction) => {
        await transaction.execute(sql.raw(`create schema ${schemaName}`));
        await transaction.execute(sql.raw(`set local search_path to ${schemaName}, public`));
        await applyMigrationsThrough(transaction, 20);
        await transaction.execute(sql.raw(`
          insert into organizations (id, name, slug)
          values ('${orgId}', 'FIN-004 Upgrade', 'fin-004-upgrade')
        `));
        await transaction.execute(sql.raw(`
          insert into "user" (id, organization_id, name, email)
          values ('fin-004-upgrade-user', '${orgId}', 'Upgrade User', 'fin-004-upgrade@example.test')
        `));
        await transaction.execute(sql.raw(`
          insert into financial_accounts (id, organization_id, name, type)
          values ('${accountId}', '${orgId}', 'Existing account', 'bank')
        `));
        await transaction.execute(sql.raw(`
          insert into financial_transactions (
            id, organization_id, account_id, direction, amount, occurred_at,
            created_by_user_id
          ) values (
            '${transactionId}', '${orgId}', '${accountId}', 'out', 100,
            '2026-09-01T12:00:00Z', 'fin-004-upgrade-user'
          )
        `));
        await transaction.execute(sql.raw(`
          insert into financial_expenses (
            id, organization_id, supplier, category, description, amount,
            due_date, paid_date, competence, status, responsible_user_id
          ) values
            ('${paidExpenseId}', '${orgId}', 'Supplier', 'Category', 'Paid', 100,
             '2026-08-01', '2026-08-01', '2026-08', 'paid', 'fin-004-upgrade-user'),
            ('${openExpenseId}', '${orgId}', 'Supplier', 'Category', 'Open', 50,
             '2026-09-10', null, '2026-09', 'planned', 'fin-004-upgrade-user')
        `));

        const before = await existingSnapshot(transaction);
        await expect(applyMigration(transaction, 21)).resolves.toBeUndefined();
        expect(await existingSnapshot(transaction)).toEqual(before);

        const expenses = await transaction.execute(sql.raw(`
          select id, paid_amount::text as "paidAmount"
          from financial_expenses
          where id in ('${paidExpenseId}', '${openExpenseId}')
          order by id
        `));
        expect(expenses.rows).toEqual([
          { id: paidExpenseId, paidAmount: "100.00" },
          { id: openExpenseId, paidAmount: "0.00" },
        ]);

        const tableState = await transaction.execute(sql.raw(`
          select
            (select count(*)::int from financial_allocations) as allocations,
            c.relrowsecurity as "rlsEnabled",
            c.relforcerowsecurity as "rlsForced"
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = '${schemaName}' and c.relname = 'financial_allocations'
        `));
        expect(tableState.rows).toEqual([{
          allocations: 0,
          rlsEnabled: true,
          rlsForced: true,
        }]);

        const policies = await transaction.execute(sql.raw(`
          select policyname, cmd, qual is not null as "hasUsing",
            with_check is not null as "hasWithCheck"
          from pg_policies
          where schemaname = '${schemaName}' and tablename = 'financial_allocations'
        `));
        expect(policies.rows).toEqual([{
          cmd: "ALL",
          hasUsing: true,
          hasWithCheck: true,
          policyname: "financial_allocations_tenant_isolation",
        }]);

        await expect(applyMigration(transaction, 22)).resolves.toBeUndefined();
        const titleGuards = await transaction.execute(sql.raw(`
          select tgname
          from pg_trigger t
          join pg_class c on c.oid = t.tgrelid
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = '${schemaName}'
            and tgname in (
              'financial_entries_allocated_title_guard',
              'financial_expenses_allocated_title_guard'
            )
          order by tgname
        `));
        expect(titleGuards.rows).toEqual([
          { tgname: "financial_entries_allocated_title_guard" },
          { tgname: "financial_expenses_allocated_title_guard" },
        ]);
      });
    } finally {
      await dropUpgradeSchema();
    }
  }, 30_000);
});

async function existingSnapshot(database: Pick<Database, "execute">) {
  const result = await database.execute(sql.raw(`
    select
      (select count(*)::int from financial_transactions where id = '${transactionId}') as transactions,
      (select count(*)::int from financial_expenses where id in ('${paidExpenseId}', '${openExpenseId}')) as expenses,
      (select coalesce(sum(amount), 0)::text from financial_expenses
        where id in ('${paidExpenseId}', '${openExpenseId}')) as total
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
