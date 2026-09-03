import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createFinancialAllocations } from "@/features/finance-allocations/dal";
import { FinancialAllocationError } from "@/features/finance-allocations/rules";
import { getFinancialExpenseEffectiveStatus } from "@/features/finance/rules";
import { createDatabase, createWithTenantDb, type Database } from "@/lib/db";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError } from "@/lib/rbac";

const runtimeUrl = process.env.DATABASE_TEST_URL;
const adminUrl = process.env.DATABASE_TEST_ADMIN_URL;
if (!runtimeUrl || !adminUrl || runtimeUrl === adminUrl) {
  throw new Error("FIN-004 integration tests require distinct runtime and admin database URLs.");
}

const id = (suffix: number) =>
  `84000400-0000-4000-8000-${suffix.toString().padStart(12, "0")}`;
const orgA = id(1);
const orgB = id(2);
const accountA = id(11);
const accountB = id(12);
const transactions = {
  split: id(101),
  multi300: id(102),
  multi700: id(103),
  payable: id(104),
  transactionOver: id(105),
  targetOver: id(106),
  concurrentOne: id(107),
  concurrentTwo: id(108),
  atomic: id(109),
  cross: id(110),
};
const entries = {
  split400: id(201),
  split600: id(202),
  multi: id(203),
  over: id(204),
  concurrent: id(205),
  atomic50: id(206),
  atomic40: id(207),
  crossB: id(208),
};
const expense = id(301);

const contextA: AccessContext = {
  employeeId: null,
  organizationId: orgA,
  permissions: ["finance.read", "finance.write", "finance.settle"],
  roles: [],
  userId: "fin-004-user-a",
};

let runtimeDb: Database;
let adminDb: Database;

beforeAll(async () => {
  runtimeDb = createDatabase(runtimeUrl, { allowExitOnIdle: true, max: 4 });
  adminDb = createDatabase(adminUrl, { allowExitOnIdle: true, max: 1 });
  await cleanup();
  await createFixtures();
});

afterAll(async () => {
  await cleanup();
  await Promise.all([runtimeDb?.$client.end(), adminDb?.$client.end()]);
});

describe("FIN-004 atomic many-to-many allocations", () => {
  it("allocates one transaction to multiple receivables and recalculates every status", async () => {
    const result = await createFinancialAllocations(contextA, {
      allocations: [
        { amount: "400.00", targetId: entries.split400, targetType: "receivable" },
        { amount: "600.00", targetId: entries.split600, targetType: "receivable" },
      ],
      transactionId: transactions.split,
    });

    expect(result.allocations).toHaveLength(2);
    expect(result.transaction.status).toBe("reconciled");
    expect(await allocationCounts(transactions.split)).toEqual({
      allocations: 2,
      audits: 2,
    });
    const rows = await adminDb.execute(sql`
      select id, received_amount as "settled", status, received_date as "settledAt"
      from financial_entries
      where id in (${entries.split400}, ${entries.split600})
      order by id
    `);
    expect(rows.rows).toEqual([
      { id: entries.split400, settled: "400.00", settledAt: "2026-09-01", status: "received" },
      { id: entries.split600, settled: "600.00", settledAt: "2026-09-01", status: "received" },
    ]);
  });

  it("allows multiple transactions to settle one receivable", async () => {
    await createFinancialAllocations(contextA, {
      allocations: [{ amount: "300.00", targetId: entries.multi, targetType: "receivable" }],
      transactionId: transactions.multi300,
    });
    let state = await entryState(entries.multi);
    expect(state).toMatchObject({ settled: "300.00", status: "planned" });

    await createFinancialAllocations(contextA, {
      allocations: [{ amount: "700.00", targetId: entries.multi, targetType: "receivable" }],
      transactionId: transactions.multi700,
    });
    state = await entryState(entries.multi);
    expect(state).toMatchObject({ settled: "1000.00", status: "received" });
  });

  it("persists a partial payable balance without deriving settlement from the date alone", async () => {
    await createFinancialAllocations(contextA, {
      allocations: [{ amount: "300.00", targetId: expense, targetType: "payable" }],
      transactionId: transactions.payable,
    });
    type ExpenseState = {
      amount: string;
      dueDate: string;
      paidAmount: string;
      paidDate: string | null;
      status: "planned" | "paid" | "overdue" | "cancelled";
    };
    const expenseState = await adminDb.execute(sql<ExpenseState>`
      select amount, due_date as "dueDate", paid_amount as "paidAmount",
        paid_date as "paidDate", status
      from financial_expenses where id = ${expense}
    `);
    const row = expenseState.rows[0] as ExpenseState;
    expect(row).toMatchObject({ paidAmount: "300.00", paidDate: null, status: "planned" });
    expect(getFinancialExpenseEffectiveStatus(row, "2026-09-03")).toBe("partial");
  });

  it("rejects reducing or cancelling a receivable after it has allocations", async () => {
    await expect(adminDb.execute(sql`
      update financial_entries set amount = 999 where id = ${entries.multi}
    `)).rejects.toThrow();
    await expect(adminDb.execute(sql`
      update financial_entries set status = 'cancelled' where id = ${entries.multi}
    `)).rejects.toThrow();

    expect(await entryState(entries.multi)).toMatchObject({
      amount: "1000.00",
      settled: "1000.00",
      status: "received",
    });
    const reconciliation = await adminDb.execute(sql`
      select
        (select count(*)::int from financial_allocations
          where financial_entry_id = ${entries.multi}) as allocations,
        (select count(*)::int from financial_transactions
          where id in (${transactions.multi300}, ${transactions.multi700})
            and status = 'reconciled') as reconciled
    `);
    expect(reconciliation.rows[0]).toEqual({ allocations: 2, reconciled: 2 });
  });

  it("rejects reducing or cancelling a payable after it has allocations", async () => {
    await expect(adminDb.execute(sql`
      update financial_expenses set amount = 299 where id = ${expense}
    `)).rejects.toThrow();
    await expect(adminDb.execute(sql`
      update financial_expenses set status = 'cancelled' where id = ${expense}
    `)).rejects.toThrow();

    const state = await adminDb.execute(sql`
      select amount, paid_amount as "settled", status
      from financial_expenses where id = ${expense}
    `);
    expect(state.rows[0]).toMatchObject({
      amount: "1000.00",
      settled: "300.00",
      status: "planned",
    });
    expect((await allocationCounts(transactions.payable)).allocations).toBe(1);
    const transactionState = await adminDb.execute(sql`
      select status from financial_transactions where id = ${transactions.payable}
    `);
    expect(transactionState.rows[0]).toEqual({ status: "reconciled" });
  });

  it("rejects over-allocation against either the transaction or the title", async () => {
    await expect(createFinancialAllocations(contextA, {
      allocations: [{ amount: "101.01", targetId: entries.over, targetType: "receivable" }],
      transactionId: transactions.transactionOver,
    })).rejects.toMatchObject({ code: "transaction_overallocated" });

    await expect(createFinancialAllocations(contextA, {
      allocations: [{ amount: "100.01", targetId: entries.over, targetType: "receivable" }],
      transactionId: transactions.targetOver,
    })).rejects.toMatchObject({ code: "target_overallocated" });
  });

  it("leaves the whole batch untouched when one target is invalid", async () => {
    const before = await allocationCounts(transactions.atomic);
    await expect(createFinancialAllocations(contextA, {
      allocations: [
        { amount: "50.00", targetId: entries.atomic50, targetType: "receivable" },
        { amount: "50.00", targetId: entries.atomic40, targetType: "receivable" },
      ],
      transactionId: transactions.atomic,
    })).rejects.toBeInstanceOf(FinancialAllocationError);
    expect(await allocationCounts(transactions.atomic)).toEqual(before);
    expect(await entryState(entries.atomic50)).toMatchObject({ settled: null, status: "planned" });
  });

  it("serializes concurrent allocations so two transactions cannot over-allocate one title", async () => {
    const attempts = await Promise.allSettled([
      createFinancialAllocations(contextA, {
        allocations: [{ amount: "80.00", targetId: entries.concurrent, targetType: "receivable" }],
        transactionId: transactions.concurrentOne,
      }),
      createFinancialAllocations(contextA, {
        allocations: [{ amount: "80.00", targetId: entries.concurrent, targetType: "receivable" }],
        transactionId: transactions.concurrentTwo,
      }),
    ]);
    expect(attempts.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter(({ status }) => status === "rejected")).toHaveLength(1);
    expect(await entryState(entries.concurrent)).toMatchObject({ settled: "80.00" });
  });

  it("requires the dedicated settlement permission", async () => {
    await expect(createFinancialAllocations(
      { ...contextA, permissions: ["finance.write"] },
      {
        allocations: [{ amount: "1.00", targetId: entries.over, targetType: "receivable" }],
        transactionId: transactions.targetOver,
      },
    )).rejects.toBeInstanceOf(AccessDeniedError);
  });
});

describe("FIN-004 tenant isolation and database guards", () => {
  it("treats a known cross-tenant target as inaccessible and writes nothing", async () => {
    const before = await allocationCounts(transactions.cross);
    await expect(createFinancialAllocations(contextA, {
      allocations: [{ amount: "10.00", targetId: entries.crossB, targetType: "receivable" }],
      transactionId: transactions.cross,
    })).rejects.toBeInstanceOf(AccessDeniedError);
    expect(await allocationCounts(transactions.cross)).toEqual(before);
  });

  it("blocks cross-tenant reads and writes through the runtime role and denies missing context", async () => {
    const allocationId = id(901);
    const noContextAllocationId = id(902);
    const existing = await adminDb.execute(sql`
      select id, organization_id as "organizationId"
      from financial_allocations where organization_id = ${orgA} limit 1
    `);
    expect(existing.rows.length).toBeGreaterThan(0);
    const existingAllocationId = String(existing.rows[0]?.id);

    const contextB = { ...contextA, organizationId: orgB, userId: "fin-004-user-b" };
    await createWithTenantDb(runtimeDb)(contextB, async (transaction) => {
      const selected = await transaction.execute(sql`
        select id from financial_allocations where organization_id = ${orgA}
      `);
      expect(selected.rows).toHaveLength(0);
      await expect(transaction.execute(sql`
        insert into financial_allocations (
          id, organization_id, transaction_id, financial_entry_id, amount, created_by_user_id
        ) values (
          ${allocationId}, ${orgA}, ${transactions.cross}, ${entries.atomic50}, 1, 'fin-004-user-a'
        )
      `)).rejects.toThrow();
    });

    await createWithTenantDb(runtimeDb)(contextB, async (transaction) => {
      const updated = await transaction.execute(sql`
        update financial_allocations set amount = amount + 1
        where id = ${existingAllocationId}
        returning id
      `);
      expect(updated.rows).toHaveLength(0);
    });

    await expect(createWithTenantDb(runtimeDb)(contextA, async (transaction) => {
      await transaction.execute(sql`
        update financial_allocations set organization_id = ${orgB}
        where id = ${existingAllocationId}
      `);
    })).rejects.toThrow();

    await createWithTenantDb(runtimeDb)(contextB, async (transaction) => {
      const deleted = await transaction.execute(sql`
        delete from financial_allocations where id = ${existingAllocationId}
        returning id
      `);
      expect(deleted.rows).toHaveLength(0);
    });

    const noContextRows = await runtimeDb.execute(sql`select id from financial_allocations`);
    expect(noContextRows.rows).toHaveLength(0);
    await expect(runtimeDb.execute(sql`
      insert into financial_allocations (
        id, organization_id, transaction_id, financial_entry_id, amount, created_by_user_id
      ) values (
        ${noContextAllocationId}, ${orgA}, ${transactions.cross}, ${entries.atomic50},
        1, 'fin-004-user-a'
      )
    `)).rejects.toThrow();

    const noContextUpdate = await runtimeDb.execute(sql`
      update financial_allocations set amount = amount + 1
      where id = ${existingAllocationId}
      returning id
    `);
    expect(noContextUpdate.rows).toHaveLength(0);

    const noContextDelete = await runtimeDb.execute(sql`
      delete from financial_allocations where id = ${existingAllocationId}
      returning id
    `);
    expect(noContextDelete.rows).toHaveLength(0);
  });

  it("enforces direction and aggregate capacity for direct database writes", async () => {
    await expect(adminDb.execute(sql`
      insert into financial_allocations (
        organization_id, transaction_id, financial_expense_id, amount, created_by_user_id
      ) values (${orgA}, ${transactions.targetOver}, ${expense}, 1, 'fin-004-user-a')
    `)).rejects.toThrow();
    await expect(adminDb.execute(sql`
      insert into financial_allocations (
        organization_id, transaction_id, financial_entry_id, amount, created_by_user_id
      ) values (${orgA}, ${transactions.transactionOver}, ${entries.over}, 101.01, 'fin-004-user-a')
    `)).rejects.toThrow();
  });
});

async function createFixtures() {
  await adminDb.execute(sql`
    insert into organizations (id, name, slug) values
      (${orgA}, 'FIN-004 A', 'fin-004-a'),
      (${orgB}, 'FIN-004 B', 'fin-004-b')
  `);
  await adminDb.execute(sql`
    insert into "user" (id, organization_id, name, email, access_status) values
      ('fin-004-user-a', ${orgA}, 'User A', 'fin-004-a@example.test', 'active'),
      ('fin-004-user-b', ${orgB}, 'User B', 'fin-004-b@example.test', 'active')
  `);
  await adminDb.execute(sql`
    insert into financial_accounts (id, organization_id, name, type) values
      (${accountA}, ${orgA}, 'Account A', 'bank'),
      (${accountB}, ${orgB}, 'Account B', 'bank')
  `);
  await adminDb.execute(sql`
    insert into financial_transactions (
      id, organization_id, account_id, direction, amount, occurred_at, created_by_user_id
    ) values
      (${transactions.split}, ${orgA}, ${accountA}, 'in', 1000, '2026-09-01T12:00:00Z', 'fin-004-user-a'),
      (${transactions.multi300}, ${orgA}, ${accountA}, 'in', 300, '2026-09-01T12:00:00Z', 'fin-004-user-a'),
      (${transactions.multi700}, ${orgA}, ${accountA}, 'in', 700, '2026-09-02T12:00:00Z', 'fin-004-user-a'),
      (${transactions.payable}, ${orgA}, ${accountA}, 'out', 300, '2026-09-03T12:00:00Z', 'fin-004-user-a'),
      (${transactions.transactionOver}, ${orgA}, ${accountA}, 'in', 101, now(), 'fin-004-user-a'),
      (${transactions.targetOver}, ${orgA}, ${accountA}, 'in', 200, now(), 'fin-004-user-a'),
      (${transactions.concurrentOne}, ${orgA}, ${accountA}, 'in', 80, now(), 'fin-004-user-a'),
      (${transactions.concurrentTwo}, ${orgA}, ${accountA}, 'in', 80, now(), 'fin-004-user-a'),
      (${transactions.atomic}, ${orgA}, ${accountA}, 'in', 100, now(), 'fin-004-user-a'),
      (${transactions.cross}, ${orgA}, ${accountA}, 'in', 10, now(), 'fin-004-user-a')
  `);
  await adminDb.execute(sql`
    insert into financial_entries (
      id, organization_id, description, amount, due_date, competence, responsible_user_id
    ) values
      (${entries.split400}, ${orgA}, 'Split 400', 400, '2026-09-10', '2026-09', 'fin-004-user-a'),
      (${entries.split600}, ${orgA}, 'Split 600', 600, '2026-09-10', '2026-09', 'fin-004-user-a'),
      (${entries.multi}, ${orgA}, 'Multi transaction', 1000, '2026-09-10', '2026-09', 'fin-004-user-a'),
      (${entries.over}, ${orgA}, 'Over allocation', 100, '2026-09-10', '2026-09', 'fin-004-user-a'),
      (${entries.concurrent}, ${orgA}, 'Concurrent', 100, '2026-09-10', '2026-09', 'fin-004-user-a'),
      (${entries.atomic50}, ${orgA}, 'Atomic valid', 50, '2026-09-10', '2026-09', 'fin-004-user-a'),
      (${entries.atomic40}, ${orgA}, 'Atomic invalid', 40, '2026-09-10', '2026-09', 'fin-004-user-a'),
      (${entries.crossB}, ${orgB}, 'Other tenant', 100, '2026-09-10', '2026-09', 'fin-004-user-b')
  `);
  await adminDb.execute(sql`
    insert into financial_expenses (
      id, organization_id, supplier, category, description, amount,
      due_date, competence, responsible_user_id
    ) values (
      ${expense}, ${orgA}, 'Supplier', 'Category', 'Partial payable', 1000,
      '2026-09-10', '2026-09', 'fin-004-user-a'
    )
  `);
}

async function entryState(entryId: string) {
  const result = await adminDb.execute(sql`
    select amount, received_amount as "settled", status
    from financial_entries where id = ${entryId}
  `);
  return result.rows[0];
}

async function allocationCounts(transactionId: string) {
  const result = await adminDb.execute(sql`
    select
      (select count(*)::int from financial_allocations where transaction_id = ${transactionId}) as allocations,
      (select count(*)::int from audit_logs where entity_type = 'financial_allocation'
        and after->>'transactionId' = ${transactionId}) as audits
  `);
  return result.rows[0];
}

async function cleanup() {
  if (!adminDb) return;
  await adminDb.execute(sql`delete from audit_logs where organization_id in (${orgA}, ${orgB})`);
  await adminDb.execute(sql`delete from financial_allocations where organization_id in (${orgA}, ${orgB})`);
  await adminDb.execute(sql`delete from financial_transactions where organization_id in (${orgA}, ${orgB})`);
  await adminDb.execute(sql`delete from financial_entries where organization_id in (${orgA}, ${orgB})`);
  await adminDb.execute(sql`delete from financial_expenses where organization_id in (${orgA}, ${orgB})`);
  await adminDb.execute(sql`delete from financial_accounts where organization_id in (${orgA}, ${orgB})`);
  await adminDb.execute(sql`delete from "user" where id in ('fin-004-user-a', 'fin-004-user-b')`);
  await adminDb.execute(sql`delete from organizations where id in (${orgA}, ${orgB})`);
}
