import { makeSignature } from "better-auth/crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { terminateEmployeeAndRevokeSessions } from "@/features/lifecycle/offboarding-access";
import { updateUserAccessStatus } from "@/features/settings/access";
import {
  createDatabase,
  createWithTenantDb,
  getDb,
  type Database,
} from "@/lib/db";
import { areas, employees, positions } from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";

const runtimeUrl = process.env.DATABASE_TEST_URL;
const adminUrl = process.env.DATABASE_TEST_ADMIN_URL;

if (!runtimeUrl || !adminUrl) {
  throw new Error(
    "DATABASE_TEST_URL and DATABASE_TEST_ADMIN_URL are required for the session revocation suite.",
  );
}

const authSecret = "acc-005-integration-secret-at-least-32-characters";
const ids = {
  areaA: "69000000-0000-4000-8000-000000000011",
  employeeA: "69000000-0000-4000-8000-000000000013",
  orgA: "69000000-0000-4000-8000-000000000001",
  orgB: "69000000-0000-4000-8000-000000000002",
  positionA: "69000000-0000-4000-8000-000000000012",
} as const;
const users = {
  actorA: "acc-005-actor-a",
  targetA: "acc-005-target-a",
  targetB: "acc-005-target-b",
} as const;
const targetSessionTokens = [
  "acc-005-target-session-token-1",
  "acc-005-target-session-token-2",
] as const;
const otherTenantSessionToken = "acc-005-other-tenant-session-token";
const contextA: AccessContext = {
  employeeId: null,
  organizationId: ids.orgA,
  permissions: ["settings.manage"],
  roles: [],
  userId: users.actorA,
};

let runtimeDb: Database;
let adminDb: Database;
let auth: (typeof import("@/lib/auth"))["auth"];
let originalAuthBaseUrl: string | undefined;
let originalAuthSecret: string | undefined;
let originalDatabaseUrl: string | undefined;

beforeAll(async () => {
  originalAuthBaseUrl = process.env.BETTER_AUTH_URL;
  originalAuthSecret = process.env.BETTER_AUTH_SECRET;
  originalDatabaseUrl = process.env.DATABASE_URL;
  process.env.BETTER_AUTH_SECRET = authSecret;
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
  process.env.DATABASE_URL = runtimeUrl;

  runtimeDb = createDatabase(runtimeUrl, { allowExitOnIdle: true, max: 4 });
  adminDb = createDatabase(adminUrl, { allowExitOnIdle: true, max: 1 });
  ({ auth } = await import("@/lib/auth"));

  await removeFixtures();
  await createFixtures();
  await createOffboardingFixtures();
});

beforeEach(async () => {
  await resetMutableFixtures();
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
  restoreEnvironmentVariable("BETTER_AUTH_URL", originalAuthBaseUrl);
  restoreEnvironmentVariable("BETTER_AUTH_SECRET", originalAuthSecret);
  restoreEnvironmentVariable("DATABASE_URL", originalDatabaseUrl);
});

describe("ACC-005 session revocation", () => {
  it.each(["suspended", "revoked"] as const)(
    "%s invalidates every target session in the status transaction",
    async (accessStatus) => {
      await updateUserAccessStatus(contextA, {
        accessStatus,
        userId: users.targetA,
      });

      const targetRows = await adminDb.execute(sql<{
        accessStatus: string;
        isActive: boolean;
      }>`
        select
          access_status as "accessStatus",
          is_active as "isActive"
        from "user"
        where id = ${users.targetA}
      `);
      const sessionRows = await listSessionTokens();
      const auditRows = await adminDb.execute(sql<{
        accessStatus: string | null;
        revokedSessionCount: string | null;
      }>`
        select
          metadata->>'accessStatus' as "accessStatus",
          metadata->>'revokedSessionCount' as "revokedSessionCount"
        from audit_logs
        where entity_type = 'user'
          and entity_id = ${users.targetA}
      `);

      expect(targetRows.rows).toEqual([{ accessStatus, isActive: false }]);
      expect(sessionRows).toEqual([otherTenantSessionToken]);
      expect(auditRows.rows).toEqual([
        {
          accessStatus,
          revokedSessionCount: "2",
        },
      ]);
    },
  );

  it("does not revoke sessions when the target remains active", async () => {
    await updateUserAccessStatus(contextA, {
      accessStatus: "active",
      userId: users.targetA,
    });

    await expect(listSessionTokens()).resolves.toEqual([
      otherTenantSessionToken,
      ...targetSessionTokens,
    ]);
  });

  it("offboarding termination revokes sessions for the linked employee user", async () => {
    const withTenantDb = createWithTenantDb(runtimeDb);

    await expect(
      withTenantDb(contextA, (transaction) =>
        terminateEmployeeAndRevokeSessions(transaction, {
          employeeId: ids.employeeA,
          endDate: "2026-08-24",
          organizationId: ids.orgA,
        }),
      ),
    ).resolves.toBe(2);

    const employeeRows = await adminDb
      .select({
        endDate: employees.endDate,
        status: employees.status,
      })
      .from(employees)
      .where(eq(employees.id, ids.employeeA));

    expect(employeeRows).toEqual([
      { endDate: "2026-08-24", status: "terminated" },
    ]);
    await expect(listSessionTokens()).resolves.toEqual([
      otherTenantSessionToken,
    ]);
  });

  it("rolls back offboarding termination and session revocation together", async () => {
    const withTenantDb = createWithTenantDb(runtimeDb);

    await expect(
      withTenantDb(contextA, async (transaction) => {
        await terminateEmployeeAndRevokeSessions(transaction, {
          employeeId: ids.employeeA,
          endDate: "2026-08-24",
          organizationId: ids.orgA,
        });
        throw new Error("force offboarding rollback");
      }),
    ).rejects.toThrow("force offboarding rollback");

    const employeeRows = await adminDb
      .select({
        endDate: employees.endDate,
        status: employees.status,
      })
      .from(employees)
      .where(eq(employees.id, ids.employeeA));

    expect(employeeRows).toEqual([{ endDate: null, status: "active" }]);
    await expect(listSessionTokens()).resolves.toEqual([
      otherTenantSessionToken,
      ...targetSessionTokens,
    ]);
  });

  it("rejects a cross-tenant target without revoking any session", async () => {
    await expect(
      updateUserAccessStatus(contextA, {
        accessStatus: "revoked",
        userId: users.targetB,
      }),
    ).rejects.toMatchObject({ name: "AccessDeniedError" });

    await expect(listSessionTokens()).resolves.toEqual([
      otherTenantSessionToken,
      ...targetSessionTokens,
    ]);
  });

  it("rolls back the status and session deletions when audit fails", async () => {
    await adminDb.execute(
      sql.raw(`
      create or replace function acc_005_reject_status_audit()
      returns trigger
      language plpgsql
      as $function$
      begin
        if new.entity_type = 'user'
          and new.entity_id = '${users.targetA}' then
          raise exception 'ACC-005 forced audit failure';
        end if;
        return new;
      end
      $function$
    `),
    );
    await adminDb.execute(
      sql.raw(`
      create trigger acc_005_reject_status_audit
      before insert on audit_logs
      for each row execute function acc_005_reject_status_audit()
    `),
    );

    try {
      await expect(
        updateUserAccessStatus(contextA, {
          accessStatus: "suspended",
          userId: users.targetA,
        }),
      ).rejects.toMatchObject({
        cause: expect.objectContaining({
          message: expect.stringContaining("ACC-005 forced audit failure"),
        }),
      });

      const targetRows = await adminDb.execute(sql<{
        accessStatus: string;
        isActive: boolean;
      }>`
        select
          access_status as "accessStatus",
          is_active as "isActive"
        from "user"
        where id = ${users.targetA}
      `);

      expect(targetRows.rows).toEqual([
        { accessStatus: "active", isActive: true },
      ]);
      await expect(listSessionTokens()).resolves.toEqual([
        otherTenantSessionToken,
        ...targetSessionTokens,
      ]);
    } finally {
      await adminDb.execute(
        sql.raw(`
        drop trigger if exists acc_005_reject_status_audit on audit_logs
      `),
      );
      await adminDb.execute(
        sql.raw(`
        drop function if exists acc_005_reject_status_audit()
      `),
      );
    }
  });

  it("rejects a stale cookie after the user is revoked", async () => {
    const headers = await createSessionHeaders(targetSessionTokens[0]);

    await expect(
      auth.api.getSession({
        headers,
        query: { disableCookieCache: true },
      }),
    ).resolves.toMatchObject({ user: { id: users.targetA } });

    await updateUserAccessStatus(contextA, {
      accessStatus: "revoked",
      userId: users.targetA,
    });

    await expect(
      auth.api.getSession({
        headers,
        query: { disableCookieCache: true },
      }),
    ).resolves.toBeNull();
  });

  it("logout deletes the current session, clears its cookie, and rejects reuse", async () => {
    const headers = await createSessionHeaders(targetSessionTokens[0]);

    const logout = await auth.api.signOut({
      headers,
      returnHeaders: true,
    });

    expect(logout.response).toEqual({ success: true });
    expect(logout.headers.get("set-cookie")).toContain(
      "better-auth.session_token=",
    );
    expect(logout.headers.get("set-cookie")).toContain("Max-Age=0");
    await expect(listSessionTokens()).resolves.toEqual([
      otherTenantSessionToken,
      targetSessionTokens[1],
    ]);
    await expect(
      auth.api.getSession({
        headers,
        query: { disableCookieCache: true },
      }),
    ).resolves.toBeNull();
  });
});

async function createFixtures() {
  await adminDb.transaction(async (transaction) => {
    await transaction.execute(sql`
      insert into organizations (id, name, slug) values
        (${ids.orgA}, 'ACC-005 Organization A', 'acc-005-organization-a'),
        (${ids.orgB}, 'ACC-005 Organization B', 'acc-005-organization-b')
    `);
    await transaction.execute(sql`
      insert into "user" (
        id, organization_id, name, email, email_verified,
        access_status, is_active
      ) values
        (
          ${users.actorA}, ${ids.orgA}, 'ACC-005 Actor A',
          'acc-005-actor-a@example.test', true, 'active', true
        ),
        (
          ${users.targetA}, ${ids.orgA}, 'ACC-005 Target A',
          'acc-005-target-a@example.test', true, 'active', true
        ),
        (
          ${users.targetB}, ${ids.orgB}, 'ACC-005 Target B',
          'acc-005-target-b@example.test', true, 'active', true
        )
    `);
  });
}

async function resetMutableFixtures() {
  await adminDb
    .update(employees)
    .set({
      endDate: null,
      status: "active",
      updatedAt: new Date(),
    })
    .where(eq(employees.id, ids.employeeA));

  await adminDb.transaction(async (transaction) => {
    await transaction.execute(sql`
      delete from audit_logs
      where entity_type = 'user'
        and entity_id in (${users.targetA}, ${users.targetB})
    `);
    await transaction.execute(sql`
      delete from "session"
      where user_id in (${users.targetA}, ${users.targetB})
    `);
    await transaction.execute(sql`
      update "user"
      set access_status = 'active', is_active = true, updated_at = now()
      where id in (${users.targetA}, ${users.targetB})
    `);
    await transaction.execute(sql`
      insert into "session" (
        id, user_id, token, expires_at, ip_address, user_agent
      ) values
        (
          'acc-005-session-1', ${users.targetA}, ${targetSessionTokens[0]},
          now() + interval '1 hour', '192.0.2.1', 'ACC-005 test'
        ),
        (
          'acc-005-session-2', ${users.targetA}, ${targetSessionTokens[1]},
          now() + interval '1 hour', '192.0.2.2', 'ACC-005 test'
        ),
        (
          'acc-005-session-3', ${users.targetB}, ${otherTenantSessionToken},
          now() + interval '1 hour', '192.0.2.3', 'ACC-005 test'
        )
    `);
  });
}

async function removeFixtures() {
  await adminDb?.delete(employees).where(eq(employees.id, ids.employeeA));
  await adminDb?.delete(positions).where(eq(positions.id, ids.positionA));
  await adminDb?.delete(areas).where(eq(areas.id, ids.areaA));

  await adminDb.transaction(async (transaction) => {
    await transaction.execute(sql`
      delete from audit_logs
      where entity_type = 'user'
        and entity_id in (${users.targetA}, ${users.targetB})
    `);
    await transaction.execute(sql`
      delete from "session"
      where user_id in (${users.actorA}, ${users.targetA}, ${users.targetB})
    `);
    await transaction.execute(sql`
      delete from user_roles
      where user_id in (${users.actorA}, ${users.targetA}, ${users.targetB})
    `);
    await transaction.execute(sql`
      delete from "user"
      where id in (${users.actorA}, ${users.targetA}, ${users.targetB})
    `);
    await transaction.execute(sql`
      delete from organizations where id in (${ids.orgA}, ${ids.orgB})
    `);
  });
}

async function createOffboardingFixtures() {
  await adminDb.insert(areas).values({
    id: ids.areaA,
    name: "ACC-005 Area A",
    organizationId: ids.orgA,
  });
  await adminDb.insert(positions).values({
    id: ids.positionA,
    name: "ACC-005 Position A",
    organizationId: ids.orgA,
  });
  await adminDb.insert(employees).values({
    areaId: ids.areaA,
    currentCompensation: "1000.00",
    employmentType: "clt",
    fullName: "ACC-005 Employee A",
    id: ids.employeeA,
    organizationId: ids.orgA,
    positionId: ids.positionA,
    registrationNumber: "ACC005-1",
    startDate: "2026-01-01",
    userId: users.targetA,
  });
}

async function listSessionTokens() {
  const rows = await adminDb.execute(sql<{ token: string }>`
    select token
    from "session"
    where user_id in (${users.targetA}, ${users.targetB})
    order by token
  `);

  return rows.rows.map(({ token }) => token);
}

async function createSessionHeaders(token: string) {
  const signature = await makeSignature(token, authSecret);

  return new Headers({
    cookie: `better-auth.session_token=${token}.${signature}`,
  });
}

function restoreEnvironmentVariable(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
