import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createDatabase,
  createWithTenantDb,
  type Database,
  type TenantTransaction,
} from "@/lib/db";
import type { AccessContext } from "@/lib/dal";

const runtimeUrl = process.env.DATABASE_TEST_URL;
const adminUrl = process.env.DATABASE_TEST_ADMIN_URL;

if (!runtimeUrl || !adminUrl) {
  throw new Error(
    "DATABASE_TEST_URL and DATABASE_TEST_ADMIN_URL are required for the transaction contract suite.",
  );
}
if (runtimeUrl === adminUrl) {
  throw new Error(
    "Transaction contract tests require separate runtime and administrative roles.",
  );
}

const organizationId = "50000000-0000-4000-8000-000000000001";
const userId = "core-001-user";
const committedSettingIds = [
  "50000000-0000-4000-8000-000000000011",
  "50000000-0000-4000-8000-000000000012",
] as const;
const rolledBackSettingIds = [
  "50000000-0000-4000-8000-000000000021",
  "50000000-0000-4000-8000-000000000022",
] as const;
const allSettingIds = [...committedSettingIds, ...rolledBackSettingIds];
const context: AccessContext = {
  userId,
  organizationId,
  employeeId: null,
  roles: [],
  permissions: [],
};

let runtimeDb: Database;
let adminDb: Database;

beforeAll(async () => {
  runtimeDb = createDatabase(runtimeUrl, { allowExitOnIdle: true, max: 2 });
  adminDb = createDatabase(adminUrl, { allowExitOnIdle: true, max: 1 });
  await removeFixtures();
  await adminDb.execute(sql`
    insert into organizations (id, name, slug)
    values (${organizationId}, 'CORE-001 Organization', 'core-001-organization')
  `);
});

afterAll(async () => {
  if (adminDb) await removeFixtures();
  await Promise.all([runtimeDb?.$client.end(), adminDb?.$client.end()]);
});

describe("shared tenant transaction contract", () => {
  it("commits all writes and keeps the tenant identity active throughout", async () => {
    const withTenantDb = createWithTenantDb(runtimeDb);

    await withTenantDb(context, async (transaction) => {
      await expectTenantIdentity(transaction);
      await insertSetting(transaction, committedSettingIds[0], "first-commit");
      await expectTenantIdentity(transaction);
      await insertSetting(transaction, committedSettingIds[1], "second-commit");
      await expectTenantIdentity(transaction);
    });

    await expectStoredIds(committedSettingIds);
  });

  it("rolls back every write when a later step fails", async () => {
    const withTenantDb = createWithTenantDb(runtimeDb);
    const operationError = new Error("force multi-write rollback");

    await expect(
      withTenantDb(context, async (transaction) => {
        await expectTenantIdentity(transaction);
        await insertSetting(
          transaction,
          rolledBackSettingIds[0],
          "first-rollback",
        );
        await expectTenantIdentity(transaction);
        await insertSetting(
          transaction,
          rolledBackSettingIds[1],
          "second-rollback",
        );
        await expectTenantIdentity(transaction);

        throw operationError;
      }),
    ).rejects.toBe(operationError);

    await expectStoredIds(committedSettingIds);
  });
});

async function insertSetting(
  transaction: TenantTransaction,
  id: string,
  key: string,
) {
  await transaction.execute(sql`
    insert into app_settings (id, organization_id, key, value)
    values (${id}, ${organizationId}, ${key}, ${JSON.stringify({ enabled: true })}::jsonb)
  `);
}

async function expectTenantIdentity(transaction: TenantTransaction) {
  const result = await transaction.execute(sql<{
    organizationId: string | null;
    userId: string | null;
  }>`
    select
      current_setting('app.organization_id', true) as "organizationId",
      current_setting('app.user_id', true) as "userId"
  `);

  expect(result.rows[0]).toEqual({ organizationId, userId });
}

async function expectStoredIds(expectedIds: readonly string[]) {
  const result = await adminDb.execute(sql<{ id: string }>`
    select id
    from app_settings
    where id in (
      ${allSettingIds[0]},
      ${allSettingIds[1]},
      ${allSettingIds[2]},
      ${allSettingIds[3]}
    )
    order by id
  `);

  expect(result.rows.map(({ id }) => id)).toEqual([...expectedIds].sort());
}

async function removeFixtures() {
  await adminDb?.execute(sql`
    delete from app_settings
    where id in (
      ${allSettingIds[0]},
      ${allSettingIds[1]},
      ${allSettingIds[2]},
      ${allSettingIds[3]}
    )
  `);
  await adminDb?.execute(sql`
    delete from organizations where id = ${organizationId}
  `);
}
