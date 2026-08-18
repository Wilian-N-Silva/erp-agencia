import { sql, type SQL } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabase, createWithTenantDb, type Database } from "@/lib/db";
import { tenantPolicyTables } from "@/lib/db/rls-policy-matrix";
import type { AccessContext } from "@/lib/dal";

const runtimeUrl = process.env.DATABASE_TEST_URL;
const adminUrl = process.env.DATABASE_TEST_ADMIN_URL;

if (!runtimeUrl || !adminUrl) {
  throw new Error(
    "DATABASE_TEST_URL and DATABASE_TEST_ADMIN_URL are required for the RLS security suite.",
  );
}
if (runtimeUrl === adminUrl) {
  throw new Error(
    "RLS tests require separate runtime and administrative roles.",
  );
}

const fixtureId = (suffix: number) =>
  `40000000-0000-4000-8000-${suffix.toString().padStart(12, "0")}`;
const ids = {
  orgA: fixtureId(1),
  orgB: fixtureId(2),
  areaA: fixtureId(11),
  areaB: fixtureId(12),
  positionA: fixtureId(21),
  positionB: fixtureId(22),
  employeeA: fixtureId(101),
  employeeB: fixtureId(102),
  employeeAllowed: fixtureId(103),
  employeeCrossInsert: fixtureId(104),
  employeeNoContext: fixtureId(105),
  financialA: fixtureId(201),
  financialB: fixtureId(202),
  financialAllowed: fixtureId(203),
  financialCrossInsert: fixtureId(204),
  financialNoContext: fixtureId(205),
  documentA: fixtureId(301),
  documentB: fixtureId(302),
  documentAllowed: fixtureId(303),
  documentCrossInsert: fixtureId(304),
  documentNoContext: fixtureId(305),
  fileA: fixtureId(401),
  fileB: fixtureId(402),
  fileAllowed: fixtureId(403),
  fileCrossInsert: fixtureId(404),
  fileNoContext: fixtureId(405),
} as const;
const userA = "sec-004-user-a";
const userB = "sec-004-user-b";
const contextA: AccessContext = {
  userId: userA,
  organizationId: ids.orgA,
  employeeId: ids.employeeA,
  roles: [],
  permissions: [],
};

type CriticalSample = {
  tenantAId: string;
  tenantBId: string;
  allowedId: string;
  crossInsertId: string;
  noContextId: string;
  select: (id: string) => SQL;
  insert: (id: string, organizationId: string) => SQL;
  update: (id: string, value: string) => SQL;
  move: (id: string, organizationId: string) => SQL;
  delete: (id: string) => SQL;
};

const peopleSample: CriticalSample = {
  tenantAId: ids.employeeA,
  tenantBId: ids.employeeB,
  allowedId: ids.employeeAllowed,
  crossInsertId: ids.employeeCrossInsert,
  noContextId: ids.employeeNoContext,
  select: (id) => sql`select id from employees where id = ${id}`,
  insert: (id, organizationId) => sql`
    insert into employees (
      id, organization_id, registration_number, full_name, position_id,
      area_id, employment_type, start_date, current_compensation
    ) values (
      ${id}, ${organizationId}, ${id}, ${`SEC-004 Employee ${id}`},
      ${organizationId === ids.orgA ? ids.positionA : ids.positionB},
      ${organizationId === ids.orgA ? ids.areaA : ids.areaB},
      'clt', '2026-01-01', '1000.00'
    ) returning id
  `,
  update: (id, value) =>
    sql`update employees set full_name = ${value} where id = ${id} returning id`,
  move: (id, organizationId) => sql`
    update employees set
      organization_id = ${organizationId},
      position_id = ${organizationId === ids.orgA ? ids.positionA : ids.positionB},
      area_id = ${organizationId === ids.orgA ? ids.areaA : ids.areaB}
    where id = ${id} returning id
  `,
  delete: (id) => sql`delete from employees where id = ${id} returning id`,
};

const financeSample: CriticalSample = {
  tenantAId: ids.financialA,
  tenantBId: ids.financialB,
  allowedId: ids.financialAllowed,
  crossInsertId: ids.financialCrossInsert,
  noContextId: ids.financialNoContext,
  select: (id) => sql`select id from financial_entries where id = ${id}`,
  insert: (id, organizationId) => sql`
    insert into financial_entries (
      id, organization_id, description, amount, due_date, competence,
      responsible_user_id
    ) values (
      ${id}, ${organizationId}, ${`SEC-004 Financial ${id}`}, '100.00',
      '2026-01-31', '2026-01', ${organizationId === ids.orgA ? userA : userB}
    ) returning id
  `,
  update: (id, value) => sql`
    update financial_entries set description = ${value} where id = ${id} returning id
  `,
  move: (id, organizationId) => sql`
    update financial_entries set
      organization_id = ${organizationId},
      responsible_user_id = ${organizationId === ids.orgA ? userA : userB}
    where id = ${id} returning id
  `,
  delete: (id) =>
    sql`delete from financial_entries where id = ${id} returning id`,
};

const documentFiles = new Map([
  [ids.documentA, ids.fileA],
  [ids.documentB, ids.fileB],
  [ids.documentAllowed, ids.fileAllowed],
  [ids.documentCrossInsert, ids.fileCrossInsert],
  [ids.documentNoContext, ids.fileNoContext],
]);

const documentSample: CriticalSample = {
  tenantAId: ids.documentA,
  tenantBId: ids.documentB,
  allowedId: ids.documentAllowed,
  crossInsertId: ids.documentCrossInsert,
  noContextId: ids.documentNoContext,
  select: (id) => sql`select id from documents where id = ${id}`,
  insert: (id, organizationId) => sql`
    insert into documents (
      id, organization_id, owner_type, owner_id, document_type, file_id,
      uploaded_by_user_id
    ) values (
      ${id}, ${organizationId}, 'security_fixture', ${id}, 'rls_test',
      ${requiredDocumentFile(id)}, ${organizationId === ids.orgA ? userA : userB}
    ) returning id
  `,
  update: (id, value) =>
    sql`update documents set status = ${value} where id = ${id} returning id`,
  move: (id, organizationId) => sql`
    update documents set
      organization_id = ${organizationId},
      uploaded_by_user_id = ${organizationId === ids.orgA ? userA : userB}
    where id = ${id} returning id
  `,
  delete: (id) => sql`delete from documents where id = ${id} returning id`,
};

const criticalSamples = [peopleSample, financeSample, documentSample];
let runtimeDb: Database;
let adminDb: Database;

beforeAll(async () => {
  runtimeDb = createDatabase(runtimeUrl, { allowExitOnIdle: true, max: 2 });
  adminDb = createDatabase(adminUrl, { allowExitOnIdle: true, max: 1 });
  await removeFixtures();
  await createFixtures();
});

afterAll(async () => {
  if (adminDb) await removeFixtures();
  await Promise.all([runtimeDb?.$client.end(), adminDb?.$client.end()]);
});

describe("RLS database role boundary", () => {
  it("uses a real NOBYPASSRLS non-owner runtime role and a separate admin role", async () => {
    const [runtimeRole, adminRole] = await Promise.all([
      getCurrentRole(runtimeDb),
      getCurrentRole(adminDb),
    ]);

    expect(runtimeRole).toMatchObject({ superuser: false, bypassRls: false });
    expect(adminRole).toMatchObject({ superuser: false, bypassRls: true });
    expect(runtimeRole.name).not.toBe(adminRole.name);

    const ownership = await getTableOwnership();
    const protectedTables = ownership.filter(({ tableName }) =>
      tenantPolicyTables.includes(
        tableName as (typeof tenantPolicyTables)[number],
      ),
    );

    expect(protectedTables).toHaveLength(tenantPolicyTables.length);
    expect(protectedTables.every(({ owner }) => owner === adminRole.name)).toBe(
      true,
    );
    expect(
      protectedTables.every(({ owner }) => owner !== runtimeRole.name),
    ).toBe(true);
  });

  it("keeps the explicit admin bypass able to inspect both tenants", async () => {
    for (const sample of criticalSamples) {
      await expectRows(adminDb, sample.select(sample.tenantAId), 1);
      await expectRows(adminDb, sample.select(sample.tenantBId), 1);
    }
  });
});

describe("RLS critical cross-tenant matrix", () => {
  it("allows same-tenant select, insert, update, and delete", async () => {
    const withTenantDb = createWithTenantDb(runtimeDb);

    for (const sample of criticalSamples) {
      await withTenantDb(contextA, async (transaction) => {
        await expectRows(transaction, sample.select(sample.tenantAId), 1);
        await expectRows(transaction, sample.select(sample.tenantBId), 0);
        await expectRows(
          transaction,
          sample.insert(sample.allowedId, ids.orgA),
          1,
        );
        await expectRows(
          transaction,
          sample.update(sample.allowedId, "sec-004-updated"),
          1,
        );
        await expectRows(transaction, sample.delete(sample.allowedId), 1);
      });
    }
  });

  it("hides known cross-tenant IDs on select", async () => {
    const withTenantDb = createWithTenantDb(runtimeDb);

    await withTenantDb(contextA, async (transaction) => {
      for (const sample of criticalSamples) {
        await expectRows(transaction, sample.select(sample.tenantAId), 1);
        await expectRows(transaction, sample.select(sample.tenantBId), 0);
      }
    });
  });

  it("rejects cross-tenant inserts and tenant reassignment", async () => {
    const withTenantDb = createWithTenantDb(runtimeDb);

    for (const sample of criticalSamples) {
      await expectRlsViolation(() =>
        withTenantDb(contextA, (tx) =>
          tx.execute(sample.insert(sample.crossInsertId, ids.orgB)),
        ),
      );
      await expectRlsViolation(() =>
        withTenantDb(contextA, (tx) =>
          tx.execute(sample.move(sample.tenantAId, ids.orgB)),
        ),
      );
      await expectRows(adminDb, sample.select(sample.crossInsertId), 0);
      await expectRows(adminDb, sample.select(sample.tenantAId), 1);
    }
  });

  it("blocks update and delete by known cross-tenant ID", async () => {
    const withTenantDb = createWithTenantDb(runtimeDb);

    await withTenantDb(contextA, async (transaction) => {
      for (const sample of criticalSamples) {
        await expectRows(
          transaction,
          sample.update(sample.tenantBId, "tampered"),
          0,
        );
        await expectRows(transaction, sample.delete(sample.tenantBId), 0);
      }
    });

    for (const sample of criticalSamples) {
      await expectRows(adminDb, sample.select(sample.tenantBId), 1);
    }
  });
});

describe("RLS without tenant context", () => {
  it("denies select, insert, update, and delete for every critical sample", async () => {
    for (const sample of criticalSamples) {
      await expectRows(runtimeDb, sample.select(sample.tenantAId), 0);
      await expectRows(runtimeDb, sample.select(sample.tenantBId), 0);
      await expectRlsViolation(() =>
        runtimeDb.execute(sample.insert(sample.noContextId, ids.orgA)),
      );
      await expectRows(
        runtimeDb,
        sample.update(sample.tenantAId, "tampered"),
        0,
      );
      await expectRows(runtimeDb, sample.delete(sample.tenantBId), 0);

      await expectRows(adminDb, sample.select(sample.noContextId), 0);
      await expectRows(adminDb, sample.select(sample.tenantAId), 1);
      await expectRows(adminDb, sample.select(sample.tenantBId), 1);
    }
  });
});

async function createFixtures() {
  await adminDb.transaction(async (tx) => {
    await tx.execute(sql`
      insert into organizations (id, name, slug) values
        (${ids.orgA}, 'SEC-004 Organization A', 'sec-004-organization-a'),
        (${ids.orgB}, 'SEC-004 Organization B', 'sec-004-organization-b')
    `);
    await tx.execute(sql`
      insert into "user" (id, organization_id, name, email, email_verified) values
        (${userA}, ${ids.orgA}, 'SEC-004 User A', 'sec-004-a@example.test', true),
        (${userB}, ${ids.orgB}, 'SEC-004 User B', 'sec-004-b@example.test', true)
    `);
    await tx.execute(sql`
      insert into areas (id, organization_id, name) values
        (${ids.areaA}, ${ids.orgA}, 'SEC-004 Area A'),
        (${ids.areaB}, ${ids.orgB}, 'SEC-004 Area B')
    `);
    await tx.execute(sql`
      insert into positions (id, organization_id, name) values
        (${ids.positionA}, ${ids.orgA}, 'SEC-004 Position A'),
        (${ids.positionB}, ${ids.orgB}, 'SEC-004 Position B')
    `);
    await tx.execute(peopleSample.insert(ids.employeeA, ids.orgA));
    await tx.execute(peopleSample.insert(ids.employeeB, ids.orgB));
    await tx.execute(financeSample.insert(ids.financialA, ids.orgA));
    await tx.execute(financeSample.insert(ids.financialB, ids.orgB));

    for (const [fileId, organizationId, uploader] of [
      [ids.fileA, ids.orgA, userA],
      [ids.fileB, ids.orgB, userB],
      [ids.fileAllowed, ids.orgA, userA],
      [ids.fileCrossInsert, ids.orgB, userB],
      [ids.fileNoContext, ids.orgA, userA],
    ] as const) {
      await tx.execute(sql`
        insert into files (
          id, organization_id, storage_provider, storage_key, original_name,
          mime_type, extension, byte_size, uploaded_by_user_id
        ) values (
          ${fileId}, ${organizationId}, 'test', ${`sec-004/${fileId}`},
          'fixture.pdf', 'application/pdf', 'pdf', 1, ${uploader}
        )
      `);
    }

    await tx.execute(documentSample.insert(ids.documentA, ids.orgA));
    await tx.execute(documentSample.insert(ids.documentB, ids.orgB));
  });
}

async function removeFixtures() {
  await adminDb.transaction(async (tx) => {
    await tx.execute(
      sql`delete from documents where organization_id in (${ids.orgA}, ${ids.orgB})`,
    );
    await tx.execute(
      sql`delete from files where organization_id in (${ids.orgA}, ${ids.orgB})`,
    );
    await tx.execute(
      sql`delete from financial_entries where organization_id in (${ids.orgA}, ${ids.orgB})`,
    );
    await tx.execute(
      sql`delete from employees where organization_id in (${ids.orgA}, ${ids.orgB})`,
    );
    await tx.execute(
      sql`delete from positions where organization_id in (${ids.orgA}, ${ids.orgB})`,
    );
    await tx.execute(
      sql`delete from areas where organization_id in (${ids.orgA}, ${ids.orgB})`,
    );
    await tx.execute(sql`delete from "user" where id in (${userA}, ${userB})`);
    await tx.execute(
      sql`delete from organizations where id in (${ids.orgA}, ${ids.orgB})`,
    );
  });
}

async function getCurrentRole(database: Database) {
  const result = await database.execute(sql<{
    name: string;
    superuser: boolean;
    bypassRls: boolean;
  }>`
    select current_user as name, rolsuper as superuser, rolbypassrls as "bypassRls"
    from pg_roles where rolname = current_user
  `);
  return result.rows[0];
}

async function getTableOwnership() {
  const result = await adminDb.execute(sql<{
    tableName: string;
    owner: string;
  }>`
    select relation.relname as "tableName", pg_get_userbyid(relation.relowner) as owner
    from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public' and relation.relkind in ('r', 'p')
  `);
  return result.rows;
}

async function expectRows(
  database: Pick<Database, "execute">,
  statement: SQL,
  count: number,
) {
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
  expect((databaseError as Error).message).toContain("row-level security");
}

function requiredDocumentFile(documentId: string) {
  const fileId = documentFiles.get(documentId);
  if (!fileId) throw new Error(`Missing file fixture for ${documentId}.`);
  return fileId;
}
