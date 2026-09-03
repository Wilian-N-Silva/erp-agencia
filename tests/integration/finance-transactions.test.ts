import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createFinancialTransactionRecord } from "@/features/finance-transactions/dal";
import { createDatabase, createWithTenantDb, type Database } from "@/lib/db";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError } from "@/lib/rbac";

const runtimeUrl = process.env.DATABASE_TEST_URL;
const adminUrl = process.env.DATABASE_TEST_ADMIN_URL;
if (!runtimeUrl || !adminUrl || runtimeUrl === adminUrl) {
  throw new Error("FIN-003 integration tests require distinct runtime and admin database URLs.");
}

const id = (suffix: number) =>
  `73000000-0000-4000-8000-${suffix.toString().padStart(12, "0")}`;
const orgA = id(1);
const orgB = id(2);
const accountA = id(11);
const accountB = id(12);
const clientA = id(21);
const supplierA = id(31);
const contextA: AccessContext = {
  employeeId: null,
  organizationId: orgA,
  permissions: ["finance.read", "finance.write"],
  roles: [],
  userId: "fin-003-user-a",
};

let runtimeDb: Database;
let adminDb: Database;

beforeAll(async () => {
  runtimeDb = createDatabase(runtimeUrl, { allowExitOnIdle: true, max: 2 });
  adminDb = createDatabase(adminUrl, { allowExitOnIdle: true, max: 1 });
  await cleanup();
  await adminDb.execute(sql`
    insert into organizations (id, name, slug) values
      (${orgA}, 'FIN-003 A', 'fin-003-a'),
      (${orgB}, 'FIN-003 B', 'fin-003-b')
  `);
  await adminDb.execute(sql`
    insert into "user" (id, organization_id, name, email, access_status) values
      ('fin-003-user-a', ${orgA}, 'User A', 'fin-003-a@example.test', 'active'),
      ('fin-003-user-b', ${orgB}, 'User B', 'fin-003-b@example.test', 'active')
  `);
  await adminDb.execute(sql`
    insert into financial_accounts (id, organization_id, name, type) values
      (${accountA}, ${orgA}, 'Account A', 'bank'),
      (${accountB}, ${orgB}, 'Account B', 'bank')
  `);
  await adminDb.execute(sql`
    insert into clients (id, organization_id, name, code, status)
    values (${clientA}, ${orgA}, 'Client A', 'FIN003-CLIENT-A', 'active')
  `);
  await adminDb.execute(sql`
    insert into suppliers (id, organization_id, name)
    values (${supplierA}, ${orgA}, 'Supplier A')
  `);
});

afterAll(async () => {
  await cleanup();
  await Promise.all([runtimeDb?.$client.end(), adminDb?.$client.end()]);
});

describe("FIN-003 transaction creation", () => {
  it("creates a manual incoming transaction pending reconciliation and audits atomically", async () => {
    const created = await createFinancialTransactionRecord(contextA, {
      accountId: accountA,
      amount: "4317.52",
      clientId: clientA,
      counterpartyName: null,
      direction: "in",
      method: "PIX",
      occurredAt: new Date("2026-09-03T12:00:00.000Z"),
      reference: "BANK-4317",
      supplierId: null,
    });

    expect(created).toMatchObject({
      accountId: accountA,
      amount: "4317.52",
      clientId: clientA,
      direction: "in",
      organizationId: orgA,
      origin: "manual",
      status: "pending_reconciliation",
    });
    const audit = await adminDb.execute(sql`
      select action, entity_type as "entityType", entity_id as "entityId"
      from audit_logs
      where organization_id = ${orgA} and entity_id = ${created.id}
    `);
    expect(audit.rows).toEqual([{
      action: "create",
      entityId: created.id,
      entityType: "financial_transaction",
    }]);
  });

  it("rejects a known account from another tenant without writing transaction or audit", async () => {
    const before = await counts();
    await expect(createFinancialTransactionRecord(contextA, {
      accountId: accountB,
      amount: "10.00",
      clientId: null,
      counterpartyName: "Cross tenant",
      direction: "in",
      method: null,
      occurredAt: new Date("2026-09-03T12:00:00.000Z"),
      reference: null,
      supplierId: null,
    })).rejects.toBeInstanceOf(AccessDeniedError);
    expect(await counts()).toEqual(before);
  });
});

describe("FIN-003 RLS and database invariants", () => {
  it("allows same-tenant access and blocks cross-tenant or absent context", async () => {
    const transactionId = id(101);
    await adminDb.execute(sql`
      insert into financial_transactions (
        id, organization_id, account_id, direction, amount, occurred_at,
        created_by_user_id
      ) values (
        ${transactionId}, ${orgA}, ${accountA}, 'out', 25, now(), 'fin-003-user-a'
      )
    `);
    const withTenantDb = createWithTenantDb(runtimeDb);
    await withTenantDb(contextA, async (transaction) => {
      const visible = await transaction.execute(sql`
        select id from financial_transactions where id = ${transactionId}
      `);
      expect(visible.rows).toHaveLength(1);
    });

    const contextB = { ...contextA, organizationId: orgB, userId: "fin-003-user-b" };
    await createWithTenantDb(runtimeDb)(contextB, async (transaction) => {
      const selected = await transaction.execute(sql`
        select id from financial_transactions where id = ${transactionId}
      `);
      const updated = await transaction.execute(sql`
        update financial_transactions set reference = 'tampered' where id = ${transactionId} returning id
      `);
      const deleted = await transaction.execute(sql`
        delete from financial_transactions where id = ${transactionId} returning id
      `);
      expect(selected.rows).toHaveLength(0);
      expect(updated.rows).toHaveLength(0);
      expect(deleted.rows).toHaveLength(0);
    });

    expect((await runtimeDb.execute(sql`select id from financial_transactions where id = ${transactionId}`)).rows).toHaveLength(0);
  });

  it("rejects cross-tenant account links, non-positive values, and client-supplied invalid states", async () => {
    await expect(adminDb.execute(sql`
      insert into financial_transactions (
        organization_id, account_id, direction, amount, occurred_at, created_by_user_id
      ) values (${orgA}, ${accountB}, 'in', 10, now(), 'fin-003-user-a')
    `)).rejects.toThrow();
    await expect(adminDb.execute(sql`
      insert into financial_transactions (
        organization_id, account_id, direction, amount, occurred_at, created_by_user_id
      ) values (${orgA}, ${accountA}, 'in', 0, now(), 'fin-003-user-a')
    `)).rejects.toThrow();
    await expect(adminDb.execute(sql`
      insert into financial_transactions (
        organization_id, account_id, direction, amount, occurred_at,
        status, created_by_user_id
      ) values (${orgA}, ${accountA}, 'in', 10, now(), 'settled', 'fin-003-user-a')
    `)).rejects.toThrow();
  });
});

async function counts() {
  const result = await adminDb.execute(sql`
    select
      (select count(*)::int from financial_transactions where organization_id = ${orgA}) as transactions,
      (select count(*)::int from audit_logs where organization_id = ${orgA} and entity_type = 'financial_transaction') as audits
  `);
  return result.rows[0];
}

async function cleanup() {
  if (!adminDb) return;
  await adminDb.execute(sql`delete from audit_logs where organization_id in (${orgA}, ${orgB})`);
  await adminDb.execute(sql`delete from financial_transactions where organization_id in (${orgA}, ${orgB})`);
  await adminDb.execute(sql`delete from clients where organization_id in (${orgA}, ${orgB})`);
  await adminDb.execute(sql`delete from suppliers where organization_id in (${orgA}, ${orgB})`);
  await adminDb.execute(sql`delete from financial_accounts where organization_id in (${orgA}, ${orgB})`);
  await adminDb.execute(sql`delete from "user" where id in ('fin-003-user-a', 'fin-003-user-b')`);
  await adminDb.execute(sql`delete from organizations where id in (${orgA}, ${orgB})`);
}
