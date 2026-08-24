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
    enforceAuthenticatedRateLimit:
      actionMocks.enforceAuthenticatedRateLimit,
  };
});

import {
  AccessInvitationAuthError,
  assertSessionUserIsAuthorized,
  consumeInvitationForUser,
  findValidInvitationForEmail,
  invitationAuthErrorCodes,
} from "@/features/access-invitations/auth";
import { updateSettingsUserStatusAction } from "@/features/settings/actions";
import {
  createDatabase,
  createWithTenantDb,
  getDb,
  type Database,
} from "@/lib/db";
import type { AccessContext } from "@/lib/dal";

const runtimeUrl = process.env.DATABASE_TEST_URL;
const adminUrl = process.env.DATABASE_TEST_ADMIN_URL;

if (!runtimeUrl || !adminUrl) {
  throw new Error(
    "DATABASE_TEST_URL and DATABASE_TEST_ADMIN_URL are required for the access invitation suite.",
  );
}

const ids = {
  orgA: "60000000-0000-4000-8000-000000000001",
  orgB: "60000000-0000-4000-8000-000000000002",
  invitationValid: "61000000-0000-4000-8000-000000000001",
  invitationExpired: "61000000-0000-4000-8000-000000000002",
  invitationUsed: "61000000-0000-4000-8000-000000000003",
  invitationConsume: "61000000-0000-4000-8000-000000000004",
  invitationOrgB: "61000000-0000-4000-8000-000000000005",
  roleFallback: "62000000-0000-4000-8000-000000000001",
  roleSettingsManager: "62000000-0000-4000-8000-000000000002",
} as const;
const users = {
  inviterA: "acc-001-inviter-a",
  inviterB: "acc-001-inviter-b",
  invitee: "acc-001-invitee",
  legacyWriter: "acc-002-legacy-writer",
  rollbackTarget: "acc-002-rollback-target",
  suspendable: "acc-002-suspendable",
  used: "acc-001-used-user",
  unauthorized: "acc-001-unauthorized",
} as const;
const emails = {
  valid: "acc-001-valid@example.test",
  expired: "acc-001-expired@example.test",
  used: "acc-001-used@example.test",
  consume: "acc-001-consume@example.test",
  legacyWriter: "acc-002-legacy-writer@example.test",
  orgB: "acc-001-org-b@example.test",
  rollbackTarget: "acc-002-rollback-target@example.test",
  suspendable: "acc-002-suspendable@example.test",
  unauthorized: "acc-001-unauthorized@example.test",
} as const;
const contextA: AccessContext = {
  employeeId: null,
  organizationId: ids.orgA,
  permissions: [],
  roles: [],
  userId: users.inviterA,
};

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

afterAll(async () => {
  if (adminDb) {
    await removeFixtures();
  }
  await Promise.all([
    runtimeDb?.$client.end(),
    adminDb?.$client.end(),
    getDb().$client.end(),
  ]);
  restoreEnvironmentVariable("DATABASE_URL", originalDatabaseUrl);
});

describe("access invitation authentication", () => {
  beforeEach(() => {
    actionMocks.getCurrentSession.mockResolvedValue({
      user: { id: users.inviterA },
    });
  });

  it("keeps expand defaults compatible with the previous invitation writer", async () => {
    const userRows = await adminDb.execute(sql<{
      accessStatus: string;
      isActive: boolean;
    }>`
      select
        access_status as "accessStatus",
        is_active as "isActive"
      from "user"
      where id = ${users.legacyWriter}
    `);

    expect(userRows.rows).toEqual([
      {
        accessStatus: "active",
        isActive: true,
      },
    ]);
    await expect(
      assertSessionUserIsAuthorized(users.legacyWriter),
    ).resolves.toBeUndefined();
  });

  it("finds only a matching, unused, unexpired invitation", async () => {
    await expect(
      findValidInvitationForEmail(`  ${emails.valid.toUpperCase()}  `),
    ).resolves.toEqual({
      id: ids.invitationValid,
      organizationId: ids.orgA,
    });
    await expect(
      findValidInvitationForEmail(emails.expired),
    ).resolves.toBeNull();
    await expect(
      findValidInvitationForEmail(emails.used),
    ).resolves.toBeNull();
    await expect(
      findValidInvitationForEmail("acc-001-missing@example.test"),
    ).resolves.toBeNull();
  });

  it("upgrades a same-organization legacy account exactly once and audits it", async () => {
    await expect(
      assertSessionUserIsAuthorized(users.invitee),
    ).rejects.toMatchObject({
      code: invitationAuthErrorCodes.unauthorizedSession,
    });

    const attempts = await Promise.allSettled([
      consumeInvitationForUser({
        email: emails.consume,
        organizationId: ids.orgA,
        userId: users.invitee,
      }),
      consumeInvitationForUser({
        email: emails.consume,
        organizationId: ids.orgA,
        userId: users.invitee,
      }),
    ]);

    expect(attempts.filter(({ status }) => status === "fulfilled")).toHaveLength(
      1,
    );
    const rejection = attempts.find(
      ({ status }) => status === "rejected",
    ) as PromiseRejectedResult;
    expect(rejection.reason).toBeInstanceOf(AccessInvitationAuthError);
    expect(rejection.reason).toMatchObject({
      code: invitationAuthErrorCodes.required,
    });
    await expect(
      assertSessionUserIsAuthorized(users.invitee),
    ).resolves.toBeUndefined();

    const invitationRows = await adminDb.execute(sql<{
      usedByUserId: string | null;
      usedAt: Date | null;
    }>`
      select
        used_by_user_id as "usedByUserId",
        used_at as "usedAt"
      from access_invitations
      where id = ${ids.invitationConsume}
    `);
    expect(invitationRows.rows[0]).toMatchObject({
      usedByUserId: users.invitee,
    });
    expect(invitationRows.rows[0]?.usedAt).not.toBeNull();

    const userRows = await adminDb.execute(sql<{
      organizationId: string | null;
      roleCount: number;
    }>`
      select
        u.organization_id as "organizationId",
        count(ur.role_id)::int as "roleCount"
      from "user" as u
      left join user_roles as ur on ur.user_id = u.id
      where u.id = ${users.invitee}
      group by u.id
    `);
    expect(userRows.rows[0]).toEqual({
      organizationId: ids.orgA,
      roleCount: 1,
    });

    const auditRows = await adminDb.execute(sql<{
      event: string | null;
      organizationId: string;
    }>`
      select
        metadata->>'event' as event,
        organization_id as "organizationId"
      from audit_logs
      where entity_type = 'access_invitation'
        and entity_id = ${ids.invitationConsume}
    `);
    expect(auditRows.rows).toEqual([
      {
        event: "accepted",
        organizationId: ids.orgA,
      },
    ]);
  });

  it("suspends through the settings Action, audits it, and denies the existing session", async () => {
    await expect(
      assertSessionUserIsAuthorized(users.suspendable),
    ).resolves.toBeUndefined();

    const formData = new FormData();
    formData.set("userId", users.suspendable);
    formData.set("accessStatus", "suspended");

    await expect(updateSettingsUserStatusAction(formData)).resolves.toEqual({
      data: undefined,
      ok: true,
    });

    const suspendedRows = await adminDb.execute(sql<{
      accessStatus: string;
      isActive: boolean;
    }>`
      select
        access_status as "accessStatus",
        is_active as "isActive"
      from "user"
      where id = ${users.suspendable}
    `);
    expect(suspendedRows.rows).toEqual([
      {
        accessStatus: "suspended",
        isActive: false,
      },
    ]);

    const auditRows = await adminDb.execute(sql<{
      action: string;
      actorUserId: string | null;
      afterAccessStatus: string | null;
      afterIsActive: string | null;
      beforeAccessStatus: string | null;
      beforeIsActive: string | null;
      metadataAccessStatus: string | null;
      organizationId: string;
    }>`
      select
        action,
        actor_user_id as "actorUserId",
        after->>'accessStatus' as "afterAccessStatus",
        after->>'isActive' as "afterIsActive",
        before->>'accessStatus' as "beforeAccessStatus",
        before->>'isActive' as "beforeIsActive",
        metadata->>'accessStatus' as "metadataAccessStatus",
        organization_id as "organizationId"
      from audit_logs
      where entity_type = 'user'
        and entity_id = ${users.suspendable}
    `);
    expect(auditRows.rows).toEqual([
      {
        action: "status_change",
        actorUserId: users.inviterA,
        afterAccessStatus: "suspended",
        afterIsActive: "false",
        beforeAccessStatus: "active",
        beforeIsActive: "true",
        metadataAccessStatus: "suspended",
        organizationId: ids.orgA,
      },
    ]);

    await expect(
      assertSessionUserIsAuthorized(users.suspendable),
    ).rejects.toMatchObject({
      code: invitationAuthErrorCodes.inactiveSession,
    });
  });

  it("rejects a status change without settings.manage and leaves no audit", async () => {
    actionMocks.getCurrentSession.mockResolvedValue({
      user: { id: users.legacyWriter },
    });
    const formData = new FormData();
    formData.set("userId", users.inviterA);
    formData.set("accessStatus", "suspended");

    await expect(updateSettingsUserStatusAction(formData)).rejects.toMatchObject({
      name: "AccessDeniedError",
    });

    await expectUserStatusAndAudit(users.inviterA, "active", true, 0);
  });

  it("rejects a cross-tenant target ID and leaves no mutation or audit", async () => {
    const formData = new FormData();
    formData.set("userId", users.inviterB);
    formData.set("accessStatus", "suspended");

    await expect(updateSettingsUserStatusAction(formData)).rejects.toMatchObject({
      name: "AccessDeniedError",
    });

    await expectUserStatusAndAudit(users.inviterB, "active", true, 0);
  });

  it("rolls back the status write when its transactional audit insert fails", async () => {
    await adminDb.execute(sql.raw(`
      create or replace function acc_002_reject_status_audit()
      returns trigger
      language plpgsql
      as $function$
      begin
        if new.entity_type = 'user'
          and new.entity_id = '${users.rollbackTarget}' then
          raise exception 'ACC-002 forced audit failure';
        end if;
        return new;
      end
      $function$
    `));
    await adminDb.execute(sql.raw(`
      create trigger acc_002_reject_status_audit
      before insert on audit_logs
      for each row execute function acc_002_reject_status_audit()
    `));

    try {
      const formData = new FormData();
      formData.set("userId", users.rollbackTarget);
      formData.set("accessStatus", "suspended");

      await expect(updateSettingsUserStatusAction(formData)).rejects.toMatchObject({
        cause: expect.objectContaining({
          message: expect.stringContaining("ACC-002 forced audit failure"),
        }),
      });

      await expectUserStatusAndAudit(
        users.rollbackTarget,
        "active",
        true,
        0,
      );
    } finally {
      await adminDb.execute(sql.raw(`
        drop trigger if exists acc_002_reject_status_audit on audit_logs
      `));
      await adminDb.execute(sql.raw(`
        drop function if exists acc_002_reject_status_audit()
      `));
    }
  });
});

describe("ACC-002 migration upgrade", () => {
  it("backfills legacy booleans and preserves the previous writer defaults", async () => {
    const schemaName = "acc_002_upgrade";
    await adminDb.execute(
      sql.raw(`drop schema if exists ${schemaName} cascade`),
    );

    try {
      await adminDb.execute(sql.raw(`create schema ${schemaName}`));
      await adminDb.execute(sql.raw(`
        create table ${schemaName}."user" (
          id text primary key,
          is_active boolean default true not null
        )
      `));
      await adminDb.execute(sql.raw(`
        insert into ${schemaName}."user" (id, is_active) values
          ('legacy-active', true),
          ('legacy-inactive', false)
      `));

      const migrationPath = new URL(
        "../../drizzle/0012_windy_ikaris.sql",
        import.meta.url,
      );
      const migration = (await readFile(migrationPath, "utf8")).replace(
        'CREATE TYPE "public"."user_access_status"',
        'CREATE TYPE "user_access_status"',
      );

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

        await transaction.execute(sql.raw(`
          insert into "user" (id) values ('previous-writer')
        `));
      });

      const rows = await adminDb.execute(sql<{
        accessStatus: string;
        id: string;
        isActive: boolean;
      }>`
        select
          id,
          access_status as "accessStatus",
          is_active as "isActive"
        from acc_002_upgrade."user"
        order by id
      `);

      expect(rows.rows).toEqual([
        {
          accessStatus: "active",
          id: "legacy-active",
          isActive: true,
        },
        {
          accessStatus: "suspended",
          id: "legacy-inactive",
          isActive: false,
        },
        {
          accessStatus: "active",
          id: "previous-writer",
          isActive: true,
        },
      ]);
    } finally {
      await adminDb.execute(
        sql.raw(`drop schema if exists ${schemaName} cascade`),
      );
    }
  });
});

describe("access invitation RLS", () => {
  it("allows pre-auth lookup but not insert, update, or delete", async () => {
    await runtimeDb.transaction(async (transaction) => {
      await transaction.execute(sql`
        select set_config('app.invitation_email', ${emails.valid}, true)
      `);

      const visible = await transaction.execute(sql<{ id: string }>`
        select id from access_invitations order by id
      `);
      expect(visible.rows).toEqual([{ id: ids.invitationValid }]);

      const updated = await transaction.execute(sql<{ id: string }>`
        update access_invitations
        set organization_id = ${ids.orgB}
        where id = ${ids.invitationValid}
        returning id
      `);
      const deleted = await transaction.execute(sql<{ id: string }>`
        delete from access_invitations
        where id = ${ids.invitationValid}
        returning id
      `);
      expect(updated.rows).toHaveLength(0);
      expect(deleted.rows).toHaveLength(0);

      await expect(
        transaction.execute(sql`
          insert into access_invitations (
            organization_id, email, role_keys, expires_at, invited_by_user_id
          ) values (
            ${ids.orgA},
            'acc-001-preauth-insert@example.test',
            '["employee"]'::jsonb,
            now() + interval '1 day',
            ${users.inviterA}
          )
        `),
      ).rejects.toMatchObject({
        cause: expect.objectContaining({ code: "42501" }),
      });
    });
  });

  it("isolates tenant reads and writes from another organization", async () => {
    const withTenantDb = createWithTenantDb(runtimeDb);

    await withTenantDb(contextA, async (transaction) => {
      const own = await transaction.execute(sql<{ id: string }>`
        select id from access_invitations where id = ${ids.invitationValid}
      `);
      const other = await transaction.execute(sql<{ id: string }>`
        select id from access_invitations where id = ${ids.invitationOrgB}
      `);
      const tampered = await transaction.execute(sql<{ id: string }>`
        update access_invitations
        set expires_at = now() + interval '30 days'
        where id = ${ids.invitationOrgB}
        returning id
      `);

      expect(own.rows).toHaveLength(1);
      expect(other.rows).toHaveLength(0);
      expect(tampered.rows).toHaveLength(0);
    });
  });

  it("exposes the corrected final policy contract after fresh or upgrade migration", async () => {
    const result = await adminDb.execute(sql<{
      checkExpression: string | null;
      command: string;
      policyName: string;
      usingExpression: string | null;
    }>`
      select
        policyname as "policyName",
        cmd as command,
        qual as "usingExpression",
        with_check as "checkExpression"
      from pg_policies
      where schemaname = 'public'
        and tablename = 'access_invitations'
      order by policyname
    `);

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      checkExpression: null,
      command: "SELECT",
      policyName: "access_invitations_pre_auth_lookup",
    });
    expect(result.rows[0]?.usingExpression).toContain(
      "app.invitation_email",
    );
    expect(result.rows[1]).toMatchObject({
      command: "ALL",
      policyName: "access_invitations_tenant_isolation",
    });
    expect(result.rows[1]?.usingExpression).not.toContain(
      "app.invitation_email",
    );
    expect(result.rows[1]?.checkExpression).not.toContain(
      "app.invitation_email",
    );
  });

  it("upgrades the legacy policy without losing existing invitation rows", async () => {
    const schemaName = "acc_001_upgrade";
    await adminDb.execute(
      sql.raw(`drop schema if exists ${schemaName} cascade`),
    );

    try {
      await adminDb.execute(sql.raw(`create schema ${schemaName}`));
      await adminDb.execute(sql.raw(`
        create table ${schemaName}.access_invitations
        (like public.access_invitations including all)
      `));
      await adminDb.execute(sql.raw(`
        alter table ${schemaName}.access_invitations enable row level security
      `));
      await adminDb.execute(sql.raw(`
        alter table ${schemaName}.access_invitations force row level security
      `));
      await adminDb.execute(sql.raw(`
        create policy access_invitations_tenant_isolation
        on ${schemaName}.access_invitations
        for all to public
        using (
          organization_id =
            nullif(current_setting('app.organization_id', true), '')::uuid
          or email = nullif(current_setting('app.invitation_email', true), '')
        )
        with check (
          organization_id =
            nullif(current_setting('app.organization_id', true), '')::uuid
          or email = nullif(current_setting('app.invitation_email', true), '')
        )
      `));
      await adminDb.execute(sql.raw(`
        insert into ${schemaName}.access_invitations (
          id, organization_id, email, role_keys, expires_at, invited_by_user_id
        ) values (
          '63000000-0000-4000-8000-000000000001',
          '${ids.orgA}',
          'acc-001-upgrade@example.test',
          '["employee"]'::jsonb,
          now() + interval '1 day',
          '${users.inviterA}'
        )
      `));

      const migrationPath = new URL(
        "../../drizzle/0011_invitation_select_only.sql",
        import.meta.url,
      );
      const migration = (await readFile(migrationPath, "utf8")).replaceAll(
        '"access_invitations"',
        `"${schemaName}"."access_invitations"`,
      );

      for (const statement of migration
        .split("--> statement-breakpoint")
        .map((value) => value.trim())
        .filter(Boolean)) {
        await adminDb.execute(sql.raw(statement));
      }

      const rows = await adminDb.execute(sql<{ count: number }>`
        select count(*)::int as count
        from acc_001_upgrade.access_invitations
      `);
      const policies = await adminDb.execute(sql<{
        command: string;
        policyName: string;
      }>`
        select policyname as "policyName", cmd as command
        from pg_policies
        where schemaname = ${schemaName}
          and tablename = 'access_invitations'
        order by policyname
      `);

      expect(rows.rows).toEqual([{ count: 1 }]);
      expect(policies.rows).toEqual([
        {
          command: "SELECT",
          policyName: "access_invitations_pre_auth_lookup",
        },
        {
          command: "ALL",
          policyName: "access_invitations_tenant_isolation",
        },
      ]);
    } finally {
      await adminDb.execute(
        sql.raw(`drop schema if exists ${schemaName} cascade`),
      );
    }
  });
});

async function createFixtures() {
  await adminDb.transaction(async (transaction) => {
    await transaction.execute(sql`
      insert into organizations (id, name, slug) values
        (${ids.orgA}, 'ACC-001 Organization A', 'acc-001-organization-a'),
        (${ids.orgB}, 'ACC-001 Organization B', 'acc-001-organization-b')
    `);
    await transaction.execute(sql`
      insert into "user" (
        id, organization_id, name, email, email_verified,
        access_status, is_active
      ) values
        (
          ${users.inviterA}, ${ids.orgA}, 'ACC-001 Inviter A',
          'acc-001-inviter-a@example.test', true, 'active', true
        ),
        (
          ${users.inviterB}, ${ids.orgB}, 'ACC-001 Inviter B',
          'acc-001-inviter-b@example.test', true, 'active', true
        ),
        (
          ${users.invitee}, ${ids.orgA}, 'ACC-001 Legacy Invitee',
          ${emails.consume}, true, 'active', true
        ),
        (
          ${users.suspendable}, ${ids.orgA}, 'ACC-002 Suspendable',
          ${emails.suspendable}, true, 'active', true
        ),
        (
          ${users.rollbackTarget}, ${ids.orgA}, 'ACC-002 Rollback Target',
          ${emails.rollbackTarget}, true, 'active', true
        ),
        (
          ${users.used}, ${ids.orgA}, 'ACC-001 Used',
          ${emails.used}, true, 'active', true
        ),
        (
          ${users.unauthorized}, null, 'ACC-001 Unauthorized',
          ${emails.unauthorized}, true, 'active', true
        )
    `);
    await transaction.execute(sql`
      insert into roles (id, key, name) values
        (${ids.roleFallback}, 'employee', 'Colaborador'),
        (${ids.roleSettingsManager}, 'technical_admin', 'Admin Tecnico')
      on conflict (key) do nothing
    `);
    await transaction.execute(sql`
      insert into "user" (
        id, organization_id, name, email, email_verified
      ) values (
        ${users.legacyWriter}, ${ids.orgA}, 'ACC-002 Legacy Writer',
        ${emails.legacyWriter}, true
      )
    `);
    await transaction.execute(sql`
      insert into user_roles (user_id, role_id, assigned_by_user_id)
      select fixture.user_id, roles.id, ${users.inviterA}
      from (
        values
          (${users.legacyWriter}, 'employee'),
          (${users.suspendable}, 'employee'),
          (${users.inviterA}, 'technical_admin')
      ) as fixture(user_id, role_key)
      inner join roles on roles.key = fixture.role_key
    `);
    await transaction.execute(sql`
      insert into access_invitations (
        id, organization_id, email, role_keys, expires_at,
        used_at, invited_by_user_id, used_by_user_id
      ) values
        (
          ${ids.invitationValid}, ${ids.orgA}, ${emails.valid},
          '["employee"]'::jsonb, now() + interval '1 day',
          null, ${users.inviterA}, null
        ),
        (
          ${ids.invitationExpired}, ${ids.orgA}, ${emails.expired},
          '["employee"]'::jsonb, now() - interval '1 second',
          null, ${users.inviterA}, null
        ),
        (
          ${ids.invitationUsed}, ${ids.orgA}, ${emails.used},
          '["employee"]'::jsonb, now() + interval '1 day',
          now(), ${users.inviterA}, ${users.used}
        ),
        (
          ${ids.invitationConsume}, ${ids.orgA}, ${emails.consume},
          '["employee"]'::jsonb, now() + interval '1 day',
          null, ${users.inviterA}, null
        ),
        (
          ${ids.invitationOrgB}, ${ids.orgB}, ${emails.orgB},
          '["employee"]'::jsonb, now() + interval '1 day',
          null, ${users.inviterB}, null
        )
    `);
  });
}

async function removeFixtures() {
  await adminDb.transaction(async (transaction) => {
    await transaction.execute(sql`
      delete from audit_logs
      where entity_type = 'user'
        and entity_id in (
          ${users.inviterA},
          ${users.inviterB},
          ${users.rollbackTarget},
          ${users.suspendable}
        )
    `);
    await transaction.execute(sql`
      delete from audit_logs
      where entity_type = 'access_invitation'
        and entity_id in (
          ${ids.invitationValid},
          ${ids.invitationExpired},
          ${ids.invitationUsed},
          ${ids.invitationConsume},
          ${ids.invitationOrgB}
        )
    `);
    await transaction.execute(sql`
      delete from access_invitations
      where organization_id in (${ids.orgA}, ${ids.orgB})
    `);
    await transaction.execute(sql`
      delete from user_roles
      where user_id in (
        ${users.inviterA},
        ${users.inviterB},
        ${users.invitee},
        ${users.legacyWriter},
        ${users.rollbackTarget},
        ${users.suspendable},
        ${users.used},
        ${users.unauthorized}
      )
    `);
    await transaction.execute(sql`
      delete from "user"
      where id in (
        ${users.inviterA},
        ${users.inviterB},
        ${users.invitee},
        ${users.legacyWriter},
        ${users.rollbackTarget},
        ${users.suspendable},
        ${users.used},
        ${users.unauthorized}
      )
    `);
    await transaction.execute(sql`
      delete from organizations where id in (${ids.orgA}, ${ids.orgB})
    `);
    await transaction.execute(sql`
      delete from roles
      where id in (${ids.roleFallback}, ${ids.roleSettingsManager})
        and not exists (
          select 1 from user_roles where role_id = roles.id
        )
    `);
  });
}

async function expectUserStatusAndAudit(
  userId: string,
  accessStatus: string,
  isActive: boolean,
  auditCount: number,
) {
  const rows = await adminDb.execute(sql<{
    accessStatus: string;
    auditCount: number;
    isActive: boolean;
  }>`
    select
      u.access_status as "accessStatus",
      u.is_active as "isActive",
      count(a.id)::int as "auditCount"
    from "user" as u
    left join audit_logs as a
      on a.entity_type = 'user'
      and a.entity_id = u.id
    where u.id = ${userId}
    group by u.id
  `);

  expect(rows.rows).toEqual([{ accessStatus, auditCount, isActive }]);
}

function restoreEnvironmentVariable(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
