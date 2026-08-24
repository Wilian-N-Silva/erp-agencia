import { sql } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const actionMocks = vi.hoisted(() => ({
  enforceAuthenticatedRateLimit: vi.fn().mockResolvedValue(undefined),
  getCurrentSession: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/session")>();

  return {
    ...actual,
    getCurrentSession: actionMocks.getCurrentSession,
  };
});

vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();

  return {
    ...actual,
    enforceAuthenticatedRateLimit: actionMocks.enforceAuthenticatedRateLimit,
  };
});

import { updateSettingsUserEmployeeLinkAction } from "@/features/settings/actions";
import { getSettingsDashboard } from "@/features/settings/dal";
import { createDatabase, getDb, type Database } from "@/lib/db";
import { getCurrentAccessContext } from "@/lib/dal";
import { createAccessContext } from "@/tests/helpers/access-context";

const runtimeUrl = process.env.DATABASE_TEST_URL;
const adminUrl = process.env.DATABASE_TEST_ADMIN_URL;

if (!runtimeUrl || !adminUrl) {
  throw new Error(
    "DATABASE_TEST_URL and DATABASE_TEST_ADMIN_URL are required for the user employee link suite.",
  );
}

const ids = {
  areaA: "64000000-0000-4000-8000-000000000011",
  areaB: "64000000-0000-4000-8000-000000000012",
  employeeA: "64000000-0000-4000-8000-000000000101",
  employeeOccupiedA: "64000000-0000-4000-8000-000000000102",
  employeeReplacementA: "64000000-0000-4000-8000-000000000103",
  employeeB: "64000000-0000-4000-8000-000000000104",
  orgA: "64000000-0000-4000-8000-000000000001",
  orgB: "64000000-0000-4000-8000-000000000002",
  positionA: "64000000-0000-4000-8000-000000000021",
  positionB: "64000000-0000-4000-8000-000000000022",
} as const;
const users = {
  adminA: "acc-003-admin-a",
  employeeOnlyA: "acc-003-employee-only-a",
  otherA: "acc-003-other-a",
  rollbackA: "acc-003-rollback-a",
  targetA: "acc-003-target-a",
  targetB: "acc-003-target-b",
} as const;

let runtimeDb: Database;
let adminDb: Database;
let originalDatabaseUrl: string | undefined;

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = runtimeUrl;
  runtimeDb = createDatabase(runtimeUrl, { allowExitOnIdle: true, max: 4 });
  adminDb = createDatabase(adminUrl, { allowExitOnIdle: true, max: 1 });
  await removeFixtures();
  await createFixtures();
});

beforeEach(async () => {
  actionMocks.getCurrentSession.mockResolvedValue({
    user: { id: users.adminA },
  });
  actionMocks.enforceAuthenticatedRateLimit.mockClear();
  await adminDb.execute(sql`
    update employees
    set user_id = case
      when id = ${ids.employeeOccupiedA} then ${users.otherA}
      else null
    end
    where id in (
      ${ids.employeeA},
      ${ids.employeeOccupiedA},
      ${ids.employeeReplacementA},
      ${ids.employeeB}
    )
  `);
  await adminDb.execute(sql`
    delete from audit_logs
    where entity_type = 'user_employee_link'
      and entity_id in (${users.targetA}, ${users.rollbackA})
  `);
});

afterAll(async () => {
  if (adminDb) await removeFixtures();
  await Promise.all([
    runtimeDb?.$client.end(),
    adminDb?.$client.end(),
    getDb().$client.end(),
  ]);
  restoreEnvironmentVariable("DATABASE_URL", originalDatabaseUrl);
});

describe("ACC-003 user employee link", () => {
  it("links an organization employee, audits it, and exposes it in AccessContext", async () => {
    await expect(link(users.targetA, ids.employeeA)).resolves.toEqual({
      data: undefined,
      ok: true,
    });

    await expectEmployeeLink(ids.employeeA, users.targetA);
    const auditRows = await adminDb.execute(sql<{
      actorUserId: string | null;
      afterEmployeeIds: string[] | null;
      beforeEmployeeIds: string[] | null;
    }>`
      select
        actor_user_id as "actorUserId",
        after->'employeeIds' as "afterEmployeeIds",
        before->'employeeIds' as "beforeEmployeeIds"
      from audit_logs
      where entity_type = 'user_employee_link'
        and entity_id = ${users.targetA}
    `);
    expect(auditRows.rows).toEqual([
      {
        actorUserId: users.adminA,
        afterEmployeeIds: [ids.employeeA],
        beforeEmployeeIds: [],
      },
    ]);

    actionMocks.getCurrentSession.mockResolvedValue({
      user: { id: users.targetA },
    });
    await expect(getCurrentAccessContext()).resolves.toMatchObject({
      employeeId: ids.employeeA,
      organizationId: ids.orgA,
      userId: users.targetA,
    });
  });

  it("replaces and removes a link atomically", async () => {
    await link(users.targetA, ids.employeeA);
    await expect(link(users.targetA, ids.employeeReplacementA)).resolves.toEqual({
      data: undefined,
      ok: true,
    });
    await expectEmployeeLink(ids.employeeA, null);
    await expectEmployeeLink(ids.employeeReplacementA, users.targetA);

    await expect(link(users.targetA, "")).resolves.toEqual({
      data: undefined,
      ok: true,
    });
    await expectEmployeeLink(ids.employeeReplacementA, null);
  });

  it("serializes concurrent admin writes so they cannot create two links", async () => {
    const results = await Promise.allSettled([
      link(users.targetA, ids.employeeA),
      link(users.targetA, ids.employeeReplacementA),
    ]);

    expect(results.every((result) => result.status === "fulfilled")).toBe(true);
    const linkedEmployees = await adminDb.execute(sql<{ id: string }>`
      select id
      from employees
      where organization_id = ${ids.orgA}
        and user_id = ${users.targetA}
    `);
    expect(linkedEmployees.rows).toHaveLength(1);
  });

  it("rejects known cross-tenant user and employee ids without audit", async () => {
    await expect(link(users.targetA, ids.employeeB)).rejects.toMatchObject({
      name: "AccessDeniedError",
    });
    await expect(link(users.targetB, ids.employeeA)).rejects.toMatchObject({
      name: "AccessDeniedError",
    });
    await expectEmployeeLink(ids.employeeA, null);
    await expectAuditCount(users.targetA, 0);
  });

  it("rejects an employee already linked to another user", async () => {
    await expect(
      link(users.targetA, ids.employeeOccupiedA),
    ).rejects.toThrow("Colaborador já está vinculado a outro usuário.");
    await expectEmployeeLink(ids.employeeOccupiedA, users.otherA);
    await expectAuditCount(users.targetA, 0);
  });

  it("requires settings.manage and applies the access-management rate limit", async () => {
    actionMocks.getCurrentSession.mockResolvedValue({
      user: { id: users.employeeOnlyA },
    });

    await expect(link(users.targetA, ids.employeeA)).rejects.toMatchObject({
      name: "AccessDeniedError",
    });
    expect(actionMocks.enforceAuthenticatedRateLimit).not.toHaveBeenCalled();

    actionMocks.getCurrentSession.mockResolvedValue({
      user: { id: users.adminA },
    });
    await link(users.targetA, ids.employeeA);
    expect(actionMocks.enforceAuthenticatedRateLimit).toHaveBeenCalledWith(
      "invitation",
      expect.objectContaining({ userId: users.adminA }),
    );
  });

  it("rolls back the link when the audit write fails", async () => {
    await adminDb.execute(sql.raw(`
      create or replace function acc_003_reject_link_audit()
      returns trigger
      language plpgsql
      as $function$
      begin
        if new.entity_type = 'user_employee_link'
          and new.entity_id = '${users.rollbackA}' then
          raise exception 'ACC-003 forced audit failure';
        end if;
        return new;
      end
      $function$
    `));
    await adminDb.execute(sql.raw(`
      create trigger acc_003_reject_link_audit
      before insert on audit_logs
      for each row execute function acc_003_reject_link_audit()
    `));

    try {
      await expect(
        link(users.rollbackA, ids.employeeReplacementA),
      ).rejects.toMatchObject({
        cause: expect.objectContaining({
          message: expect.stringContaining("ACC-003 forced audit failure"),
        }),
      });
      await expectEmployeeLink(ids.employeeReplacementA, null);
      await expectAuditCount(users.rollbackA, 0);
    } finally {
      await adminDb.execute(sql.raw(`
        drop trigger if exists acc_003_reject_link_audit on audit_logs
      `));
      await adminDb.execute(sql.raw(`
        drop function if exists acc_003_reject_link_audit()
      `));
    }
  });

  it("fails closed on a legacy conflict and lets the admin resolve it explicitly", async () => {
    await createLegacyDuplicateLinks();

    actionMocks.getCurrentSession.mockResolvedValue({
      user: { id: users.targetA },
    });
    await expect(getCurrentAccessContext()).resolves.toMatchObject({
      employeeId: null,
      organizationId: ids.orgA,
      userId: users.targetA,
    });

    const dashboard = await getSettingsDashboard(createAccessContext({
      userId: users.adminA,
      organizationId: ids.orgA,
      roles: ["technical_admin"],
    }));
    const conflictedUsers = dashboard.users.filter(
      (user) => user.id === users.targetA,
    );
    expect(conflictedUsers).toHaveLength(1);
    expect(conflictedUsers[0]).toMatchObject({
      employeeId: null,
      employeeLinkConflict: true,
    });
    expect(
      conflictedUsers[0]?.employeeLinks.map((employee) => employee.id).sort(),
    ).toEqual([ids.employeeA, ids.employeeReplacementA].sort());

    actionMocks.getCurrentSession.mockResolvedValue({
      user: { id: users.adminA },
    });
    await expect(
      link(users.targetA, ids.employeeReplacementA),
    ).resolves.toEqual({ data: undefined, ok: true });
    await expectEmployeeLink(ids.employeeA, null);
    await expectEmployeeLink(ids.employeeReplacementA, users.targetA);

    const auditRows = await adminDb.execute(sql<{ beforeEmployeeIds: string[] }>`
      select before->'employeeIds' as "beforeEmployeeIds"
      from audit_logs
      where entity_type = 'user_employee_link'
        and entity_id = ${users.targetA}
    `);
    const beforeEmployeeIds = auditRows.rows[0]?.beforeEmployeeIds as
      | string[]
      | undefined;
    expect(beforeEmployeeIds?.sort()).toEqual(
      [ids.employeeA, ids.employeeReplacementA].sort(),
    );

    actionMocks.getCurrentSession.mockResolvedValue({
      user: { id: users.targetA },
    });
    await expect(getCurrentAccessContext()).resolves.toMatchObject({
      employeeId: ids.employeeReplacementA,
      organizationId: ids.orgA,
      userId: users.targetA,
    });
  });

  it("prevents new conflicts at the database boundary", async () => {
    await adminDb.execute(sql`
      update employees set user_id = ${users.targetA}
      where id = ${ids.employeeA}
    `);

    await expect(
      adminDb.execute(sql`
        update employees set user_id = ${users.targetA}
        where id = ${ids.employeeReplacementA}
      `),
    ).rejects.toMatchObject({
      cause: expect.objectContaining({ code: "23505" }),
    });
    await expectEmployeeLink(ids.employeeReplacementA, null);
  });
});

describe("ACC-003 migration upgrade", () => {
  it("keeps the clean upgrade path and prevents a new conflict", async () => {
    const schemaName = "acc_003_upgrade_clean";
    await dropUpgradeSchema(schemaName);

    try {
      await createUpgradeSchema(schemaName, [
        ["65000000-0000-4000-8000-000000000001", "legacy-user"],
        ["65000000-0000-4000-8000-000000000002", null],
        ["65000000-0000-4000-8000-000000000003", null],
      ]);
      await runAcc003Migration(schemaName);

      await expect(
        adminDb.execute(sql.raw(`
          insert into ${schemaName}.employees (id, user_id)
          values ('65000000-0000-4000-8000-000000000004', 'legacy-user')
        `)),
      ).rejects.toMatchObject({
        cause: expect.objectContaining({ code: "23505" }),
      });
      await expectUpgradeCounts(schemaName, { employees: 3, users: 1 });
      const nullableRows = await adminDb.execute(sql.raw(`
        select id from ${schemaName}.employees where user_id is null
      `));
      expect(nullableRows.rows).toHaveLength(2);
    } finally {
      await dropUpgradeSchema(schemaName);
    }
  });

  it("migrates duplicate legacy links without data loss and keeps them remediable", async () => {
    const schemaName = "acc_003_upgrade_duplicates";
    const firstEmployeeId = "65000000-0000-4000-8000-000000000011";
    const selectedEmployeeId = "65000000-0000-4000-8000-000000000012";
    await dropUpgradeSchema(schemaName);

    try {
      await createUpgradeSchema(schemaName, [
        [firstEmployeeId, "legacy-user"],
        [selectedEmployeeId, "legacy-user"],
        ["65000000-0000-4000-8000-000000000013", null],
      ]);

      await expect(runAcc003Migration(schemaName)).resolves.toBeUndefined();
      await expectUpgradeCounts(schemaName, { employees: 3, users: 1 });

      const conflicts = await getUpgradeConflicts(schemaName);
      expect(conflicts.rows).toEqual([{
        employeeCount: 2,
        employeeIds: [firstEmployeeId, selectedEmployeeId],
        userId: "legacy-user",
      }]);

      await expect(
        adminDb.execute(sql.raw(`
          insert into ${schemaName}.employees (id, user_id)
          values ('65000000-0000-4000-8000-000000000014', 'legacy-user')
        `)),
      ).rejects.toMatchObject({
        cause: expect.objectContaining({ code: "23505" }),
      });

      await adminDb.transaction(async (transaction) => {
        await transaction.execute(sql.raw(`
          update ${schemaName}.employees
          set user_id = null
          where user_id = 'legacy-user'
        `));
        await transaction.execute(sql.raw(`
          update ${schemaName}.employees
          set user_id = 'legacy-user'
          where id = '${selectedEmployeeId}'
        `));
      });

      expect((await getUpgradeConflicts(schemaName)).rows).toEqual([]);
      const selectedLink = await adminDb.execute(sql.raw(`
        select id, user_id as "userId"
        from ${schemaName}.employees
        where user_id = 'legacy-user'
      `));
      expect(selectedLink.rows).toEqual([{
        id: selectedEmployeeId,
        userId: "legacy-user",
      }]);
      await expectUpgradeCounts(schemaName, { employees: 3, users: 1 });

      await expect(
        adminDb.execute(sql.raw(`
          update ${schemaName}.employees
          set user_id = 'legacy-user'
          where id = '${firstEmployeeId}'
        `)),
      ).rejects.toMatchObject({
        cause: expect.objectContaining({ code: "23505" }),
      });
    } finally {
      await dropUpgradeSchema(schemaName);
    }
  });
});

async function createUpgradeSchema(
  schemaName: string,
  employeeLinks: ReadonlyArray<readonly [id: string, userId: string | null]>,
) {
  await adminDb.execute(sql.raw(`create schema ${schemaName}`));
  await adminDb.execute(sql.raw(`
    create table ${schemaName}."user" (
      id text primary key
    )
  `));
  await adminDb.execute(sql.raw(`
    create table ${schemaName}.employees (
      id uuid primary key,
      user_id text references ${schemaName}."user" (id)
    )
  `));
  await adminDb.execute(sql.raw(`
    create index employees_user_idx
    on ${schemaName}.employees (user_id)
  `));
  await adminDb.execute(sql.raw(`
    insert into ${schemaName}."user" (id) values ('legacy-user')
  `));

  for (const [id, userId] of employeeLinks) {
    await adminDb.execute(sql.raw(`
      insert into ${schemaName}.employees (id, user_id)
      values ('${id}', ${userId ? `'${userId}'` : "null"})
    `));
  }
}

async function runAcc003Migration(schemaName: string) {
  const migrationPath = new URL(
    "../../drizzle/0013_youthful_ma_gnuci.sql",
    import.meta.url,
  );
  const migration = await readFile(migrationPath, "utf8");

  await adminDb.transaction(async (transaction) => {
    await transaction.execute(
      sql.raw(`set local search_path to ${schemaName}, public`),
    );
    for (const statement of migration
      .split("--> statement-breakpoint")
      .map((value) => value.trim())
      .filter(Boolean)) {
      await transaction.execute(sql.raw(statement));
    }
  });
}

async function getUpgradeConflicts(schemaName: string) {
  return adminDb.execute(sql.raw(`
    select
      user_id as "userId",
      count(*)::int as "employeeCount",
      array_agg(id order by id) as "employeeIds"
    from ${schemaName}.employees
    where user_id is not null
    group by user_id
    having count(*) > 1
  `)) as Promise<{ rows: Array<{
    employeeCount: number;
    employeeIds: string[];
    userId: string;
  }> }>;
}

async function expectUpgradeCounts(
  schemaName: string,
  expected: { employees: number; users: number },
) {
  const counts = await adminDb.execute(sql.raw(`
    select
      (select count(*)::int from ${schemaName}.employees) as employees,
      (select count(*)::int from ${schemaName}."user") as users
  `));
  expect(counts.rows).toEqual([expected]);
}

async function dropUpgradeSchema(schemaName: string) {
  await adminDb.execute(sql.raw(`drop schema if exists ${schemaName} cascade`));
}

async function createLegacyDuplicateLinks() {
  await adminDb.execute(sql.raw(`
    alter table employees
    disable trigger acc_003_employee_user_conflict_guard
  `));

  try {
    await adminDb.execute(sql`
      update employees
      set user_id = ${users.targetA}
      where id in (${ids.employeeA}, ${ids.employeeReplacementA})
    `);
  } finally {
    await adminDb.execute(sql.raw(`
      alter table employees
      enable trigger acc_003_employee_user_conflict_guard
    `));
  }
}

async function link(userId: string, employeeId: string) {
  const formData = new FormData();
  formData.set("userId", userId);
  formData.set("employeeId", employeeId);
  return updateSettingsUserEmployeeLinkAction(formData);
}

async function expectEmployeeLink(employeeId: string, userId: string | null) {
  const rows = await adminDb.execute(sql<{ userId: string | null }>`
    select user_id as "userId" from employees where id = ${employeeId}
  `);
  expect(rows.rows).toEqual([{ userId }]);
}

async function expectAuditCount(userId: string, count: number) {
  const rows = await adminDb.execute(sql<{ count: number }>`
    select count(*)::int as count
    from audit_logs
    where entity_type = 'user_employee_link' and entity_id = ${userId}
  `);
  expect(rows.rows[0]?.count).toBe(count);
}

async function createFixtures() {
  await adminDb.transaction(async (transaction) => {
    await transaction.execute(sql`
      insert into organizations (id, name, slug) values
        (${ids.orgA}, 'ACC-003 Organization A', 'acc-003-organization-a'),
        (${ids.orgB}, 'ACC-003 Organization B', 'acc-003-organization-b')
    `);
    await transaction.execute(sql`
      insert into "user" (
        id, organization_id, name, email, email_verified, access_status, is_active
      ) values
        (${users.adminA}, ${ids.orgA}, 'ACC-003 Admin', 'acc-003-admin@example.test', true, 'active', true),
        (${users.targetA}, ${ids.orgA}, 'ACC-003 Target A', 'acc-003-target-a@example.test', true, 'active', true),
        (${users.targetB}, ${ids.orgB}, 'ACC-003 Target B', 'acc-003-target-b@example.test', true, 'active', true),
        (${users.otherA}, ${ids.orgA}, 'ACC-003 Other A', 'acc-003-other-a@example.test', true, 'active', true),
        (${users.rollbackA}, ${ids.orgA}, 'ACC-003 Rollback A', 'acc-003-rollback-a@example.test', true, 'active', true),
        (${users.employeeOnlyA}, ${ids.orgA}, 'ACC-003 Employee A', 'acc-003-employee-a@example.test', true, 'active', true)
    `);
    await transaction.execute(sql`
      insert into roles (key, name) values
        ('technical_admin', 'Admin Tecnico'),
        ('employee', 'Colaborador')
      on conflict (key) do nothing
    `);
    await transaction.execute(sql`
      insert into permissions (key, description)
      values ('settings.manage', 'Gerenciar configuracoes')
      on conflict (key) do nothing
    `);
    await transaction.execute(sql`
      insert into role_permissions (role_id, permission_id)
      select roles.id, permissions.id
      from roles
      cross join permissions
      where roles.key = 'technical_admin'
        and permissions.key = 'settings.manage'
      on conflict do nothing
    `);
    await transaction.execute(sql`
      insert into user_roles (user_id, role_id, assigned_by_user_id)
      select fixture.user_id, roles.id, ${users.adminA}
      from (
        values
          (${users.adminA}, 'technical_admin'),
          (${users.targetA}, 'employee'),
          (${users.employeeOnlyA}, 'employee')
      ) as fixture(user_id, role_key)
      inner join roles on roles.key = fixture.role_key
    `);
    await transaction.execute(sql`
      insert into areas (id, organization_id, name) values
        (${ids.areaA}, ${ids.orgA}, 'ACC-003 Area A'),
        (${ids.areaB}, ${ids.orgB}, 'ACC-003 Area B')
    `);
    await transaction.execute(sql`
      insert into positions (id, organization_id, name) values
        (${ids.positionA}, ${ids.orgA}, 'ACC-003 Position A'),
        (${ids.positionB}, ${ids.orgB}, 'ACC-003 Position B')
    `);
    await transaction.execute(sql`
      insert into employees (
        id, organization_id, user_id, registration_number, full_name,
        position_id, area_id, employment_type, start_date, current_compensation
      ) values
        (${ids.employeeA}, ${ids.orgA}, null, 'ACC003-1', 'ACC-003 Employee A', ${ids.positionA}, ${ids.areaA}, 'clt', '2026-01-01', '1000.00'),
        (${ids.employeeOccupiedA}, ${ids.orgA}, ${users.otherA}, 'ACC003-2', 'ACC-003 Occupied A', ${ids.positionA}, ${ids.areaA}, 'clt', '2026-01-01', '1000.00'),
        (${ids.employeeReplacementA}, ${ids.orgA}, null, 'ACC003-3', 'ACC-003 Replacement A', ${ids.positionA}, ${ids.areaA}, 'clt', '2026-01-01', '1000.00'),
        (${ids.employeeB}, ${ids.orgB}, null, 'ACC003-4', 'ACC-003 Employee B', ${ids.positionB}, ${ids.areaB}, 'clt', '2026-01-01', '1000.00')
    `);
  });
}

async function removeFixtures() {
  await adminDb?.transaction(async (transaction) => {
    await transaction.execute(sql`
      delete from audit_logs
      where entity_type = 'user_employee_link'
        and entity_id in (${users.targetA}, ${users.rollbackA})
    `);
    await transaction.execute(sql`
      delete from employees where organization_id in (${ids.orgA}, ${ids.orgB})
    `);
    await transaction.execute(sql`
      delete from positions where organization_id in (${ids.orgA}, ${ids.orgB})
    `);
    await transaction.execute(sql`
      delete from areas where organization_id in (${ids.orgA}, ${ids.orgB})
    `);
    await transaction.execute(sql`
      delete from user_roles
      where user_id in (
        ${users.adminA}, ${users.employeeOnlyA}, ${users.otherA},
        ${users.rollbackA}, ${users.targetA}, ${users.targetB}
      )
    `);
    await transaction.execute(sql`
      delete from "user"
      where id in (
        ${users.adminA}, ${users.employeeOnlyA}, ${users.otherA},
        ${users.rollbackA}, ${users.targetA}, ${users.targetB}
      )
    `);
    await transaction.execute(sql`
      delete from organizations where id in (${ids.orgA}, ${ids.orgB})
    `);
  });
}

function restoreEnvironmentVariable(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
