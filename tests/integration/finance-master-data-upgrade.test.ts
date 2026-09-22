import { readFile } from "node:fs/promises";

import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabase, type Database } from "@/lib/db";

const adminUrl = process.env.DATABASE_TEST_ADMIN_URL;
if (!adminUrl) {
  throw new Error("FIN-002 upgrade tests require an admin database URL.");
}

const schemaName = "fin_002_upgrade_0016";
const id = (suffix: number) =>
  `72100000-0000-4000-8000-${suffix.toString().padStart(12, "0")}`;

const orgA = id(1);
const orgB = id(2);
const expenseIds = [id(101), id(102), id(103), id(201)];

let adminDb: Database;

beforeAll(async () => {
  adminDb = createDatabase(adminUrl, { allowExitOnIdle: true, max: 1 });
});

afterAll(async () => {
  await dropUpgradeSchema();
  await adminDb?.$client.end();
});

describe("FIN-002 real migration upgrade 0016 -> 0017", () => {
  it("preserves legacy expenses, leaves ambiguous links null, and audits manual review", async () => {
    await dropUpgradeSchema();

    try {
      await adminDb.transaction(async (transaction) => {
        await transaction.execute(sql.raw(`create schema ${schemaName}`));
        await transaction.execute(
          sql.raw(`set local search_path to ${schemaName}, public`),
        );

        await applyMigrationsThrough(transaction, 16);

        const baseline = await transaction.execute(sql.raw(`
          select
            to_regclass('${schemaName}.suppliers') as suppliers,
            exists (
              select 1
              from information_schema.columns
              where table_schema = '${schemaName}'
                and table_name = 'financial_expenses'
                and column_name = 'supplier_id'
            ) as "hasSupplierId"
        `));
        expect(baseline.rows).toEqual([{
          hasSupplierId: false,
          suppliers: null,
        }]);

        await transaction.execute(sql.raw(`
          insert into organizations (id, name, slug) values
            ('${orgA}', 'FIN-002 Upgrade A', 'fin-002-upgrade-a'),
            ('${orgB}', 'FIN-002 Upgrade B', 'fin-002-upgrade-b')
        `));
        await transaction.execute(sql.raw(`
          insert into "user" (id, organization_id, name, email) values
            ('fin-002-upgrade-user-a', '${orgA}', 'Upgrade A', 'upgrade-a@example.test'),
            ('fin-002-upgrade-user-b', '${orgB}', 'Upgrade B', 'upgrade-b@example.test')
        `));
        await transaction.execute(sql.raw(`
          insert into financial_expenses (
            id, organization_id, supplier, category, subcategory, description,
            amount, due_date, paid_date, competence, status, cost_center,
            recurring, notes, responsible_user_id, deleted_at, created_at, updated_at
          ) values
            (
              '${expenseIds[0]}', '${orgA}', 'Fornecedor Repetido', 'Operacional',
              'Impressao', 'Primeira despesa original', 101.25, '2026-08-10', null,
              '2026-08', 'planned', 'Centro Norte', false, 'snapshot A1',
              'fin-002-upgrade-user-a', null, '2026-08-01T10:00:00Z', '2026-08-02T10:00:00Z'
            ),
            (
              '${expenseIds[1]}', '${orgA}', 'Fornecedor Repetido', 'Operacional',
              null, 'Segunda despesa original', 202.50, '2026-08-11', '2026-08-12',
              '2026-08', 'paid', 'Centro Norte', true, 'snapshot A2',
              'fin-002-upgrade-user-a', null, '2026-08-03T10:00:00Z', '2026-08-04T10:00:00Z'
            ),
            (
              '${expenseIds[2]}', '${orgA}', '   ', 'Categoria sem cadastro',
              null, 'Despesa com fornecedor em branco', 303.75, '2026-08-13', null,
              '2026-08', 'planned', null, false, null,
              'fin-002-upgrade-user-a', '2026-08-14T10:00:00Z',
              '2026-08-05T10:00:00Z', '2026-08-06T10:00:00Z'
            ),
            (
              '${expenseIds[3]}', '${orgB}', 'Fornecedor Repetido', 'Operacional',
              'Outra org', 'Despesa original da organizacao B', 404.00, '2026-08-14', null,
              '2026-08', 'overdue', '', false, 'snapshot B1',
              'fin-002-upgrade-user-b', null, '2026-08-07T10:00:00Z', '2026-08-08T10:00:00Z'
            )
        `));
        await transaction.execute(sql.raw(`
          insert into audit_logs (organization_id, action, entity_type, entity_id, metadata)
          values ('${orgA}', 'legacy_action', 'legacy_entity', 'legacy-audit', '{"preserved":true}')
        `));

        const snapshotsBefore = await getLegacySnapshots(transaction);

        await expect(applyMigration(transaction, 17)).resolves.toBeUndefined();

        const upgradedExpenses = await transaction.execute(sql.raw(`
          select
            id,
            supplier_id as "supplierId",
            category_id as "categoryId",
            cost_center_id as "costCenterId"
          from financial_expenses
          order by id
        `));
        expect(upgradedExpenses.rows).toEqual(
          [...expenseIds].sort().map((expenseId) => ({
            categoryId: null,
            costCenterId: null,
            id: expenseId,
            supplierId: null,
          })),
        );

        expect(await getLegacySnapshots(transaction)).toEqual(snapshotsBefore);

        const masterDataCounts = await transaction.execute(sql.raw(`
          select
            (select count(*)::int from suppliers) as suppliers,
            (select count(*)::int from financial_categories) as categories,
            (select count(*)::int from cost_centers) as "costCenters"
        `));
        expect(masterDataCounts.rows).toEqual([{
          categories: 0,
          costCenters: 0,
          suppliers: 0,
        }]);

        const reviewAudits = await transaction.execute(sql.raw(`
          select organization_id as "organizationId", metadata
          from audit_logs
          where action = 'backfill'
            and entity_type = 'finance_master_data'
            and metadata ->> 'task' = 'FIN-002'
          order by organization_id
        `));
        expect(reviewAudits.rows).toEqual([
          {
            metadata: {
              categoryLinks: 0,
              costCenterLinks: 0,
              expenses: 3,
              strategy: "manual_review_required",
              supplierLinks: 0,
              task: "FIN-002",
              unresolvedCategories: 3,
              unresolvedCostCenters: 2,
              unresolvedSuppliers: 2,
            },
            organizationId: orgA,
          },
          {
            metadata: {
              categoryLinks: 0,
              costCenterLinks: 0,
              expenses: 1,
              strategy: "manual_review_required",
              supplierLinks: 0,
              task: "FIN-002",
              unresolvedCategories: 1,
              unresolvedCostCenters: 0,
              unresolvedSuppliers: 1,
            },
            organizationId: orgB,
          },
        ]);

        const preservedCounts = await transaction.execute(sql.raw(`
          select
            (select count(*)::int from financial_expenses) as expenses,
            (select count(*)::int from audit_logs where entity_id = 'legacy-audit') as "legacyAudits"
        `));
        expect(preservedCounts.rows).toEqual([{
          expenses: expenseIds.length,
          legacyAudits: 1,
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
    await readFile(
      new URL(`../../drizzle/${entry.tag}.sql`, import.meta.url),
      "utf8",
    )
  ).replaceAll('"public".', `"${schemaName}".`);

  for (const statement of migration
    .split("--> statement-breakpoint")
    .map((value) => value.trim())
    .filter(Boolean)) {
    await database.execute(sql.raw(statement));
  }
}

async function getLegacySnapshots(database: Pick<Database, "execute">) {
  const result = await database.execute(sql.raw(`
    select
      id,
      organization_id as "organizationId",
      supplier,
      category,
      subcategory,
      description,
      amount::text,
      due_date::text as "dueDate",
      paid_date::text as "paidDate",
      competence,
      status::text,
      cost_center as "costCenter",
      recurring,
      notes,
      responsible_user_id as "responsibleUserId",
      deleted_at::text as "deletedAt",
      created_at::text as "createdAt",
      updated_at::text as "updatedAt"
    from financial_expenses
    order by id
  `));
  return result.rows;
}

async function dropUpgradeSchema() {
  if (!adminDb) return;
  await adminDb.execute(sql.raw(`drop schema if exists ${schemaName} cascade`));
}
