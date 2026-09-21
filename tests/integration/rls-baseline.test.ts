import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabase, type Database } from "@/lib/db";
import {
  directTenantPolicyTables,
  inheritedTenantPolicyTables,
  rlsExemptTables,
  tenantPolicyTables,
} from "@/lib/db/rls-policy-matrix";

const databaseTestUrl = process.env.DATABASE_TEST_URL;

if (!databaseTestUrl) {
  throw new Error(
    "DATABASE_TEST_URL is required for the DB integration suite. Use an isolated test database.",
  );
}

let database: Database;

beforeAll(() => {
  database = createDatabase(databaseTestUrl, {
    allowExitOnIdle: true,
    max: 1,
  });
});

afterAll(async () => {
  await database.$client.end();
});

describe("RLS baseline migration", () => {
  it("classifies every public table without silent gaps", async () => {
    const relations = await getPublicRelations();
    const actualTables = relations.map(({ table_name }) => table_name);
    const inventoriedTables = [
      ...tenantPolicyTables,
      ...Object.keys(rlsExemptTables),
    ].sort();

    expect(actualTables).toEqual(inventoriedTables);
  });

  it("enables and forces one tenant policy on every business table", async () => {
    const relations = await getPublicRelations();
    const policies = await getPublicPolicies();
    const protectedRelations = relations.filter(({ table_name }) =>
      tenantPolicyTables.includes(
        table_name as (typeof tenantPolicyTables)[number],
      ),
    );

    expect(protectedRelations).toHaveLength(tenantPolicyTables.length);
    expect(
      protectedRelations.every(
        ({ rls_enabled, rls_forced }) => rls_enabled && rls_forced,
      ),
    ).toBe(true);
    expect(policies).toHaveLength(tenantPolicyTables.length + 1);

    const tenantPolicies = policies.filter(
      ({ policy_name }) =>
        typeof policy_name === "string" &&
        policy_name.endsWith("_tenant_isolation"),
    );
    expect(tenantPolicies).toHaveLength(tenantPolicyTables.length);

    for (const policy of tenantPolicies) {
      expect(policy.policy_name).toBe(policy.table_name + "_tenant_isolation");
      expect(policy.command).toBe("ALL");
      expect(policy.roles).toEqual(["public"]);
      expect(policy.using_expression).toContain("app.organization_id");
      expect(policy.check_expression).toContain("app.organization_id");
    }
  });

  it("limits invitation pre-auth RLS to valid invitation lookup", async () => {
    const policies = await getPublicPolicies();
    const tenantPolicy = policies.find(
      ({ policy_name }) =>
        policy_name === "access_invitations_tenant_isolation",
    );
    const lookupPolicy = policies.find(
      ({ policy_name }) =>
        policy_name === "access_invitations_pre_auth_lookup",
    );

    expect(tenantPolicy).toMatchObject({
      command: "ALL",
      roles: ["public"],
    });
    expect(tenantPolicy?.using_expression).not.toContain(
      "app.invitation_email",
    );
    expect(tenantPolicy?.check_expression).not.toContain(
      "app.invitation_email",
    );
    expect(lookupPolicy).toMatchObject({
      check_expression: null,
      command: "SELECT",
      roles: ["public"],
    });
    expect(lookupPolicy?.using_expression).toContain("app.invitation_email");
    expect(lookupPolicy?.using_expression).toContain("used_at IS NULL");
    expect(lookupPolicy?.using_expression).toContain("expires_at > now()");
  });

  it("uses direct predicates for tenant columns and parent predicates for child tables", async () => {
    const policies = await getPublicPolicies();
    const byTable = new Map(
      policies
        .filter(
          ({ policy_name }) =>
            typeof policy_name === "string" &&
            policy_name.endsWith("_tenant_isolation"),
        )
        .map((policy) => [policy.table_name, policy]),
    );

    for (const table of directTenantPolicyTables) {
      expect(byTable.get(table)?.using_expression).toContain("organization_id");
      expect(byTable.get(table)?.check_expression).toContain("organization_id");
    }

    for (const [table, parent] of Object.entries(inheritedTenantPolicyTables)) {
      expect(byTable.get(table)?.using_expression).toContain(parent);
      expect(byTable.get(table)?.check_expression).toContain(parent);
    }
  });

  it("leaves only documented bootstrap and global RBAC tables exempt", async () => {
    const relations = await getPublicRelations();
    const exemptRelations = relations.filter(
      ({ table_name }) =>
        typeof table_name === "string" &&
        Object.hasOwn(rlsExemptTables, table_name),
    );

    expect(exemptRelations).toHaveLength(Object.keys(rlsExemptTables).length);
    expect(
      exemptRelations.every(
        ({ rls_enabled, rls_forced }) => !rls_enabled && !rls_forced,
      ),
    ).toBe(true);
  });
});

async function getPublicRelations() {
  const result = await database.execute(sql<{
    table_name: string;
    rls_enabled: boolean;
    rls_forced: boolean;
  }>`
    select
      c.relname as table_name,
      c.relrowsecurity as rls_enabled,
      c.relforcerowsecurity as rls_forced
    from pg_class as c
    join pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
    order by c.relname
  `);

  return result.rows;
}

async function getPublicPolicies() {
  const result = await database.execute(sql<{
    table_name: string;
    policy_name: string;
    command: string;
    roles: string[];
    using_expression: string | null;
    check_expression: string | null;
  }>`
    select
      tablename as table_name,
      policyname as policy_name,
      cmd as command,
      roles::text[] as roles,
      qual as using_expression,
      with_check as check_expression
    from pg_policies
    where schemaname = 'public'
    order by tablename, policyname
  `);

  return result.rows;
}
