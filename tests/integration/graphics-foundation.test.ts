import { sql, type SQL } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createAuditLogValues } from "@/lib/audit";
import { createDatabase, createWithTenantDb, type Database } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";

const runtimeUrl = process.env.DATABASE_TEST_URL;
const adminUrl = process.env.DATABASE_TEST_ADMIN_URL;
if (!runtimeUrl || !adminUrl || runtimeUrl === adminUrl) {
  throw new Error("GRF-001 tests require distinct runtime and admin database URLs.");
}

const id = (suffix: number) =>
  `73000000-0000-4000-8000-${suffix.toString().padStart(12, "0")}`;

const ids = {
  orgA: id(1),
  orgB: id(2),
  areaA: id(11),
  areaB: id(12),
  positionA: id(21),
  positionB: id(22),
  employeeA: id(31),
  employeeB: id(32),
  clientA: id(41),
  clientB: id(42),
  projectA: id(51),
  projectB: id(52),
  projectAllowed: id(53),
  projectCrossInsert: id(54),
  projectNoContext: id(55),
  jobA: id(61),
  jobB: id(62),
  jobAllowed: id(63),
  jobCrossInsert: id(64),
  jobNoContext: id(65),
} as const;

const userA = "grf-001-user-a";
const userB = "grf-001-user-b";
const contextA: AccessContext = {
  employeeId: ids.employeeA,
  organizationId: ids.orgA,
  permissions: [],
  roles: [],
  userId: userA,
};

type TenantSample = {
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

const projectSample: TenantSample = {
  name: "graphic_projects",
  tenantAId: ids.projectA,
  tenantBId: ids.projectB,
  allowedId: ids.projectAllowed,
  crossInsertId: ids.projectCrossInsert,
  noContextId: ids.projectNoContext,
  select: (rowId) => sql`select id from graphic_projects where id = ${rowId}`,
  insert: (rowId, organizationId) => sql`
    insert into graphic_projects (id, organization_id, code, name, kind)
    values (${rowId}, ${organizationId}, ${`PROJECT-${rowId}`}, ${`Project ${rowId}`}, 'event')
    returning id
  `,
  update: (rowId, value) =>
    sql`update graphic_projects set name = ${value} where id = ${rowId} returning id`,
  move: (rowId, organizationId) =>
    sql`update graphic_projects set organization_id = ${organizationId} where id = ${rowId} returning id`,
  delete: (rowId) =>
    sql`delete from graphic_projects where id = ${rowId} returning id`,
};

const jobSample: TenantSample = {
  name: "graphic_jobs",
  tenantAId: ids.jobA,
  tenantBId: ids.jobB,
  allowedId: ids.jobAllowed,
  crossInsertId: ids.jobCrossInsert,
  noContextId: ids.jobNoContext,
  select: (rowId) => sql`select id from graphic_jobs where id = ${rowId}`,
  insert: (rowId, organizationId) => sql`
    insert into graphic_jobs (
      id, organization_id, internal_code, client_id, title, description,
      responsible_employee_id, project_id
    ) values (
      ${rowId}, ${organizationId}, ${`JOB-${rowId}`},
      ${organizationId === ids.orgA ? ids.clientA : ids.clientB},
      ${`Job ${rowId}`}, 'Job without an external OS',
      ${organizationId === ids.orgA ? ids.employeeA : ids.employeeB},
      ${organizationId === ids.orgA ? ids.projectA : ids.projectB}
    ) returning id
  `,
  update: (rowId, value) =>
    sql`update graphic_jobs set title = ${value} where id = ${rowId} returning id`,
  move: (rowId, organizationId) =>
    sql`update graphic_jobs set organization_id = ${organizationId} where id = ${rowId} returning id`,
  delete: (rowId) => sql`delete from graphic_jobs where id = ${rowId} returning id`,
};

const samples = [jobSample, projectSample];
let runtimeDb: Database;
let adminDb: Database;

beforeAll(async () => {
  runtimeDb = createDatabase(runtimeUrl, { allowExitOnIdle: true, max: 2 });
  adminDb = createDatabase(adminUrl, { allowExitOnIdle: true, max: 1 });
  await cleanup();
  await createFixtures();
});

afterAll(async () => {
  if (adminDb) await cleanup();
  await Promise.all([runtimeDb?.$client.end(), adminDb?.$client.end()]);
});

describe("GRF-001 jobs and projects foundation", () => {
  it.each(samples)("$name allows same-tenant CRUD through tenant context", async (sample) => {
    const withTenantDb = createWithTenantDb(runtimeDb);
    await withTenantDb(contextA, async (transaction) => {
      await expectRows(transaction, sample.select(sample.tenantAId), 1);
      await expectRows(transaction, sample.insert(sample.allowedId, ids.orgA), 1);
      await expectRows(transaction, sample.update(sample.allowedId, "Updated"), 1);
      await expectRows(transaction, sample.delete(sample.allowedId), 1);
    });
  });

  it.each(samples)("$name hides and protects known cross-tenant ids", async (sample) => {
    const withTenantDb = createWithTenantDb(runtimeDb);
    await withTenantDb(contextA, async (transaction) => {
      await expectRows(transaction, sample.select(sample.tenantBId), 0);
      await expectRows(transaction, sample.update(sample.tenantBId, "Tampered"), 0);
      await expectRows(transaction, sample.delete(sample.tenantBId), 0);
    });
    await expectRows(adminDb, sample.select(sample.tenantBId), 1);
  });

  it.each(samples)("$name rejects cross-tenant insert and reassignment", async (sample) => {
    const withTenantDb = createWithTenantDb(runtimeDb);
    await expectRlsViolation(() =>
      withTenantDb(contextA, (transaction) =>
        transaction.execute(sample.insert(sample.crossInsertId, ids.orgB)),
      ),
    );
    await expect(
      withTenantDb(contextA, (transaction) =>
        transaction.execute(sample.move(sample.tenantAId, ids.orgB)),
      ),
    ).rejects.toThrow();
  });

  it.each(samples)("$name denies all access without tenant context", async (sample) => {
    await expectRows(runtimeDb, sample.select(sample.tenantAId), 0);
    await expectRlsViolation(() =>
      runtimeDb.execute(sample.insert(sample.noContextId, ids.orgA)),
    );
    await expectRows(runtimeDb, sample.update(sample.tenantAId, "No context"), 0);
    await expectRows(runtimeDb, sample.delete(sample.tenantAId), 0);
  });

  it("creates a job before any OS and applies server-owned status defaults", async () => {
    const result = await adminDb.execute(sql`
      select operational_status::text as "operationalStatus",
             financial_status::text as "financialStatus"
      from graphic_jobs where id = ${ids.jobA}
    `);
    expect(result.rows).toEqual([{
      financialStatus: "not_started",
      operationalStatus: "supplier_sourcing",
    }]);
  });

  it("scopes internal and project codes by organization", async () => {
    await expect(adminDb.execute(jobSample.insert(id(71), ids.orgA))).resolves.toBeDefined();
    await adminDb.execute(sql`
      update graphic_jobs set internal_code = 'SHARED-JOB' where id = ${id(71)}
    `);
    await expect(adminDb.execute(sql`
      insert into graphic_jobs (
        organization_id, internal_code, client_id, title, description,
        responsible_employee_id
      ) values (
        ${ids.orgA}, 'SHARED-JOB', ${ids.clientA}, 'Duplicate', 'Duplicate', ${ids.employeeA}
      )
    `)).rejects.toThrow();
    await expect(adminDb.execute(sql`
      insert into graphic_jobs (
        organization_id, internal_code, client_id, title, description,
        responsible_employee_id
      ) values (
        ${ids.orgB}, 'SHARED-JOB', ${ids.clientB}, 'Other org', 'Other org', ${ids.employeeB}
      )
    `)).resolves.toBeDefined();
  });

  it("rejects cross-tenant client, responsible, and project links", async () => {
    for (const invalidLink of [
      sql`insert into graphic_jobs (organization_id, internal_code, client_id, title, description, responsible_employee_id) values (${ids.orgA}, 'INVALID-CLIENT', ${ids.clientB}, 'Invalid', 'Invalid', ${ids.employeeA})`,
      sql`insert into graphic_jobs (organization_id, internal_code, client_id, title, description, responsible_employee_id) values (${ids.orgA}, 'INVALID-OWNER', ${ids.clientA}, 'Invalid', 'Invalid', ${ids.employeeB})`,
      sql`insert into graphic_jobs (organization_id, internal_code, client_id, title, description, responsible_employee_id, project_id) values (${ids.orgA}, 'INVALID-PROJECT', ${ids.clientA}, 'Invalid', 'Invalid', ${ids.employeeA}, ${ids.projectB})`,
    ]) {
      await expect(adminDb.execute(invalidLink)).rejects.toThrow();
    }
  });

  it("records a tenant-scoped audit event for a graphic job", async () => {
    const withTenantDb = createWithTenantDb(runtimeDb);
    await withTenantDb(contextA, async (transaction) => {
      await transaction.insert(auditLogs).values(createAuditLogValues(contextA, {
        action: "create",
        after: { operationalStatus: "supplier_sourcing" },
        entityId: ids.jobA,
        entityType: "graphic_job",
      }));
    });
    const result = await adminDb.execute(sql`
      select action, entity_type as "entityType", entity_id as "entityId"
      from audit_logs
      where organization_id = ${ids.orgA} and entity_id = ${ids.jobA}
    `);
    expect(result.rows).toEqual([{
      action: "create",
      entityId: ids.jobA,
      entityType: "graphic_job",
    }]);
  });
});

async function createFixtures() {
  await adminDb.execute(sql`
    insert into organizations (id, name, slug) values
      (${ids.orgA}, 'GRF-001 A', 'grf-001-a'),
      (${ids.orgB}, 'GRF-001 B', 'grf-001-b')
  `);
  await adminDb.execute(sql`
    insert into "user" (id, organization_id, name, email) values
      (${userA}, ${ids.orgA}, 'GRF User A', 'grf-001-a@example.test'),
      (${userB}, ${ids.orgB}, 'GRF User B', 'grf-001-b@example.test')
  `);
  await adminDb.execute(sql`
    insert into areas (id, organization_id, name) values
      (${ids.areaA}, ${ids.orgA}, 'Graphics A'),
      (${ids.areaB}, ${ids.orgB}, 'Graphics B')
  `);
  await adminDb.execute(sql`
    insert into positions (id, organization_id, name) values
      (${ids.positionA}, ${ids.orgA}, 'Operator A'),
      (${ids.positionB}, ${ids.orgB}, 'Operator B')
  `);
  await adminDb.execute(sql`
    insert into employees (
      id, organization_id, registration_number, full_name, position_id,
      area_id, employment_type, start_date, current_compensation
    ) values
      (${ids.employeeA}, ${ids.orgA}, 'GRF-A', 'Employee A', ${ids.positionA}, ${ids.areaA}, 'clt', '2026-01-01', '1000.00'),
      (${ids.employeeB}, ${ids.orgB}, 'GRF-B', 'Employee B', ${ids.positionB}, ${ids.areaB}, 'clt', '2026-01-01', '1000.00')
  `);
  await adminDb.execute(sql`
    insert into clients (id, organization_id, name, code) values
      (${ids.clientA}, ${ids.orgA}, 'Client A', 'GRF-A'),
      (${ids.clientB}, ${ids.orgB}, 'Client B', 'GRF-B')
  `);
  await adminDb.execute(projectSample.insert(ids.projectA, ids.orgA));
  await adminDb.execute(projectSample.insert(ids.projectB, ids.orgB));
  await adminDb.execute(jobSample.insert(ids.jobA, ids.orgA));
  await adminDb.execute(jobSample.insert(ids.jobB, ids.orgB));
}

async function cleanup() {
  if (!adminDb) return;
  await adminDb.execute(sql`delete from audit_logs where organization_id in (${ids.orgA}, ${ids.orgB})`);
  await adminDb.execute(sql`delete from graphic_jobs where organization_id in (${ids.orgA}, ${ids.orgB})`);
  await adminDb.execute(sql`delete from graphic_projects where organization_id in (${ids.orgA}, ${ids.orgB})`);
  await adminDb.execute(sql`delete from clients where organization_id in (${ids.orgA}, ${ids.orgB})`);
  await adminDb.execute(sql`delete from employees where organization_id in (${ids.orgA}, ${ids.orgB})`);
  await adminDb.execute(sql`delete from positions where organization_id in (${ids.orgA}, ${ids.orgB})`);
  await adminDb.execute(sql`delete from areas where organization_id in (${ids.orgA}, ${ids.orgB})`);
  await adminDb.execute(sql`delete from "user" where id in (${userA}, ${userB})`);
  await adminDb.execute(sql`delete from organizations where id in (${ids.orgA}, ${ids.orgB})`);
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
}
