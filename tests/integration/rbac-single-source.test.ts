import { sql } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const sessionMocks = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
}));

vi.mock("@/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/session")>();

  return {
    ...actual,
    getCurrentSession: sessionMocks.getCurrentSession,
  };
});

import { replaceUserRoles } from "@/features/settings/access";
import { lastSettingsAdministratorError } from "@/features/settings/rules";
import { createDatabase, getDb, type Database } from "@/lib/db";
import { createAccessContext, getCurrentAccessContext } from "@/lib/dal";

const runtimeUrl = process.env.DATABASE_TEST_URL;
const adminUrl = process.env.DATABASE_TEST_ADMIN_URL;

if (!runtimeUrl || !adminUrl) {
  throw new Error(
    "DATABASE_TEST_URL and DATABASE_TEST_ADMIN_URL are required for the RBAC suite.",
  );
}

const ids = {
  orgA: "66000000-0000-4000-8000-000000000001",
  orgB: "66000000-0000-4000-8000-000000000002",
} as const;
const users = {
  adminA: "acc-004-admin-a",
  rollbackA: "acc-004-rollback-a",
  targetA: "acc-004-target-a",
  targetB: "acc-004-target-b",
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
  sessionMocks.getCurrentSession.mockResolvedValue({
    user: { id: users.adminA },
  });
  await adminDb.execute(sql`
    delete from audit_logs
    where entity_type = 'user'
      and entity_id in (${users.adminA}, ${users.rollbackA}, ${users.targetA})
  `);
  await adminDb.execute(sql`
    delete from user_roles
    where user_id in (
      ${users.adminA}, ${users.rollbackA}, ${users.targetA}, ${users.targetB}
    )
  `);
  await adminDb.execute(sql`
    insert into user_roles (user_id, role_id, assigned_by_user_id)
    select fixture.user_id, roles.id, ${users.adminA}
    from (
      values
        (${users.adminA}, 'technical_admin'),
        (${users.rollbackA}, 'finance'),
        (${users.targetA}, 'finance'),
        (${users.targetB}, 'finance')
    ) as fixture(user_id, role_key)
    inner join roles on roles.key = fixture.role_key
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

describe("ACC-004 persisted RBAC", () => {
  it("resolves runtime permissions only from role_permissions", async () => {
    sessionMocks.getCurrentSession.mockResolvedValue({
      user: { id: users.targetA },
    });

    const context = await getCurrentAccessContext();

    expect(context).toMatchObject({
      organizationId: ids.orgA,
      roles: ["finance"],
      userId: users.targetA,
    });
    expect(context?.permissions).toContain("people.read_own");
    expect(context?.permissions).not.toContain("finance.read");
  });

  it("replaces roles and audits before/after in one tenant transaction", async () => {
    const result = await replaceUserRoles(adminContext(), {
      roleKeys: ["employee"],
      userId: users.targetA,
    });

    expect(result).toEqual({
      after: { roleKeys: ["employee"], userId: users.targetA },
      before: { roleKeys: ["finance"], userId: users.targetA },
    });
    await expectRoleKeys(users.targetA, ["employee"]);
    const audit = await adminDb.execute(sql<{
      after: { roleKeys: string[]; userId: string };
      before: { roleKeys: string[]; userId: string };
    }>`
      select after, before
      from audit_logs
      where entity_type = 'user'
        and entity_id = ${users.targetA}
        and action = 'permission_change'
    `);
    expect(audit.rows).toEqual([result]);
  });

  it("protects the last active settings administrator", async () => {
    await expect(
      replaceUserRoles(adminContext(), {
        roleKeys: ["employee"],
        userId: users.adminA,
      }),
    ).rejects.toThrow(lastSettingsAdministratorError);

    await expectRoleKeys(users.adminA, ["technical_admin"]);
    await expectAuditCount(users.adminA, 0);
  });

  it("rejects a known cross-tenant user id without changing or auditing it", async () => {
    await expect(
      replaceUserRoles(adminContext(), {
        roleKeys: ["employee"],
        userId: users.targetB,
      }),
    ).rejects.toMatchObject({ name: "AccessDeniedError" });

    await expectRoleKeys(users.targetB, ["finance"]);
    await expectAuditCount(users.targetB, 0);
  });

  it("rolls back the replacement when the audit write fails", async () => {
    await adminDb.execute(sql.raw(`
      create or replace function acc_004_reject_role_audit()
      returns trigger
      language plpgsql
      as $function$
      begin
        if new.entity_type = 'user'
          and new.entity_id = '${users.rollbackA}'
          and new.action = 'permission_change' then
          raise exception 'ACC-004 forced audit failure';
        end if;
        return new;
      end
      $function$
    `));
    await adminDb.execute(sql.raw(`
      create trigger acc_004_reject_role_audit
      before insert on audit_logs
      for each row execute function acc_004_reject_role_audit()
    `));

    try {
      await expect(
        replaceUserRoles(adminContext(), {
          roleKeys: ["employee"],
          userId: users.rollbackA,
        }),
      ).rejects.toMatchObject({
        cause: expect.objectContaining({
          message: expect.stringContaining("ACC-004 forced audit failure"),
        }),
      });
      await expectRoleKeys(users.rollbackA, ["finance"]);
      await expectAuditCount(users.rollbackA, 0);
    } finally {
      await adminDb.execute(sql.raw(`
        drop trigger if exists acc_004_reject_role_audit on audit_logs
      `));
      await adminDb.execute(sql.raw(`
        drop function if exists acc_004_reject_role_audit()
      `));
    }
  });
});

function adminContext() {
  return createAccessContext({
    organizationId: ids.orgA,
    permissions: ["settings.manage"],
    roles: ["technical_admin"],
    userId: users.adminA,
  });
}

async function expectRoleKeys(userId: string, expected: string[]) {
  const result = await adminDb.execute(sql<{ key: string }>`
    select roles.key
    from user_roles
    inner join roles on roles.id = user_roles.role_id
    where user_roles.user_id = ${userId}
    order by roles.key
  `);
  expect(result.rows.map(({ key }) => key)).toEqual(expected);
}

async function expectAuditCount(userId: string, expected: number) {
  const result = await adminDb.execute(sql<{ count: number }>`
    select count(*)::int as count
    from audit_logs
    where entity_type = 'user'
      and entity_id = ${userId}
      and action = 'permission_change'
  `);
  expect(result.rows[0]?.count).toBe(expected);
}

async function createFixtures() {
  await adminDb.transaction(async (transaction) => {
    await transaction.execute(sql`
      insert into organizations (id, name, slug) values
        (${ids.orgA}, 'ACC-004 Organization A', 'acc-004-organization-a'),
        (${ids.orgB}, 'ACC-004 Organization B', 'acc-004-organization-b')
    `);
    await transaction.execute(sql`
      insert into "user" (
        id, organization_id, name, email, email_verified, access_status, is_active
      ) values
        (${users.adminA}, ${ids.orgA}, 'ACC-004 Admin A', 'acc-004-admin-a@example.test', true, 'active', true),
        (${users.rollbackA}, ${ids.orgA}, 'ACC-004 Rollback A', 'acc-004-rollback-a@example.test', true, 'active', true),
        (${users.targetA}, ${ids.orgA}, 'ACC-004 Target A', 'acc-004-target-a@example.test', true, 'active', true),
        (${users.targetB}, ${ids.orgB}, 'ACC-004 Target B', 'acc-004-target-b@example.test', true, 'active', true)
    `);
    await transaction.execute(sql`
      insert into roles (key, name) values
        ('technical_admin', 'Admin Tecnico'),
        ('finance', 'Financeiro'),
        ('employee', 'Colaborador')
      on conflict (key) do nothing
    `);
    await transaction.execute(sql`
      insert into permissions (key, description) values
        ('settings.manage', 'Gerenciar configuracoes'),
        ('people.read_own', 'Visualizar proprio cadastro')
      on conflict (key) do nothing
    `);
    await transaction.execute(sql`
      insert into role_permissions (role_id, permission_id)
      select roles.id, permissions.id
      from (
        values
          ('technical_admin', 'settings.manage'),
          ('finance', 'people.read_own'),
          ('employee', 'people.read_own')
      ) as grant_row(role_key, permission_key)
      inner join roles on roles.key = grant_row.role_key
      inner join permissions on permissions.key = grant_row.permission_key
      on conflict do nothing
    `);
  });
}

async function removeFixtures() {
  await adminDb?.transaction(async (transaction) => {
    await transaction.execute(sql`
      delete from audit_logs
      where entity_type = 'user'
        and entity_id in (
          ${users.adminA}, ${users.rollbackA}, ${users.targetA}, ${users.targetB}
        )
    `);
    await transaction.execute(sql`
      delete from user_roles
      where user_id in (
        ${users.adminA}, ${users.rollbackA}, ${users.targetA}, ${users.targetB}
      )
    `);
    await transaction.execute(sql`
      delete from "user"
      where id in (
        ${users.adminA}, ${users.rollbackA}, ${users.targetA}, ${users.targetB}
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
    return;
  }

  process.env[name] = value;
}
