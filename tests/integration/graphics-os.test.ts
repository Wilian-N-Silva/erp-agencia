import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { createDatabase, getDb, withTenantDb } from "@/lib/db";
import type { AccessContext } from "@/lib/dal";
import { registerGraphicOs } from "@/features/graphics/os-registration";
import { findDuplicateOsJobs, getGraphicOsDownload, getGraphicOsVersions } from "@/features/graphics/os-dal";
import { recordClientDecision, getClientDecisions, getClientEvidence } from "@/features/graphics/client-decision";
import { advanceGraphicProduction, getGraphicProduction } from "@/features/graphics/production";
import { contractGraphicSupplier } from "@/features/graphics/commitment";
import { registerGraphicSale, getGraphicSale } from "@/features/graphics/sale";
import { getGraphicFinanceSummary } from "@/features/graphics/finance-summary";
import { createFinancialAllocations } from "@/features/finance-allocations/dal";
import { suggestGraphicReconciliation, reviewGraphicReconciliation, getGraphicSuggestions } from "@/features/graphics/reconciliation";

const storage = vi.hoisted(() => ({ put: vi.fn(), remove: vi.fn().mockResolvedValue(undefined) }));
const audit = vi.hoisted(() => ({ fail: false }));
vi.mock("@/lib/audit", async importOriginal => {
  const original = await importOriginal<typeof import("@/lib/audit")>();
  return { ...original, writeAuditLog: (...args: Parameters<typeof original.writeAuditLog>) => {
    if (audit.fail) throw new Error("Simulated audit failure");
    return original.writeAuditLog(...args);
  } };
});
vi.mock("@/lib/storage", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/storage")>(), putStorageObject: storage.put, deleteStorageObject: storage.remove,
}));
const admin = createDatabase(process.env.DATABASE_TEST_ADMIN_URL!, { allowExitOnIdle: true });
const orgs = [randomUUID(), randomUUID()];
const jobs = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const userIds = orgs.map(id => `os-${id}`);
const contexts: AccessContext[] = orgs.map((organizationId, i) => ({ organizationId, userId: userIds[i], employeeId: null, roles: [], permissions: ["graphics.read", "graphics.write", "graphics.client_approval_write"] }));
const pdf = () => new File(["%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF"], "os.pdf", { type: "application/pdf" });
const input = (jobId: string, expectedVersion = 0) => ({ jobId, expectedVersion, externalNumber: "OS-TEST", issuedAt: "2026-09-21", presentedAmount: "1500,00", revisionReason: expectedVersion ? "Nova arte" : "" });
let versionId: string;

beforeAll(async () => {
  storage.put.mockImplementation(async ({ key }) => ({ key, provider: "local", bucket: null }));
  for (let i = 0; i < 2; i++) {
    const org = orgs[i], user = userIds[i], area = randomUUID(), position = randomUUID(), employee = randomUUID(), client = randomUUID(), supplier = randomUUID();
    await admin.execute(sql`insert into organizations (id,name,slug) values (${org},'OS Test',${org})`);
    await admin.execute(sql`insert into "user" (id,organization_id,name,email) values (${user},${org},'OS User',${`${user}@example.test`})`);
    await admin.execute(sql`insert into areas (id,organization_id,name) values (${area},${org},'Graphics')`);
    await admin.execute(sql`insert into positions (id,organization_id,name) values (${position},${org},'Operator')`);
    await admin.execute(sql`insert into employees (id,organization_id,registration_number,full_name,position_id,area_id,employment_type,start_date,current_compensation) values (${employee},${org},'OS-EMP','Employee',${position},${area},'clt','2026-01-01',1000)`);
    await admin.execute(sql`insert into clients (id,organization_id,name,code) values (${client},${org},'Client','OS-CLIENT')`);
    await admin.execute(sql`insert into suppliers (id,organization_id,name) values (${supplier},${org},'Supplier')`);
    for (const job of i === 0 ? [jobs[0], jobs[2], jobs[3]] : [jobs[1]]) {
      await admin.execute(sql`insert into graphic_jobs (id,organization_id,internal_code,client_id,title,description,responsible_employee_id,operational_status) values (${job},${org},${job},${client},'OS Job','Test',${employee},'os_pending')`);
      await admin.execute(sql`insert into graphic_supplier_quotes (organization_id,job_id,supplier_id,description,quoted_amount,quoted_at,status) values (${org},${job},${supplier},'Approved quote',100,now(),'approved')`);
    }
  }
});

afterAll(async () => {
  await admin.transaction(async tx => {
    await tx.execute(sql`alter table graphic_os_versions disable trigger graphic_os_versions_immutable`);
    await tx.execute(sql`alter table graphic_client_decisions disable trigger graphic_client_decisions_immutable`);
    await tx.execute(sql`alter table graphic_production_events disable trigger graphic_production_events_immutable`);
    await tx.execute(sql`alter table graphic_supplier_commitments disable trigger graphic_supplier_commitments_immutable`);
    await tx.execute(sql`alter table graphic_sales disable trigger graphic_sales_immutable`);
    await tx.execute(sql`alter table graphic_sale_installments disable trigger graphic_sale_installments_immutable`);
    for (const org of orgs) {
      for (const table of ["audit_logs", "work_items", "graphic_sale_installments", "graphic_sales", "financial_entries", "graphic_supplier_commitments", "financial_expenses", "financial_categories", "graphic_production_events", "graphic_client_decisions", "graphic_os_versions", "files", "graphic_supplier_quotes", "graphic_jobs", "suppliers", "clients", "employees", "positions", "areas", "user"]) {
        await tx.execute(sql`delete from ${sql.identifier(table)} where organization_id=${org}`);
      }
      await tx.execute(sql`delete from organizations where id=${org}`);
    }
    await tx.execute(sql`alter table graphic_os_versions enable trigger graphic_os_versions_immutable`);
    await tx.execute(sql`alter table graphic_client_decisions enable trigger graphic_client_decisions_immutable`);
    await tx.execute(sql`alter table graphic_production_events enable trigger graphic_production_events_immutable`);
    await tx.execute(sql`alter table graphic_supplier_commitments enable trigger graphic_supplier_commitments_immutable`);
    await tx.execute(sql`alter table graphic_sales enable trigger graphic_sales_immutable`);
    await tx.execute(sql`alter table graphic_sale_installments enable trigger graphic_sale_installments_immutable`);
  });
  await admin.$client.end();
  await getDb().$client.end();
});

it("registers OS and an audited revision, keeps documents and does not create AR/AP", async () => {
  const first = await registerGraphicOs(contexts[0], input(jobs[0]), pdf());
  versionId = first.id;
  const second = await registerGraphicOs(contexts[0], { ...input(jobs[0], 1), presentedAmount: "1750,00" }, pdf());
  expect(second.version).toBe(2);
  expect(second.fileId).not.toBe(first.fileId);
  const versions = await getGraphicOsVersions(contexts[0], jobs[0]);
  expect(versions.map(v => v.presentedAmount)).toEqual(["1750.00", "1500.00"]);
  expect((await admin.execute(sql`select operational_status from graphic_jobs where id=${jobs[0]}`)).rows[0]).toMatchObject({ operational_status: "client_approval_pending" });
  expect((await admin.execute(sql`select count(*)::int n from audit_logs where organization_id=${orgs[0]} and entity_type='graphic_os_version'`)).rows[0]).toMatchObject({ n: 2 });
  for (const table of ["financial_entries", "financial_expenses", "financial_transactions"]) expect((await admin.execute(sql`select count(*)::int n from ${sql.identifier(table)} where organization_id=${orgs[0]}`)).rows[0]).toMatchObject({ n: 0 });
});

it("allows duplicate external numbers but scopes warnings to the organization", async () => {
  await registerGraphicOs(contexts[1], input(jobs[1]), pdf());
  expect(await findDuplicateOsJobs(contexts[0], jobs[0], "OS-TEST")).toHaveLength(0);
  await registerGraphicOs(contexts[0], input(jobs[2]), pdf());
  expect(await findDuplicateOsJobs(contexts[0], jobs[0], " os-test ")).toHaveLength(1);
});

it("serializes revisions and rejects stale submissions", async () => {
  const results = await Promise.allSettled([registerGraphicOs(contexts[0], input(jobs[0], 2), pdf()), registerGraphicOs(contexts[0], input(jobs[0], 2), pdf())]);
  expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
  expect(await getGraphicOsVersions(contexts[0], jobs[0])).toHaveLength(3);
});

it("enforces RBAC, job scope, file scope and RLS without tenant context", async () => {
  await expect(registerGraphicOs({ ...contexts[0], permissions: [] }, input(jobs[3]), pdf())).rejects.toThrow();
  await expect(registerGraphicOs(contexts[1], input(jobs[3]), pdf())).rejects.toThrow();
  expect(await getGraphicOsDownload(contexts[1], jobs[0], versionId)).toBeNull();
  expect(await getGraphicOsDownload(contexts[0], jobs[2], versionId)).toBeNull();
  expect(await getGraphicOsDownload(contexts[0], jobs[0], versionId)).not.toBeNull();
  expect((await getDb().execute(sql`select id from graphic_os_versions where id=${versionId}`)).rows).toHaveLength(0);
  await withTenantDb(contexts[1], async tx => {
    expect((await tx.execute(sql`select id from graphic_os_versions where id=${versionId}`)).rows).toHaveLength(0);
  });
  await expect(withTenantDb(contexts[1], tx => tx.execute(sql`insert into graphic_os_versions (organization_id,job_id,version,external_number,issued_at,presented_amount,file_id,created_by_user_id) select ${orgs[0]},job_id,99,external_number,issued_at,presented_amount,file_id,created_by_user_id from graphic_os_versions where job_id=${jobs[1]}`))).rejects.toThrow();
});

it("preserves immutable versions and rejects cross-tenant file references", async () => {
  await expect(admin.execute(sql`update graphic_os_versions set external_number='tampered' where id=${versionId}`)).rejects.toThrow();
  await expect(admin.execute(sql`delete from graphic_os_versions where id=${versionId}`)).rejects.toThrow();
  await expect(admin.execute(sql`insert into graphic_os_versions (organization_id,job_id,version,external_number,issued_at,presented_amount,file_id,created_by_user_id) select ${orgs[1]},${jobs[1]},9,external_number,issued_at,presented_amount,file_id,${userIds[1]} from graphic_os_versions where id=${versionId}`)).rejects.toThrow();
});

it("rolls back metadata and storage when a database write fails", async () => {
  const before = (await admin.execute(sql`select count(*)::int n from files where organization_id=${orgs[0]}`)).rows;
  audit.fail = true;
  try { await expect(registerGraphicOs(contexts[0], input(jobs[3]), pdf())).rejects.toThrow("Simulated audit failure"); }
  finally { audit.fail = false; }
  expect(storage.remove).toHaveBeenCalled();
  expect((await admin.execute(sql`select count(*)::int n from files where organization_id=${orgs[0]}`)).rows).toEqual(before);
  expect(await getGraphicOsVersions(contexts[0], jobs[3])).toHaveLength(0);
  expect((await admin.execute(sql`select operational_status from graphic_jobs where id=${jobs[3]}`)).rows[0]).toMatchObject({ operational_status: "os_pending" });
});

it("rejects invalid PDF and invalid operational state before storing any object", async () => {
  const calls = storage.put.mock.calls.length;
  await expect(registerGraphicOs(contexts[0], input(jobs[3]), new File(["fake"], "os.pdf", { type: "application/pdf" }))).rejects.toThrow();
  await admin.execute(sql`update graphic_jobs set operational_status='supplier_sourcing' where id=${jobs[3]}`);
  await expect(registerGraphicOs(contexts[0], input(jobs[3]), pdf())).rejects.toThrow();
  await admin.execute(sql`update graphic_jobs set operational_status='os_pending' where id=${jobs[3]}`);
  await admin.execute(sql`update graphic_supplier_quotes set status='pending' where job_id=${jobs[3]}`);
  await expect(registerGraphicOs(contexts[0], input(jobs[3]), pdf())).rejects.toThrow();
  expect(storage.put.mock.calls.length).toBe(calls);
});

const responseInput = (jobId: string, osVersionId: string, extra = {}) => ({ jobId, osVersionId, expectedDecisionId: "", decision: "approved", contact: "Cliente QA", channel: "email", decidedAt: "2026-09-21", notes: "", ...extra });

it("records a revision request, requires the latest OS, then approves with immutable history and private evidence", async () => {
  const [firstOs] = await getGraphicOsVersions(contexts[0], jobs[2]);
  const revision = await recordClientDecision(contexts[0], responseInput(jobs[2], firstOs.id, { decision: "revision_requested", notes: "Alterar cores" }), pdf());
  expect((await admin.execute(sql`select operational_status from graphic_jobs where id=${jobs[2]}`)).rows[0]).toMatchObject({ operational_status: "client_revision" });
  const updatedOs = await registerGraphicOs(contexts[0], input(jobs[2], 1), pdf());
  await expect(recordClientDecision(contexts[0], responseInput(jobs[2], firstOs.id, { expectedDecisionId: revision.id }))).rejects.toThrow("revisada");
  const approval = await recordClientDecision(contexts[0], responseInput(jobs[2], updatedOs.id, { expectedDecisionId: revision.id }));
  expect((await getClientDecisions(contexts[0], jobs[2])).map(row => row.decision.id)).toEqual([approval.id, revision.id]);
  expect((await admin.execute(sql`select operational_status from graphic_jobs where id=${jobs[2]}`)).rows[0]).toMatchObject({ operational_status: "approved" });
  expect(await getClientEvidence(contexts[0], jobs[2], revision.id)).not.toBeNull();
  expect(await getClientEvidence(contexts[1], jobs[2], revision.id)).toBeNull();
  expect(await getClientEvidence(contexts[0], jobs[0], revision.id)).toBeNull();
  expect(await getClientDecisions(contexts[1], jobs[2])).toHaveLength(0);
  await expect(admin.execute(sql`update graphic_client_decisions set contact='tampered' where id=${revision.id}`)).rejects.toThrow();
  await expect(admin.execute(sql`delete from graphic_client_decisions where id=${revision.id}`)).rejects.toThrow();
  expect((await getDb().execute(sql`select id from graphic_client_decisions where id=${revision.id}`)).rows).toHaveLength(0);
  await expect(withTenantDb(contexts[1], tx => tx.execute(sql`insert into graphic_client_decisions (organization_id,job_id,os_version_id,decision,contact,channel,decided_at,created_by_user_id) values (${orgs[0]},${jobs[2]},${updatedOs.id},'approved','Test','email','2026-09-21',${userIds[0]})`))).rejects.toThrow();
  await expect(admin.execute(sql`insert into graphic_client_decisions (organization_id,job_id,os_version_id,decision,contact,channel,decided_at,created_by_user_id) values (${orgs[1]},${jobs[1]},${updatedOs.id},'approved','Test','email','2026-09-21',${userIds[1]})`)).rejects.toThrow();
});

it("enforces client approval permission, rolls back audit failure and serializes competing responses", async () => {
  const [os] = await getGraphicOsVersions(contexts[0], jobs[0]);
  const payload = responseInput(jobs[0], os.id);
  await expect(recordClientDecision({ ...contexts[0], permissions: ["graphics.write"] }, payload)).rejects.toThrow();
  await expect(recordClientDecision(contexts[1], payload)).rejects.toThrow();
  audit.fail = true;
  try { await expect(recordClientDecision(contexts[0], payload, pdf())).rejects.toThrow("Simulated audit failure"); }
  finally { audit.fail = false; }
  expect(await getClientDecisions(contexts[0], jobs[0])).toHaveLength(0);
  expect((await admin.execute(sql`select operational_status from graphic_jobs where id=${jobs[0]}`)).rows[0]).toMatchObject({ operational_status: "client_approval_pending" });
  const results = await Promise.allSettled([recordClientDecision(contexts[0], payload), recordClientDecision(contexts[0], payload)]);
  expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
  expect(await getClientDecisions(contexts[0], jobs[0])).toHaveLength(1);
  for (const table of ["financial_entries", "financial_expenses", "financial_transactions"]) expect((await admin.execute(sql`select count(*)::int n from ${sql.identifier(table)} where organization_id=${orgs[0]}`)).rows[0]).toMatchObject({ n: 0 });
});

it("preserves refusals and requires explicit revision to resume a rejected OS", async () => {
  const [os] = await getGraphicOsVersions(contexts[1], jobs[1]);
  const refused = await recordClientDecision(contexts[1], responseInput(jobs[1], os.id, { decision: "rejected", notes: "Cliente desistiu" }));
  await expect(recordClientDecision(contexts[1], responseInput(jobs[1], os.id, { expectedDecisionId: refused.id }))).rejects.toThrow("retomar");
  await recordClientDecision(contexts[1], responseInput(jobs[1], os.id, { expectedDecisionId: refused.id, decision: "revision_requested", notes: "Cliente retomou com nova arte" }));
  expect((await getClientDecisions(contexts[1], jobs[1])).map(row => row.decision.decision)).toEqual(["revision_requested", "rejected"]);
});

it("contracts once with AP, protects tenant references and rolls back financial writes on audit failure", async () => {
  const context: AccessContext = { ...contexts[0], permissions: [...contexts[0].permissions, "graphics.production_write"] };
  const categoryId = randomUUID();
  await admin.execute(sql`insert into financial_categories (id,organization_id,name,nature) values (${categoryId},${orgs[0]},'Graphics cost','expense')`);
  const quoteId = (await admin.execute(sql`select id from graphic_supplier_quotes where job_id=${jobs[2]} and status='approved'`)).rows[0].id as string;
  const owner = (await admin.execute(sql`select responsible_employee_id from graphic_jobs where id=${jobs[2]}`)).rows[0].responsible_employee_id as string;
  await expect(advanceGraphicProduction(context, { jobId: jobs[2], expectedStatus: "approved", toStatus: "in_production", responsibleEmployeeId: owner })).rejects.toThrow("contratação");
  const payload = { jobId: jobs[2], quoteId, categoryId, contractedAt: "2026-09-21", dueDate: "2026-10-01", competence: "2026-09", confirmed: "on" };
  await expect(contractGraphicSupplier(contexts[0], payload)).rejects.toThrow();
  await expect(contractGraphicSupplier({ ...context, organizationId: orgs[1], userId: userIds[1] }, payload)).rejects.toThrow();
  await expect(contractGraphicSupplier(context, { ...payload, confirmed: undefined })).rejects.toThrow();
  await expect(contractGraphicSupplier(context, { ...payload, amount: "1.00" })).rejects.toThrow();
  audit.fail = true;
  try { await expect(contractGraphicSupplier(context, payload)).rejects.toThrow("Simulated audit failure"); }
  finally { audit.fail = false; }
  expect((await admin.execute(sql`select count(*)::int n from financial_expenses where organization_id=${orgs[0]}`)).rows).toEqual([{ n: 0 }]);
  const [first, second] = await Promise.all([contractGraphicSupplier(context, payload), contractGraphicSupplier(context, payload)]);
  expect(first.id).toBe(second.id);
  expect((await admin.execute(sql`select amount,paid_amount from financial_expenses where id=${first.expenseId}`)).rows).toEqual([{ amount: "100.00", paid_amount: "0.00" }]);
  expect((await admin.execute(sql`select count(*)::int n from financial_transactions where organization_id=${orgs[0]}`)).rows).toEqual([{ n: 0 }]);
  expect((await getDb().execute(sql`select id from graphic_supplier_commitments where id=${first.id}`)).rows).toHaveLength(0);
  await withTenantDb(contexts[1], async tx => {
    expect((await tx.execute(sql`select id from graphic_supplier_commitments where id=${first.id}`)).rows).toHaveLength(0);
    expect((await tx.execute(sql`update graphic_supplier_commitments set notes='tampered' where id=${first.id} returning id`)).rows).toHaveLength(0);
    expect((await tx.execute(sql`delete from graphic_supplier_commitments where id=${first.id} returning id`)).rows).toHaveLength(0);
  });
  await expect(withTenantDb(contexts[1], tx => tx.execute(sql`insert into graphic_supplier_commitments (organization_id,job_id,quote_id,expense_id,contracted_at,created_by_user_id) values (${orgs[0]},${jobs[2]},${quoteId},${first.expenseId},'2026-09-21',${userIds[0]})`))).rejects.toThrow();
});

it("creates signal and balance receivables once, without cash, with rollback and tenant protection", async () => {
  const [os] = await getGraphicOsVersions(contexts[0], jobs[2]);
  const payload = { jobId: jobs[2], osVersionId: os.id, amount: "1500,00", competence: "2026-09", confirmed: "on", installments: [{ label: "Sinal", amount: "500,00", dueDate: "2026-09-21" }, { label: "Saldo", amount: "1000,00", dueDate: "2026-10-01" }] };
  await expect(registerGraphicSale({ ...contexts[0], permissions: ["graphics.write"] }, payload)).rejects.toThrow();
  await expect(registerGraphicSale(contexts[1], payload)).rejects.toThrow();
  await expect(registerGraphicSale(contexts[0], { ...payload, osVersionId: versionId })).rejects.toThrow();
  await expect(registerGraphicSale(contexts[0], { ...payload, amount: "2000" })).rejects.toThrow();
  audit.fail = true;
  try { await expect(registerGraphicSale(contexts[0], payload)).rejects.toThrow("Simulated audit failure"); }
  finally { audit.fail = false; }
  expect((await admin.execute(sql`select count(*)::int n from financial_entries where organization_id=${orgs[0]}`)).rows).toEqual([{ n: 0 }]);
  const [first, second] = await Promise.all([registerGraphicSale(contexts[0], payload), registerGraphicSale(contexts[0], payload)]);
  expect(first.id).toBe(second.id);
  const result = await getGraphicSale(contexts[0], jobs[2]);
  expect(result?.installments.map(item => item.amount)).toEqual(["500.00", "1000.00"]);
  expect((await admin.execute(sql`select received_amount from financial_entries where organization_id=${orgs[0]}`)).rows).toEqual([{ received_amount: "0.00" }, { received_amount: "0.00" }]);
  expect((await admin.execute(sql`select count(*)::int n from financial_transactions where organization_id=${orgs[0]}`)).rows).toEqual([{ n: 0 }]);
  expect(await getGraphicSale(contexts[1], jobs[2])).toBeNull();
  for (const table of ["graphic_sales", "graphic_sale_installments"]) {
    expect((await getDb().execute(sql`select id from ${sql.identifier(table)} where organization_id=${orgs[0]}`)).rows).toHaveLength(0);
    await withTenantDb(contexts[1], async tx => {
      expect((await tx.execute(sql`select id from ${sql.identifier(table)} where organization_id=${orgs[0]}`)).rows).toHaveLength(0);
      expect((await tx.execute(sql`update ${sql.identifier(table)} set organization_id=${orgs[1]} where organization_id=${orgs[0]} returning id`)).rows).toHaveLength(0);
      expect((await tx.execute(sql`delete from ${sql.identifier(table)} where organization_id=${orgs[0]} returning id`)).rows).toHaveLength(0);
    });
    await expect(admin.execute(sql`delete from ${sql.identifier(table)} where organization_id=${orgs[0]}`)).rejects.toThrow();
  }
  await expect(withTenantDb(contexts[1], tx => tx.execute(sql`insert into graphic_sale_installments (organization_id,sale_id,entry_id,ordinal,label) values (${orgs[0]},${first.id},${result!.installments[0].entryId},3,'Tampered')`))).rejects.toThrow();
  await expect(admin.execute(sql`insert into graphic_sale_installments (organization_id,sale_id,entry_id,ordinal,label) values (${orgs[1]},${first.id},${result!.installments[0].entryId},3,'Tampered')`)).rejects.toThrow();
});

it("derives finance totals from linked titles, hides unreliable margins and protects financial access", async () => {
  const context: AccessContext = { ...contexts[0], permissions: ["graphics.finance_read"] };
  await expect(getGraphicFinanceSummary(contexts[0], jobs[2])).rejects.toThrow();
  expect(await getGraphicFinanceSummary({ ...context, organizationId: orgs[1], userId: userIds[1] }, jobs[2])).toBeNull();
  expect(await getGraphicFinanceSummary(context, jobs[2])).toMatchObject({ contracted: "1500.00", receivableOpen: "1500.00", received: "0.00", payableTotal: "100.00", paid: "0.00", reliable: true, contractedMargin: "1400.00" });
  const sale = await getGraphicSale(contexts[0], jobs[2]);
  const entryId = sale!.installments[0].entryId;
  await admin.execute(sql`update financial_entries set received_amount=100 where id=${entryId}`);
  try {
    expect(await getGraphicFinanceSummary(context, jobs[2])).toMatchObject({ receivableOpen: "1400.00", received: "0.00", reliable: false, contractedMargin: null });
  } finally { await admin.execute(sql`update financial_entries set received_amount=0 where id=${entryId}`); }
  expect(await getGraphicFinanceSummary(context, jobs[0])).toMatchObject({ contracted: null, reliable: false, contractedMargin: null });
});

it("counts partial cash once across installments and withholds margin until its movement is reconciled", async () => {
  const context: AccessContext = { ...contexts[0], permissions: ["graphics.finance_read", "finance.settle"] };
  const sale = await getGraphicSale(contexts[0], jobs[2]);
  const rollback = new Error("Rollback cash summary fixture");
  await expect(withTenantDb(context, async tx => {
    const accountId = randomUUID(), transactionId = randomUUID();
    await tx.execute(sql`insert into financial_accounts (id,organization_id,name,type) values (${accountId},${orgs[0]},'Summary QA','bank')`);
    await tx.execute(sql`insert into financial_transactions (id,organization_id,account_id,direction,amount,occurred_at,created_by_user_id) values (${transactionId},${orgs[0]},${accountId},'in',700,now(),${userIds[0]})`);
    await createFinancialAllocations(context, { transactionId, allocations: [{ targetId: sale!.installments[0].entryId, targetType: "receivable", amount: "300.00" }] });
    expect(await getGraphicFinanceSummary(context, jobs[2])).toMatchObject({ received: "300.00", receivableOpen: "1200.00", pendingMovements: 1, reliable: false, contractedMargin: null });
    await createFinancialAllocations(context, { transactionId, allocations: [{ targetId: sale!.installments[0].entryId, targetType: "receivable", amount: "200.00" }, { targetId: sale!.installments[1].entryId, targetType: "receivable", amount: "200.00" }] });
    expect(await getGraphicFinanceSummary(context, jobs[2])).toMatchObject({ received: "700.00", receivableOpen: "800.00", pendingMovements: 0, reliable: true, contractedMargin: "1400.00", cashResult: "700.00" });
    throw rollback;
  })).rejects.toBe(rollback);
});

it("keeps suggestions separate from cash until finance confirms, preserving rejection history and rollback", async () => {
  const context: AccessContext = { ...contexts[0], permissions: ["graphics.reconcile_suggest", "finance.settle"] };
  const department: AccessContext = { ...context, permissions: ["graphics.reconcile_suggest"] };
  const sale = await getGraphicSale(contexts[0], jobs[2]);
  const rollback = new Error("Rollback suggestion fixture");
  await expect(withTenantDb(context, async tx => {
    const accountId = randomUUID(), transactionId = randomUUID();
    await tx.execute(sql`insert into financial_accounts (id,organization_id,name,type) values (${accountId},${orgs[0]},'Suggestion QA','bank')`);
    await tx.execute(sql`insert into financial_transactions (id,organization_id,account_id,direction,amount,occurred_at,created_by_user_id) values (${transactionId},${orgs[0]},${accountId},'in',500,now(),${userIds[0]})`);
    const payload = { jobId: jobs[2], transactionId, entryId: sale!.installments[0].entryId, amount: "500.00", reason: "Cliente enviou comprovante" };
    const suggestion = await suggestGraphicReconciliation(department, payload);
    await tx.execute(sql`savepoint suggestion_rls`);
    await tx.execute(sql`select set_config('app.organization_id', ${orgs[1]}, true)`);
    expect((await tx.execute(sql`select id from graphic_reconciliation_suggestions where id=${suggestion.id}`)).rows).toHaveLength(0);
    expect((await tx.execute(sql`update graphic_reconciliation_suggestions set reason='tampered' where id=${suggestion.id} returning id`)).rows).toHaveLength(0);
    expect((await tx.execute(sql`delete from graphic_reconciliation_suggestions where id=${suggestion.id} returning id`)).rows).toHaveLength(0);
    await expect(tx.execute(sql`insert into graphic_reconciliation_suggestions (organization_id,job_id,transaction_id,entry_id,amount,reason,created_by_user_id) values (${orgs[0]},${jobs[2]},${transactionId},${payload.entryId},1,'Tamper',${userIds[0]})`)).rejects.toThrow();
    await tx.execute(sql`rollback to savepoint suggestion_rls`);
    await tx.execute(sql`select set_config('app.organization_id', '', true)`);
    expect((await tx.execute(sql`select id from graphic_reconciliation_suggestions where id=${suggestion.id}`)).rows).toHaveLength(0);
    await tx.execute(sql`rollback to savepoint suggestion_rls`);
    expect((await suggestGraphicReconciliation(department, payload)).id).toBe(suggestion.id);
    expect((await tx.execute(sql`select count(*)::int n from financial_allocations where transaction_id=${transactionId}`)).rows).toEqual([{ n: 0 }]);
    await expect(reviewGraphicReconciliation(department, { suggestionId: suggestion.id, decision: "accepted", confirmed: "on", notes: "Conferido" })).rejects.toThrow();
    const rejected = await reviewGraphicReconciliation(context, { suggestionId: suggestion.id, decision: "rejected", confirmed: "on", notes: "Referência precisa de correção" });
    expect(rejected.status).toBe("rejected");
    expect((await tx.execute(sql`select count(*)::int n from financial_allocations where transaction_id=${transactionId}`)).rows).toEqual([{ n: 0 }]);
    const replacement = await suggestGraphicReconciliation(department, { ...payload, reason: "Referência corrigida" });
    await tx.execute(sql`savepoint suggestion_failure`);
    audit.fail = true;
    try { await expect(reviewGraphicReconciliation(context, { suggestionId: replacement.id, decision: "accepted", confirmed: "on", notes: "Extrato conferido" })).rejects.toThrow("Simulated audit failure"); }
    finally { audit.fail = false; await tx.execute(sql`rollback to savepoint suggestion_failure`); }
    expect((await tx.execute(sql`select count(*)::int n from financial_allocations where transaction_id=${transactionId}`)).rows).toEqual([{ n: 0 }]);
    const accepted = await reviewGraphicReconciliation(context, { suggestionId: replacement.id, decision: "accepted", confirmed: "on", notes: "Extrato conferido" });
    expect(accepted.status).toBe("accepted");
    await tx.execute(sql`savepoint suggestion_history`);
    await expect(tx.execute(sql`delete from graphic_reconciliation_suggestions where id=${accepted.id}`)).rejects.toThrow();
    await tx.execute(sql`rollback to savepoint suggestion_history`);
    await reviewGraphicReconciliation(context, { suggestionId: replacement.id, decision: "accepted", confirmed: "on", notes: "Reenvio" });
    expect((await tx.execute(sql`select count(*)::int n from financial_allocations where transaction_id=${transactionId}`)).rows).toEqual([{ n: 1 }]);
    expect((await getGraphicSuggestions(department, { jobId: jobs[2] })).map(row => row.suggestion.status).sort()).toEqual(["accepted", "rejected"]);
    expect((await tx.execute(sql`select count(*)::int n from work_items where source_id in (${suggestion.id},${replacement.id}) and status='resolved'`)).rows).toEqual([{ n: 2 }]);
    throw rollback;
  })).rejects.toBe(rollback);
});

it("runs production through a blocking work item, resume, delivery and closure with protected history", async () => {
  const context: AccessContext = { ...contexts[0], permissions: [...contexts[0].permissions, "graphics.production_write"] };
  const owner = (await admin.execute(sql`select responsible_employee_id from graphic_jobs where id=${jobs[2]}`)).rows[0].responsible_employee_id as string;
  const base = { jobId: jobs[2], expectedStatus: "approved", toStatus: "in_production", responsibleEmployeeId: owner };
  await expect(advanceGraphicProduction(contexts[0], base)).rejects.toThrow();
  await expect(advanceGraphicProduction({ ...context, organizationId: orgs[1], userId: userIds[1] }, base)).rejects.toThrow();
  await expect(advanceGraphicProduction(context, { ...base, toStatus: "closed" })).rejects.toThrow();
  const start = await advanceGraphicProduction(context, base);
  const waiting = await advanceGraphicProduction(context, { ...base, expectedStatus: "in_production", expectedEventId: start.id, toStatus: "waiting", waitingReason: "material", notes: "Papel em reposição", dueAt: "2026-09-25" });
  expect((await admin.execute(sql`select status,assigned_employee_id from work_items where organization_id=${orgs[0]} and source_id=${jobs[2]}`)).rows).toEqual([{ status: "open", assigned_employee_id: owner }]);
  await expect(advanceGraphicProduction(context, { ...base, expectedStatus: "waiting", expectedEventId: waiting.id, toStatus: "ready" })).rejects.toThrow();
  const resumed = await advanceGraphicProduction(context, { ...base, expectedStatus: "waiting", expectedEventId: waiting.id });
  expect((await admin.execute(sql`select status from work_items where organization_id=${orgs[0]} and source_id=${jobs[2]}`)).rows).toEqual([{ status: "resolved" }]);
  const ready = await advanceGraphicProduction(context, { ...base, expectedStatus: "in_production", expectedEventId: resumed.id, toStatus: "ready" });
  const delivered = await advanceGraphicProduction(context, { ...base, expectedStatus: "ready", expectedEventId: ready.id, toStatus: "delivered", notes: "Recebido pelo cliente" });
  await advanceGraphicProduction(context, { ...base, expectedStatus: "delivered", expectedEventId: delivered.id, toStatus: "closed" });
  expect(await getGraphicProduction(context, jobs[2])).toHaveLength(6);
  expect(await getGraphicProduction(contexts[1], jobs[2])).toHaveLength(0);
  expect((await getDb().execute(sql`select id from graphic_production_events where id=${start.id}`)).rows).toHaveLength(0);
  await expect(admin.execute(sql`update graphic_production_events set notes='changed' where id=${start.id}`)).rejects.toThrow();
  await expect(admin.execute(sql`delete from graphic_production_events where id=${start.id}`)).rejects.toThrow();
  await withTenantDb(contexts[1], async tx => {
    expect((await tx.execute(sql`update graphic_production_events set notes='tampered' where id=${start.id} returning id`)).rows).toHaveLength(0);
    expect((await tx.execute(sql`delete from graphic_production_events where id=${start.id} returning id`)).rows).toHaveLength(0);
  });
  await expect(withTenantDb(contexts[1], tx => tx.execute(sql`insert into graphic_production_events (organization_id,job_id,from_status,to_status,responsible_employee_id,created_by_user_id) values (${orgs[0]},${jobs[2]},'approved','in_production',${owner},${userIds[0]})`))).rejects.toThrow();
  await expect(admin.execute(sql`insert into graphic_production_events (organization_id,job_id,from_status,to_status,responsible_employee_id,created_by_user_id) values (${orgs[1]},${jobs[1]},'approved','in_production',${owner},${userIds[1]})`)).rejects.toThrow();
});

it("rolls back a blocking stage when audit fails and rejects duplicate production submissions", async () => {
  const context: AccessContext = { ...contexts[0], permissions: [...contexts[0].permissions, "graphics.production_write"] };
  const owner = (await admin.execute(sql`select responsible_employee_id from graphic_jobs where id=${jobs[0]}`)).rows[0].responsible_employee_id as string;
  const payload = { jobId: jobs[0], expectedStatus: "approved", toStatus: "waiting", waitingReason: "art", responsibleEmployeeId: owner };
  audit.fail = true;
  try { await expect(advanceGraphicProduction(context, payload)).rejects.toThrow("Simulated audit failure"); }
  finally { audit.fail = false; }
  expect(await getGraphicProduction(context, jobs[0])).toHaveLength(0);
  expect((await admin.execute(sql`select count(*)::int n from work_items where organization_id=${orgs[0]} and source_id=${jobs[0]}`)).rows).toEqual([{ n: 0 }]);
  const results = await Promise.allSettled([advanceGraphicProduction(context, payload), advanceGraphicProduction(context, payload)]);
  expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
});
