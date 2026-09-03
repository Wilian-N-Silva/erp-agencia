import { sql, type SQL } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabase, createWithTenantDb, type Database } from "@/lib/db";
import type { AccessContext } from "@/lib/dal";

const runtimeUrl = process.env.DATABASE_TEST_URL;
const adminUrl = process.env.DATABASE_TEST_ADMIN_URL;
if (!runtimeUrl || !adminUrl || runtimeUrl === adminUrl) {
  throw new Error("FIN-002 integration tests require distinct runtime and admin database URLs.");
}

const id = (suffix: number) =>
  `72000000-0000-4000-8000-${suffix.toString().padStart(12, "0")}`;
const orgA = id(1);
const orgB = id(2);
const contextA: AccessContext = {
  employeeId: null,
  organizationId: orgA,
  permissions: [],
  roles: [],
  userId: "fin-002-user-a",
};

type MasterDataSample = {
  name: string;
  tenantAId: string;
  tenantBId: string;
  allowedId: string;
  crossInsertId: string;
  noContextId: string;
  select: (rowId: string) => SQL;
  insert: (rowId: string, organizationId: string) => SQL;
  update: (rowId: string, value: string) => SQL;
  move: (rowId: string, organizationId: string) => SQL;
  delete: (rowId: string) => SQL;
};

const samples: MasterDataSample[] = [
  {
    name: "financial_accounts",
    tenantAId: id(101), tenantBId: id(102), allowedId: id(103),
    crossInsertId: id(104), noContextId: id(105),
    select: (rowId) => sql`select id from financial_accounts where id = ${rowId}`,
    insert: (rowId, organizationId) => sql`
      insert into financial_accounts (id, organization_id, name, type)
      values (${rowId}, ${organizationId}, ${`Account ${rowId}`}, 'bank') returning id
    `,
    update: (rowId, value) => sql`update financial_accounts set name = ${value} where id = ${rowId} returning id`,
    move: (rowId, organizationId) => sql`update financial_accounts set organization_id = ${organizationId} where id = ${rowId} returning id`,
    delete: (rowId) => sql`delete from financial_accounts where id = ${rowId} returning id`,
  },
  {
    name: "financial_categories",
    tenantAId: id(201), tenantBId: id(202), allowedId: id(203),
    crossInsertId: id(204), noContextId: id(205),
    select: (rowId) => sql`select id from financial_categories where id = ${rowId}`,
    insert: (rowId, organizationId) => sql`
      insert into financial_categories (id, organization_id, name, nature)
      values (${rowId}, ${organizationId}, ${`Category ${rowId}`}, 'expense') returning id
    `,
    update: (rowId, value) => sql`update financial_categories set name = ${value} where id = ${rowId} returning id`,
    move: (rowId, organizationId) => sql`update financial_categories set organization_id = ${organizationId} where id = ${rowId} returning id`,
    delete: (rowId) => sql`delete from financial_categories where id = ${rowId} returning id`,
  },
  {
    name: "cost_centers",
    tenantAId: id(301), tenantBId: id(302), allowedId: id(303),
    crossInsertId: id(304), noContextId: id(305),
    select: (rowId) => sql`select id from cost_centers where id = ${rowId}`,
    insert: (rowId, organizationId) => sql`
      insert into cost_centers (id, organization_id, name)
      values (${rowId}, ${organizationId}, ${`Cost center ${rowId}`}) returning id
    `,
    update: (rowId, value) => sql`update cost_centers set name = ${value} where id = ${rowId} returning id`,
    move: (rowId, organizationId) => sql`update cost_centers set organization_id = ${organizationId} where id = ${rowId} returning id`,
    delete: (rowId) => sql`delete from cost_centers where id = ${rowId} returning id`,
  },
  {
    name: "suppliers",
    tenantAId: id(401), tenantBId: id(402), allowedId: id(403),
    crossInsertId: id(404), noContextId: id(405),
    select: (rowId) => sql`select id from suppliers where id = ${rowId}`,
    insert: (rowId, organizationId) => sql`
      insert into suppliers (id, organization_id, name)
      values (${rowId}, ${organizationId}, ${`Supplier ${rowId}`}) returning id
    `,
    update: (rowId, value) => sql`update suppliers set name = ${value} where id = ${rowId} returning id`,
    move: (rowId, organizationId) => sql`update suppliers set organization_id = ${organizationId} where id = ${rowId} returning id`,
    delete: (rowId) => sql`delete from suppliers where id = ${rowId} returning id`,
  },
];

let runtimeDb: Database;
let adminDb: Database;

beforeAll(async () => {
  runtimeDb = createDatabase(runtimeUrl, { allowExitOnIdle: true, max: 2 });
  adminDb = createDatabase(adminUrl, { allowExitOnIdle: true, max: 1 });
  await cleanup();
  await adminDb.execute(sql`
    insert into organizations (id, name, slug) values
      (${orgA}, 'FIN-002 A', 'fin-002-a'),
      (${orgB}, 'FIN-002 B', 'fin-002-b')
  `);
  for (const sample of samples) {
    await adminDb.execute(sample.insert(sample.tenantAId, orgA));
    await adminDb.execute(sample.insert(sample.tenantBId, orgB));
  }
});

afterAll(async () => {
  await cleanup();
  await Promise.all([runtimeDb?.$client.end(), adminDb?.$client.end()]);
});

describe("FIN-002 RLS matrix for every master-data table", () => {
  it.each(samples)("$name allows same-tenant SELECT, INSERT, UPDATE, and DELETE", async (sample) => {
    const withTenantDb = createWithTenantDb(runtimeDb);
    await withTenantDb(contextA, async (transaction) => {
      await expectRows(transaction, sample.select(sample.tenantAId), 1);
      await expectRows(transaction, sample.insert(sample.allowedId, orgA), 1);
      await expectRows(transaction, sample.update(sample.allowedId, `Updated ${sample.name}`), 1);
      await expectRows(transaction, sample.delete(sample.allowedId), 1);
    });
  });

  it.each(samples)("$name blocks cross-tenant SELECT, UPDATE, and DELETE", async (sample) => {
    const withTenantDb = createWithTenantDb(runtimeDb);
    await withTenantDb(contextA, async (transaction) => {
      await expectRows(transaction, sample.select(sample.tenantBId), 0);
      await expectRows(transaction, sample.update(sample.tenantBId, "Tampered"), 0);
      await expectRows(transaction, sample.delete(sample.tenantBId), 0);
    });
    await expectRows(adminDb, sample.select(sample.tenantBId), 1);
  });

  it.each(samples)("$name rejects cross-tenant INSERT and tenant reassignment", async (sample) => {
    const withTenantDb = createWithTenantDb(runtimeDb);
    await expectRlsViolation(() =>
      withTenantDb(contextA, (transaction) => transaction.execute(sample.insert(sample.crossInsertId, orgB))),
    );
    await expectRlsViolation(() =>
      withTenantDb(contextA, (transaction) => transaction.execute(sample.move(sample.tenantAId, orgB))),
    );
    await expectRows(adminDb, sample.select(sample.crossInsertId), 0);
    await expectRows(adminDb, sample.select(sample.tenantAId), 1);
  });

  it.each(samples)("$name denies SELECT, INSERT, UPDATE, and DELETE without context", async (sample) => {
    await expectRows(runtimeDb, sample.select(sample.tenantAId), 0);
    await expectRlsViolation(() => runtimeDb.execute(sample.insert(sample.noContextId, orgA)));
    await expectRows(runtimeDb, sample.update(sample.tenantAId, "No context"), 0);
    await expectRows(runtimeDb, sample.delete(sample.tenantAId), 0);
    await expectRows(adminDb, sample.select(sample.noContextId), 0);
    await expectRows(adminDb, sample.select(sample.tenantAId), 1);
  });
});

describe("FIN-002 tenant-safe foreign keys", () => {
  it("rejects cross-tenant master-data links", async () => {
    await adminDb.execute(sql`
      insert into "user" (id, organization_id, name, email)
      values ('fin-002-owner', ${orgA}, 'Owner', 'fin-002-owner@example.test')
    `);
    await expect(adminDb.execute(sql`
      insert into financial_expenses (
        organization_id, supplier_id, supplier, category, description, amount,
        due_date, competence, responsible_user_id
      ) values (
        ${orgA}, ${samples[3].tenantBId}, 'Snapshot B', 'Legacy category',
        'Invalid link', '10.00', '2026-09-10', '2026-09', 'fin-002-owner'
      )
    `)).rejects.toThrow();
  });
});

async function expectRows(database: Pick<Database, "execute">, statement: SQL, count: number) {
  const result = await database.execute(statement);
  expect(result.rows).toHaveLength(count);
}

async function expectRlsViolation(operation: () => Promise<unknown>) {
  let caught: unknown;
  try {
    await operation();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(Error);
  const databaseError = (caught as Error & { cause?: unknown }).cause ?? caught;
  expect(databaseError).toMatchObject({ code: "42501" });
}

async function cleanup() {
  if (!adminDb) return;
  await adminDb.execute(sql`delete from financial_expenses where organization_id in (${orgA}, ${orgB})`);
  await adminDb.execute(sql`delete from financial_accounts where organization_id in (${orgA}, ${orgB})`);
  await adminDb.execute(sql`delete from financial_categories where organization_id in (${orgA}, ${orgB})`);
  await adminDb.execute(sql`delete from cost_centers where organization_id in (${orgA}, ${orgB})`);
  await adminDb.execute(sql`delete from suppliers where organization_id in (${orgA}, ${orgB})`);
  await adminDb.execute(sql`delete from "user" where id = 'fin-002-owner'`);
  await adminDb.execute(sql`delete from organizations where id in (${orgA}, ${orgB})`);
}
