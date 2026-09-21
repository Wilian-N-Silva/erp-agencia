import { sql, type SQL } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabase, createWithTenantDb, type Database } from "@/lib/db";
import type { AccessContext } from "@/lib/dal";
import { transitionPendingGraphicSupplierQuote } from "@/features/graphics/quote-decision";
import { lockGraphicJobForQuoteSubmission } from "@/features/graphics/quote-submission";

const runtimeUrl = process.env.DATABASE_TEST_URL;
const adminUrl = process.env.DATABASE_TEST_ADMIN_URL;
if (!runtimeUrl || !adminUrl || runtimeUrl === adminUrl) {
  throw new Error("GRF-003 tests require distinct runtime and admin database URLs.");
}

const id = (suffix: number) => `73300000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
const ids = {
  orgA: id(1), orgB: id(2), areaA: id(11), areaB: id(12), positionA: id(21), positionB: id(22),
  employeeA: id(31), employeeB: id(32), clientA: id(41), clientB: id(42),
  supplierA: id(51), supplierB: id(52), jobA: id(61), jobB: id(62),
  rejectionJob: id(63), cancellationJob: id(64),
  approvalCreationJob: id(65), rejectionCreationJob: id(66),
  quoteA: id(71), quoteA2: id(72), quoteB: id(73), quoteAllowed: id(74), quoteCross: id(75),
  rejectionQuote1: id(76), rejectionQuote2: id(77), cancellationQuote1: id(78), cancellationQuote2: id(79),
  approvalCreationQuote: id(80), rejectionCreationQuote: id(83),
  concurrentCreatedAfterApproval: id(84), concurrentCreatedAfterRejection: id(85),
  fileA: id(81), fileB: id(82), attachmentA: id(91), attachmentB: id(92), attachmentAllowed: id(93),
} as const;
const userA = "grf-003-user-a";
const userB = "grf-003-user-b";
const contextA: AccessContext = { employeeId: ids.employeeA, organizationId: ids.orgA, permissions: [], roles: [], userId: userA };
let runtimeDb: Database;
let adminDb: Database;

beforeAll(async () => {
  runtimeDb = createDatabase(runtimeUrl!, { allowExitOnIdle: true, max: 2 });
  adminDb = createDatabase(adminUrl!, { allowExitOnIdle: true, max: 1 });
  await cleanup();
  await createFixtures();
});

afterAll(async () => {
  if (adminDb) await cleanup();
  await Promise.all([runtimeDb?.$client.end(), adminDb?.$client.end()]);
});

describe("GRF-003 supplier quotes", () => {
  it("stores multiple pending quotes without creating an AP obligation", async () => {
    const result = await adminDb.execute(sql`
      select count(*)::int as total,
        bool_and(status = 'pending') as "allPending",
        sum(quoted_amount)::text as amount
      from graphic_supplier_quotes where job_id = ${ids.jobA}
    `);
    const expenses = await adminDb.execute(sql`
      select count(*)::int as total from financial_expenses where organization_id = ${ids.orgA}
    `);
    expect(result.rows).toEqual([{ allPending: true, amount: "350.00", total: 2 }]);
    expect(expenses.rows).toEqual([{ total: 0 }]);
  });

  it("allows same-tenant quote and attachment CRUD through tenant context", async () => {
    const withTenantDb = createWithTenantDb(runtimeDb);
    await withTenantDb(contextA, async (transaction) => {
      await expectRows(transaction, sql`select id from graphic_supplier_quotes where id = ${ids.quoteA}`, 1);
      await expectRows(transaction, sql`
        insert into graphic_supplier_quotes (id, organization_id, job_id, supplier_id, description, quoted_amount, quoted_at)
        values (${ids.quoteAllowed}, ${ids.orgA}, ${ids.jobA}, ${ids.supplierA}, 'Third quote', 300, now()) returning id
      `, 1);
      await expectRows(transaction, sql`
        insert into graphic_supplier_quote_attachments (id, organization_id, quote_id, file_id)
        values (${ids.attachmentAllowed}, ${ids.orgA}, ${ids.quoteAllowed}, ${ids.fileA}) returning id
      `, 1);
      await expectRows(transaction, sql`delete from graphic_supplier_quote_attachments where id = ${ids.attachmentAllowed} returning id`, 1);
      await expectRows(transaction, sql`update graphic_supplier_quotes set conditions = 'Updated' where id = ${ids.quoteAllowed} returning id`, 1);
      await expectRows(transaction, sql`delete from graphic_supplier_quotes where id = ${ids.quoteAllowed} returning id`, 1);
    });
  });

  it("hides known cross-tenant quote and attachment ids", async () => {
    const withTenantDb = createWithTenantDb(runtimeDb);
    await withTenantDb(contextA, async (transaction) => {
      await expectRows(transaction, sql`select id from graphic_supplier_quotes where id = ${ids.quoteB}`, 0);
      await expectRows(transaction, sql`update graphic_supplier_quotes set description = 'Tampered' where id = ${ids.quoteB} returning id`, 0);
      await expectRows(transaction, sql`delete from graphic_supplier_quotes where id = ${ids.quoteB} returning id`, 0);
      await expectRows(transaction, sql`select id from graphic_supplier_quote_attachments where id = ${ids.attachmentB}`, 0);
    });
  });

  it("rejects cross-tenant job, supplier, quote, and file links", async () => {
    for (const statement of [
      sql`insert into graphic_supplier_quotes (organization_id, job_id, supplier_id, description, quoted_amount, quoted_at) values (${ids.orgA}, ${ids.jobB}, ${ids.supplierA}, 'Bad job', 10, now())`,
      sql`insert into graphic_supplier_quotes (organization_id, job_id, supplier_id, description, quoted_amount, quoted_at) values (${ids.orgA}, ${ids.jobA}, ${ids.supplierB}, 'Bad supplier', 10, now())`,
      sql`insert into graphic_supplier_quote_attachments (organization_id, quote_id, file_id) values (${ids.orgA}, ${ids.quoteB}, ${ids.fileA})`,
      sql`insert into graphic_supplier_quote_attachments (organization_id, quote_id, file_id) values (${ids.orgA}, ${ids.quoteA}, ${ids.fileB})`,
    ]) await expect(adminDb.execute(statement)).rejects.toThrow();
  });

  it("denies writes and reads without tenant context", async () => {
    await expectRows(runtimeDb, sql`select id from graphic_supplier_quotes where id = ${ids.quoteA}`, 0);
    await expect(runtimeDb.execute(sql`
      insert into graphic_supplier_quotes (id, organization_id, job_id, supplier_id, description, quoted_amount, quoted_at)
      values (${ids.quoteCross}, ${ids.orgA}, ${ids.jobA}, ${ids.supplierA}, 'No context', 10, now())
    `)).rejects.toThrow();
    await expectRows(runtimeDb, sql`select id from graphic_supplier_quote_attachments where id = ${ids.attachmentA}`, 0);
  });

  it.each([
    ["rejections", ids.rejectionJob, ids.rejectionQuote1, ids.rejectionQuote2, "rejected"],
    ["cancellations", ids.cancellationJob, ids.cancellationQuote1, ids.cancellationQuote2, "cancelled"],
  ] as const)("serializes concurrent %s by job and returns it to sourcing", async (
    _operation,
    concurrentJobId,
    firstQuoteId,
    secondQuoteId,
    decision,
  ) => {
    const withTenantDb = createWithTenantDb(runtimeDb);
    const decide = (quoteId: string) => withTenantDb(contextA, () =>
      transitionPendingGraphicSupplierQuote({
        decision,
        jobId: concurrentJobId,
        organizationId: ids.orgA,
        quoteId,
        rejectionReason: decision === "rejected" ? "Prazo incompatível" : undefined,
        reviewerUserId: decision === "rejected" ? userA : undefined,
      }));

    await expect(Promise.all([decide(firstQuoteId), decide(secondQuoteId)]))
      .resolves.toHaveLength(2);

    const state = await adminDb.execute(sql`
      select
        (select operational_status from graphic_jobs where id = ${concurrentJobId}) as "jobStatus",
        (select count(*)::int from graphic_supplier_quotes
          where job_id = ${concurrentJobId} and status = ${decision}) as "decidedQuotes",
        (select count(*)::int from graphic_supplier_quotes
          where job_id = ${concurrentJobId} and status = 'pending') as "pendingQuotes"
    `);
    expect(state.rows).toEqual([{
      decidedQuotes: 2,
      jobStatus: "supplier_sourcing",
      pendingQuotes: 0,
    }]);
  });

  it.each([
    ["approval", ids.approvalCreationJob, ids.approvalCreationQuote,
      ids.concurrentCreatedAfterApproval, "approved", "os_pending", false],
    ["last rejection", ids.rejectionCreationJob, ids.rejectionCreationQuote,
      ids.concurrentCreatedAfterRejection, "rejected", "supplier_sourcing", true],
  ] as const)("serializes quote creation against concurrent %s", async (
    _decision,
    concurrentJobId,
    decidedQuoteId,
    createdQuoteId,
    quoteDecision,
    decidedJobStatus,
    creationShouldSucceed,
  ) => {
    const withTenantDb = createWithTenantDb(runtimeDb);
    const decisionLocked = deferred<void>();
    const releaseDecision = deferred<void>();

    const decision = withTenantDb(contextA, async (transaction) => {
      await transaction.execute(sql`
        select id from graphic_jobs
        where id = ${concurrentJobId} and organization_id = ${ids.orgA}
        for update
      `);
      decisionLocked.resolve();
      await releaseDecision.promise;
      await transaction.execute(sql`
        update graphic_supplier_quotes
        set status = ${quoteDecision},
          reviewer_user_id = ${userA},
          reviewed_at = now(),
          rejection_reason = case
            when ${quoteDecision} = 'rejected' then 'Prazo incompatível'
            else null
          end
        where id = ${decidedQuoteId}
      `);
      await transaction.execute(sql`
        update graphic_jobs set operational_status = ${decidedJobStatus}
        where id = ${concurrentJobId}
      `);
    });
    await decisionLocked.promise;

    let creationSettled = false;
    const creation = withTenantDb(contextA, async (transaction) => {
      const job = await lockGraphicJobForQuoteSubmission(concurrentJobId, ids.orgA);
      await transaction.execute(sql`
        insert into graphic_supplier_quotes (
          id, organization_id, job_id, supplier_id, description, quoted_amount, quoted_at
        ) values (
          ${createdQuoteId}, ${ids.orgA}, ${concurrentJobId}, ${ids.supplierA},
          'Concurrent creation', 140, now()
        )
      `);
      if (job.operationalStatus === "supplier_sourcing") {
        await transaction.execute(sql`
          update graphic_jobs set operational_status = 'supplier_approval_pending'
          where id = ${concurrentJobId} and operational_status = 'supplier_sourcing'
        `);
      }
    }).finally(() => {
      creationSettled = true;
    });

    await adminDb.execute(sql`select pg_sleep(0.05)`);
    expect(creationSettled).toBe(false);
    releaseDecision.resolve();

    await expect(decision).resolves.toBeUndefined();
    if (creationShouldSucceed) {
      await expect(creation).resolves.toBeUndefined();
    } else {
      await expect(creation).rejects.toThrow(
        "Supplier quotes can only be submitted during supplier sourcing or approval.",
      );
    }

    const state = await adminDb.execute(sql`
      select
        (select operational_status from graphic_jobs where id = ${concurrentJobId}) as "jobStatus",
        (select count(*)::int from graphic_supplier_quotes
          where id = ${createdQuoteId} and status = 'pending') as "createdPendingQuotes"
    `);
    expect(state.rows).toEqual([{
      createdPendingQuotes: creationShouldSucceed ? 1 : 0,
      jobStatus: creationShouldSucceed ? "supplier_approval_pending" : "os_pending",
    }]);
  });
});

async function createFixtures() {
  await adminDb.execute(sql`insert into organizations (id, name, slug) values (${ids.orgA}, 'GRF-003 A', 'grf-003-a'), (${ids.orgB}, 'GRF-003 B', 'grf-003-b')`);
  await adminDb.execute(sql`insert into "user" (id, organization_id, name, email) values (${userA}, ${ids.orgA}, 'User A', 'grf-003-a@example.test'), (${userB}, ${ids.orgB}, 'User B', 'grf-003-b@example.test')`);
  await adminDb.execute(sql`insert into areas (id, organization_id, name) values (${ids.areaA}, ${ids.orgA}, 'Graphics A'), (${ids.areaB}, ${ids.orgB}, 'Graphics B')`);
  await adminDb.execute(sql`insert into positions (id, organization_id, name) values (${ids.positionA}, ${ids.orgA}, 'Operator A'), (${ids.positionB}, ${ids.orgB}, 'Operator B')`);
  await adminDb.execute(sql`insert into employees (id, organization_id, registration_number, full_name, position_id, area_id, employment_type, start_date, current_compensation) values (${ids.employeeA}, ${ids.orgA}, 'G3-A', 'Employee A', ${ids.positionA}, ${ids.areaA}, 'clt', '2026-01-01', 1000), (${ids.employeeB}, ${ids.orgB}, 'G3-B', 'Employee B', ${ids.positionB}, ${ids.areaB}, 'clt', '2026-01-01', 1000)`);
  await adminDb.execute(sql`insert into clients (id, organization_id, name, code) values (${ids.clientA}, ${ids.orgA}, 'Client A', 'G3-A'), (${ids.clientB}, ${ids.orgB}, 'Client B', 'G3-B')`);
  await adminDb.execute(sql`insert into suppliers (id, organization_id, name) values (${ids.supplierA}, ${ids.orgA}, 'Supplier A'), (${ids.supplierB}, ${ids.orgB}, 'Supplier B')`);
  await adminDb.execute(sql`insert into graphic_jobs (id, organization_id, internal_code, client_id, title, description, responsible_employee_id, operational_status) values
    (${ids.jobA}, ${ids.orgA}, 'G3-A', ${ids.clientA}, 'Job A', 'Description', ${ids.employeeA}, 'supplier_sourcing'),
    (${ids.jobB}, ${ids.orgB}, 'G3-B', ${ids.clientB}, 'Job B', 'Description', ${ids.employeeB}, 'supplier_sourcing'),
    (${ids.rejectionJob}, ${ids.orgA}, 'G4-R', ${ids.clientA}, 'Concurrent rejection', 'Description', ${ids.employeeA}, 'supplier_approval_pending'),
    (${ids.cancellationJob}, ${ids.orgA}, 'G4-C', ${ids.clientA}, 'Concurrent cancellation', 'Description', ${ids.employeeA}, 'supplier_approval_pending'),
    (${ids.approvalCreationJob}, ${ids.orgA}, 'G4-CA', ${ids.clientA}, 'Creation vs approval', 'Description', ${ids.employeeA}, 'supplier_approval_pending'),
    (${ids.rejectionCreationJob}, ${ids.orgA}, 'G4-CR', ${ids.clientA}, 'Creation vs rejection', 'Description', ${ids.employeeA}, 'supplier_approval_pending')`);
  await adminDb.execute(sql`insert into graphic_supplier_quotes (id, organization_id, job_id, supplier_id, description, quoted_amount, quoted_at, conditions) values
    (${ids.quoteA}, ${ids.orgA}, ${ids.jobA}, ${ids.supplierA}, 'Quote A', 150, '2026-09-01', 'Cash'),
    (${ids.quoteA2}, ${ids.orgA}, ${ids.jobA}, ${ids.supplierA}, 'Quote A2', 200, '2026-09-02', 'Terms'),
    (${ids.quoteB}, ${ids.orgB}, ${ids.jobB}, ${ids.supplierB}, 'Quote B', 250, '2026-09-01', 'Cash'),
    (${ids.rejectionQuote1}, ${ids.orgA}, ${ids.rejectionJob}, ${ids.supplierA}, 'Concurrent rejection 1', 100, now(), 'Cash'),
    (${ids.rejectionQuote2}, ${ids.orgA}, ${ids.rejectionJob}, ${ids.supplierA}, 'Concurrent rejection 2', 110, now(), 'Cash'),
    (${ids.cancellationQuote1}, ${ids.orgA}, ${ids.cancellationJob}, ${ids.supplierA}, 'Concurrent cancellation 1', 120, now(), 'Cash'),
    (${ids.cancellationQuote2}, ${ids.orgA}, ${ids.cancellationJob}, ${ids.supplierA}, 'Concurrent cancellation 2', 130, now(), 'Cash'),
    (${ids.approvalCreationQuote}, ${ids.orgA}, ${ids.approvalCreationJob}, ${ids.supplierA}, 'Approve while creating', 140, now(), 'Cash'),
    (${ids.rejectionCreationQuote}, ${ids.orgA}, ${ids.rejectionCreationJob}, ${ids.supplierA}, 'Reject while creating', 150, now(), 'Cash')`);
  await adminDb.execute(sql`insert into files (id, organization_id, storage_provider, storage_key, original_name, mime_type, extension, byte_size, uploaded_by_user_id) values (${ids.fileA}, ${ids.orgA}, 'local', 'grf-003/a.pdf', 'a.pdf', 'application/pdf', 'pdf', 10, ${userA}), (${ids.fileB}, ${ids.orgB}, 'local', 'grf-003/b.pdf', 'b.pdf', 'application/pdf', 'pdf', 10, ${userB})`);
  await adminDb.execute(sql`insert into graphic_supplier_quote_attachments (id, organization_id, quote_id, file_id) values (${ids.attachmentA}, ${ids.orgA}, ${ids.quoteA}, ${ids.fileA}), (${ids.attachmentB}, ${ids.orgB}, ${ids.quoteB}, ${ids.fileB})`);
}

async function cleanup() {
  if (!adminDb) return;
  await adminDb.execute(sql`delete from graphic_supplier_quote_attachments where organization_id in (${ids.orgA}, ${ids.orgB})`);
  await adminDb.execute(sql`delete from files where organization_id in (${ids.orgA}, ${ids.orgB})`);
  await adminDb.execute(sql`delete from graphic_supplier_quotes where organization_id in (${ids.orgA}, ${ids.orgB})`);
  await adminDb.execute(sql`delete from graphic_jobs where organization_id in (${ids.orgA}, ${ids.orgB})`);
  await adminDb.execute(sql`delete from suppliers where organization_id in (${ids.orgA}, ${ids.orgB})`);
  await adminDb.execute(sql`delete from clients where organization_id in (${ids.orgA}, ${ids.orgB})`);
  await adminDb.execute(sql`delete from employees where organization_id in (${ids.orgA}, ${ids.orgB})`);
  await adminDb.execute(sql`delete from positions where organization_id in (${ids.orgA}, ${ids.orgB})`);
  await adminDb.execute(sql`delete from areas where organization_id in (${ids.orgA}, ${ids.orgB})`);
  await adminDb.execute(sql`delete from "user" where id in (${userA}, ${userB})`);
  await adminDb.execute(sql`delete from organizations where id in (${ids.orgA}, ${ids.orgB})`);
}

async function expectRows(database: Pick<Database, "execute">, statement: SQL, count: number) {
  const result = await database.execute(statement);
  expect(result.rows).toHaveLength(count);
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}
