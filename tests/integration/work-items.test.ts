import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { generateAccessReviewWorkItems } from "@/features/work-items/access-review-pilot";
import {
  generateWorkItem,
  listActionableWorkItems,
  resolveWorkItem,
} from "@/features/work-items/dal";
import {
  createDatabase,
  createWithTenantDb,
  type Database,
} from "@/lib/db";
import { accessRecords, employees, workItems } from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError } from "@/lib/rbac";

const runtimeUrl = process.env.DATABASE_TEST_URL;
const adminUrl = process.env.DATABASE_TEST_ADMIN_URL;

if (!runtimeUrl || !adminUrl) {
  throw new Error(
    "DATABASE_TEST_URL and DATABASE_TEST_ADMIN_URL are required for the work-item suite.",
  );
}

const ids = {
  orgA: "71000000-0000-4000-8000-000000000001",
  orgB: "71000000-0000-4000-8000-000000000002",
  areaA: "71000000-0000-4000-8000-000000000011",
  areaB: "71000000-0000-4000-8000-000000000012",
  positionA: "71000000-0000-4000-8000-000000000021",
  positionB: "71000000-0000-4000-8000-000000000022",
  employeeA: "71000000-0000-4000-8000-000000000031",
  employeeB: "71000000-0000-4000-8000-000000000032",
  accessA: "71000000-0000-4000-8000-000000000041",
  crossInsert: "71000000-0000-4000-8000-000000000051",
  noContextInsert: "71000000-0000-4000-8000-000000000052",
} as const;
const userA = "core-004-user-a";
const userB = "core-004-user-b";
const contextA = createContext(userA, ids.orgA);
const contextB = createContext(userB, ids.orgB);

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

describe("CORE-004 work item persistence", () => {
  it("deduplicates one occurrence but permits a future occurrence after resolution", async () => {
    const input = buildInput("cycle:2026-08");
    const first = await generateWorkItem(contextA, input);
    const repeated = await generateWorkItem(contextA, input);

    expect(first.created).toBe(true);
    expect(repeated).toMatchObject({ created: false });
    expect(repeated.item.id).toBe(first.item.id);

    const resolved = await resolveWorkItem(contextA, {
      id: first.item.id,
      resolution: "A origem foi conferida e corrigida.",
    });
    const sameResolvedOccurrence = await generateWorkItem(contextA, input);
    const future = await generateWorkItem(contextA, buildInput("cycle:2026-09"));

    expect(resolved).toMatchObject({
      resolution: "A origem foi conferida e corrigida.",
      resolvedByUserId: userA,
      status: "resolved",
    });
    expect(sameResolvedOccurrence).toMatchObject({ created: false });
    expect(sameResolvedOccurrence.item.status).toBe("resolved");
    expect(future).toMatchObject({ created: true });
    expect(future.item.id).not.toBe(first.item.id);
  });

  it("validates owner scope and blocks IDOR resolution", async () => {
    await expect(
      generateWorkItem(contextA, {
        ...buildInput("cross-owner"),
        assignedUserId: userB,
      }),
    ).rejects.toBeInstanceOf(AccessDeniedError);
    await expect(
      generateWorkItem(contextA, {
        ...buildInput("cross-employee-owner"),
        assignedEmployeeId: ids.employeeB,
      }),
    ).rejects.toBeInstanceOf(AccessDeniedError);

    const tenantBItem = await generateWorkItem(
      contextB,
      buildInput("tenant-b", "tenant-b-source"),
    );

    await expect(
      resolveWorkItem(contextA, {
        id: tenantBItem.item.id,
        resolution: "Tentativa entre organizacoes.",
      }),
    ).rejects.toBeInstanceOf(AccessDeniedError);

    const [unchanged] = await adminDb
      .select({ status: workItems.status })
      .from(workItems)
      .where(eq(workItems.id, tenantBItem.item.id));
    expect(unchanged?.status).toBe("open");
  });

  it("lists only actionable work items from the current organization", async () => {
    const tenantAItem = await generateWorkItem(
      contextA,
      buildInput("actionable-a", "actionable-a-source"),
    );
    const tenantBItem = await generateWorkItem(
      contextB,
      buildInput("actionable-b", "actionable-b-source"),
    );

    const beforeResolution = await listActionableWorkItems(contextA);

    expect(beforeResolution.map((item) => item.id)).toContain(tenantAItem.item.id);
    expect(beforeResolution.map((item) => item.id)).not.toContain(tenantBItem.item.id);

    await resolveWorkItem(contextA, {
      id: tenantAItem.item.id,
      resolution: "Pendencia concluida pela operacao.",
    });

    const afterResolution = await listActionableWorkItems(contextA);
    expect(afterResolution.map((item) => item.id)).not.toContain(tenantAItem.item.id);
  });

  it("migrates access review as the single pilot generator", async () => {
    const first = await generateAccessReviewWorkItems(
      contextA,
      "2026-08-24",
    );
    const repeated = await generateAccessReviewWorkItems(
      contextA,
      "2026-08-25",
    );

    expect(first).toHaveLength(2);
    expect(first.every((result) => result.created)).toBe(true);
    expect(first.map((result) => result.item.kind)).toEqual([
      "access_revocation",
      "access_review",
    ]);
    expect(first.every((result) => result.item.assignedUserId === userA)).toBe(
      true,
    );
    expect(repeated.every((result) => !result.created)).toBe(true);
    expect(repeated.map((result) => result.item.id)).toEqual(
      first.map((result) => result.item.id),
    );

    await adminDb
      .update(employees)
      .set({
        fullName: "Pessoa Piloto A Atualizada",
        updatedAt: new Date("2026-08-26T10:00:00.000Z"),
      })
      .where(eq(employees.id, ids.employeeA));
    await adminDb
      .update(accessRecords)
      .set({
        notes: "Edicao alheia ao ciclo da pendencia.",
        updatedAt: new Date("2026-08-26T11:00:00.000Z"),
      })
      .where(eq(accessRecords.id, ids.accessA));

    const afterUnrelatedUpdates = await generateAccessReviewWorkItems(
      contextA,
      "2026-08-26",
    );

    expect(afterUnrelatedUpdates.every((result) => !result.created)).toBe(true);
    expect(afterUnrelatedUpdates.map((result) => result.item.id)).toEqual(
      first.map((result) => result.item.id),
    );
  });
});

describe("CORE-004 work item RLS", () => {
  it("hides cross-tenant rows and rejects cross-tenant writes", async () => {
    const tenantBItem = await generateWorkItem(
      contextB,
      buildInput("rls-b", "rls-b-source"),
    );
    const withTenantDb = createWithTenantDb(runtimeDb);

    await withTenantDb(contextA, async (transaction) => {
      const crossTenantRows = await transaction
        .select({ id: workItems.id })
        .from(workItems)
        .where(eq(workItems.id, tenantBItem.item.id));
      const updated = await transaction
        .update(workItems)
        .set({ title: "tampered" })
        .where(
          and(
            eq(workItems.id, tenantBItem.item.id),
            eq(workItems.organizationId, ids.orgB),
          ),
        )
        .returning({ id: workItems.id });
      const deleted = await transaction
        .delete(workItems)
        .where(eq(workItems.id, tenantBItem.item.id))
        .returning({ id: workItems.id });

      expect(crossTenantRows).toEqual([]);
      expect(updated).toEqual([]);
      expect(deleted).toEqual([]);
    });

    const [preserved] = await adminDb
      .select({ id: workItems.id })
      .from(workItems)
      .where(eq(workItems.id, tenantBItem.item.id));
    expect(preserved?.id).toBe(tenantBItem.item.id);

    await expectRlsViolation(() =>
      withTenantDb(contextA, (transaction) =>
        transaction.insert(workItems).values({
          ...buildInput("cross-insert", ids.crossInsert),
          id: ids.crossInsert,
          organizationId: ids.orgB,
        }),
      ),
    );
  });

  it("denies reads and writes without tenant context", async () => {
    const rows = await runtimeDb
      .select({ id: workItems.id })
      .from(workItems);

    expect(rows).toEqual([]);
    const deleted = await runtimeDb
      .delete(workItems)
      .where(eq(workItems.organizationId, ids.orgA))
      .returning({ id: workItems.id });
    expect(deleted).toEqual([]);
    await expectRlsViolation(() =>
      runtimeDb.insert(workItems).values({
        ...buildInput("no-context", ids.noContextInsert),
        id: ids.noContextInsert,
        organizationId: ids.orgA,
      }),
    );
  });
});

function createContext(userId: string, organizationId: string): AccessContext {
  return {
    employeeId: null,
    organizationId,
    permissions: ["alerts.write"],
    roles: [],
    userId,
  };
}

function buildInput(occurrenceKey: string, sourceId = "source-a") {
  return {
    kind: "integration_review",
    sourceType: "integration_fixture",
    sourceId,
    occurrenceKey,
    title: "Conferir integracao",
    description: "Pendencia criada pela suite de integracao.",
    priority: "high" as const,
  };
}

async function createFixtures() {
  await adminDb.execute(sql`
    insert into organizations (id, name, slug) values
      (${ids.orgA}, 'CORE-004 Organization A', 'core-004-organization-a'),
      (${ids.orgB}, 'CORE-004 Organization B', 'core-004-organization-b')
  `);
  await adminDb.execute(sql`
    insert into "user" (
      id, organization_id, name, email, email_verified, access_status, is_active
    ) values
      (${userA}, ${ids.orgA}, 'CORE-004 User A', 'core-004-a@example.test', true, 'active', true),
      (${userB}, ${ids.orgB}, 'CORE-004 User B', 'core-004-b@example.test', true, 'active', true)
  `);
  await adminDb.execute(sql`
    insert into areas (id, organization_id, name) values
      (${ids.areaA}, ${ids.orgA}, 'CORE-004 Area A'),
      (${ids.areaB}, ${ids.orgB}, 'CORE-004 Area B')
  `);
  await adminDb.execute(sql`
    insert into positions (id, organization_id, name) values
      (${ids.positionA}, ${ids.orgA}, 'CORE-004 Position A'),
      (${ids.positionB}, ${ids.orgB}, 'CORE-004 Position B')
  `);
  await adminDb.execute(sql`
    insert into employees (
      id, organization_id, registration_number, full_name, position_id,
      area_id, employment_type, start_date, current_compensation, status,
      updated_at
    ) values
      (
        ${ids.employeeA}, ${ids.orgA}, 'CORE-004-A', 'Pessoa Piloto A',
        ${ids.positionA}, ${ids.areaA}, 'clt', '2020-01-01', '1000.00',
        'terminated', '2026-08-20T10:00:00.000Z'
      ),
      (
        ${ids.employeeB}, ${ids.orgB}, 'CORE-004-B', 'Pessoa Piloto B',
        ${ids.positionB}, ${ids.areaB}, 'clt', '2020-01-01', '1000.00',
        'active', '2026-08-20T10:00:00.000Z'
      )
  `);
  await adminDb.execute(sql`
    insert into access_records (
      id, organization_id, employee_id, platform, access_level, critical,
      status, responsible_user_id, updated_at
    ) values (
      ${ids.accessA}, ${ids.orgA}, ${ids.employeeA}, 'Email', 'admin', true,
      'active', ${userA}, '2026-08-21T10:00:00.000Z'
    )
  `);
}

async function removeFixtures() {
  await adminDb?.execute(
    sql`delete from audit_logs where organization_id in (${ids.orgA}, ${ids.orgB})`,
  );
  await adminDb?.execute(
    sql`delete from work_items where organization_id in (${ids.orgA}, ${ids.orgB})`,
  );
  await adminDb?.execute(
    sql`delete from access_records where organization_id in (${ids.orgA}, ${ids.orgB})`,
  );
  await adminDb?.execute(
    sql`delete from employees where organization_id in (${ids.orgA}, ${ids.orgB})`,
  );
  await adminDb?.execute(
    sql`delete from positions where organization_id in (${ids.orgA}, ${ids.orgB})`,
  );
  await adminDb?.execute(
    sql`delete from areas where organization_id in (${ids.orgA}, ${ids.orgB})`,
  );
  await adminDb?.execute(sql`delete from "user" where id in (${userA}, ${userB})`);
  await adminDb?.execute(
    sql`delete from organizations where id in (${ids.orgA}, ${ids.orgB})`,
  );
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
