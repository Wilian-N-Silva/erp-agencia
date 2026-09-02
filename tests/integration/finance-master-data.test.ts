import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabase, createWithTenantDb, type Database } from "@/lib/db";
import type { AccessContext } from "@/lib/dal";

const runtimeUrl = process.env.DATABASE_TEST_URL;
const adminUrl = process.env.DATABASE_TEST_ADMIN_URL;
if (!runtimeUrl || !adminUrl || runtimeUrl === adminUrl) {
  throw new Error("FIN-002 integration tests require distinct runtime and admin database URLs.");
}

const orgA = "72000000-0000-4000-8000-000000000001";
const orgB = "72000000-0000-4000-8000-000000000002";
const supplierA = "72000000-0000-4000-8000-000000000011";
const supplierB = "72000000-0000-4000-8000-000000000012";
const contextA: AccessContext = { employeeId: null, organizationId: orgA, permissions: [], roles: [], userId: "fin-002-user-a" };
let runtimeDb: Database;
let adminDb: Database;

beforeAll(async () => {
  runtimeDb = createDatabase(runtimeUrl, { allowExitOnIdle: true, max: 2 });
  adminDb = createDatabase(adminUrl, { allowExitOnIdle: true, max: 1 });
  await cleanup();
  await adminDb.execute(sql`insert into organizations (id, name, slug) values (${orgA}, 'FIN-002 A', 'fin-002-a'), (${orgB}, 'FIN-002 B', 'fin-002-b')`);
  await adminDb.execute(sql`insert into suppliers (id, organization_id, name) values (${supplierA}, ${orgA}, 'Supplier A'), (${supplierB}, ${orgB}, 'Supplier B')`);
});

afterAll(async () => {
  await cleanup();
  await Promise.all([runtimeDb?.$client.end(), adminDb?.$client.end()]);
});

describe("FIN-002 tenant boundaries", () => {
  it("allows same-tenant reads and hides known cross-tenant IDs", async () => {
    const withTenantDb = createWithTenantDb(runtimeDb);
    await withTenantDb(contextA, async (transaction) => {
      const own = await transaction.execute(sql`select id from suppliers where id = ${supplierA}`);
      const other = await transaction.execute(sql`select id from suppliers where id = ${supplierB}`);
      expect(own.rows).toHaveLength(1);
      expect(other.rows).toHaveLength(0);
    });
  });

  it("rejects cross-organization inserts through RLS WITH CHECK", async () => {
    const withTenantDb = createWithTenantDb(runtimeDb);
    await expect(withTenantDb(contextA, (transaction) => transaction.execute(sql`
      insert into cost_centers (organization_id, name) values (${orgB}, 'Cross tenant')
    `))).rejects.toThrow();
  });

  it("uses composite foreign keys to reject cross-tenant master-data links", async () => {
    await adminDb.execute(sql`insert into "user" (id, organization_id, name, email) values ('fin-002-owner', ${orgA}, 'Owner', 'fin-002-owner@example.test')`);
    await expect(adminDb.execute(sql`
      insert into financial_expenses (
        organization_id, supplier_id, supplier, category, description, amount,
        due_date, competence, responsible_user_id
      ) values (
        ${orgA}, ${supplierB}, 'Snapshot B', 'Legacy category', 'Invalid link',
        '10.00', '2026-09-10', '2026-09', 'fin-002-owner'
      )
    `)).rejects.toThrow();
  });
});

async function cleanup() {
  if (!adminDb) return;
  await adminDb.execute(sql`delete from financial_expenses where organization_id in (${orgA}, ${orgB})`);
  await adminDb.execute(sql`delete from cost_centers where organization_id in (${orgA}, ${orgB})`);
  await adminDb.execute(sql`delete from suppliers where organization_id in (${orgA}, ${orgB})`);
  await adminDb.execute(sql`delete from "user" where id = 'fin-002-owner'`);
  await adminDb.execute(sql`delete from organizations where id in (${orgA}, ${orgB})`);
}
