import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { createDatabase, getDb, withTenantDb } from "@/lib/db";
import type { AccessContext } from "@/lib/dal";
import { registerGraphicOs } from "@/features/graphics/os-registration";
import { findDuplicateOsJobs, getGraphicOsDownload, getGraphicOsVersions } from "@/features/graphics/os-dal";

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
const contexts: AccessContext[] = orgs.map((organizationId, i) => ({ organizationId, userId: userIds[i], employeeId: null, roles: [], permissions: ["graphics.read", "graphics.write"] }));
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
    for (const org of orgs) {
      for (const table of ["audit_logs", "graphic_os_versions", "files", "graphic_supplier_quotes", "graphic_jobs", "suppliers", "clients", "employees", "positions", "areas", "user"]) {
        await tx.execute(sql`delete from ${sql.identifier(table)} where organization_id=${org}`);
      }
      await tx.execute(sql`delete from organizations where id=${org}`);
    }
    await tx.execute(sql`alter table graphic_os_versions enable trigger graphic_os_versions_immutable`);
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
