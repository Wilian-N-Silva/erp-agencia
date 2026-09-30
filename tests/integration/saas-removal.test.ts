import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { createDatabase, getDb } from "@/lib/db";
import type { AccessContext } from "@/lib/dal";
import { removeMistakenSaasSubscription } from "@/features/saas/removal";
import { listSaasSubscriptions } from "@/features/saas/dal";

const audit = vi.hoisted(() => ({ fail: false }));
vi.mock("@/lib/audit", async original => {
  const actual = await original<typeof import("@/lib/audit")>();
  return { ...actual, writeAuditLog: (...args: Parameters<typeof actual.writeAuditLog>) => {
    if (audit.fail) throw new Error("Audit unavailable");
    return actual.writeAuditLog(...args);
  } };
});
const admin = createDatabase(process.env.DATABASE_TEST_ADMIN_URL!, { allowExitOnIdle: true });
const orgs = [randomUUID(), randomUUID()];
const employeeId = randomUUID();
const contexts: AccessContext[] = orgs.map(organizationId => ({
  organizationId, userId: `saas-${organizationId}`, employeeId: null, roles: [],
  permissions: ["saas.write", "saas.read", "finance.read"],
}));
const input = (id: string) => ({ id, reason: "Cadastro duplicado por engano", confirmation: "remove" });
async function createSubscription(org = orgs[0]) {
  const id = randomUUID();
  await admin.execute(sql`insert into saas_subscriptions (id, organization_id, name, category, monthly_cost) values (${id}, ${org}, 'Removal QA', 'Test', 123.45)`);
  return id;
}
async function row(id: string) {
  return (await admin.execute(sql`select deleted_at, monthly_cost from saas_subscriptions where id=${id}`)).rows[0];
}
beforeAll(async () => {
  for (const context of contexts) {
    await admin.execute(sql`insert into organizations (id,name,slug) values (${context.organizationId},'SaaS test',${context.organizationId})`);
    await admin.execute(sql`insert into "user" (id,organization_id,name,email) values (${context.userId},${context.organizationId},'SaaS QA',${`${context.userId}@example.test`})`);
  }
  const area = randomUUID(), position = randomUUID();
  await admin.execute(sql`insert into areas (id,organization_id,name) values (${area},${orgs[0]},'QA')`);
  await admin.execute(sql`insert into positions (id,organization_id,name) values (${position},${orgs[0]},'QA')`);
  await admin.execute(sql`insert into employees (id,organization_id,registration_number,full_name,position_id,area_id,employment_type,start_date,current_compensation) values (${employeeId},${orgs[0]},'REMOVAL-QA','PJ QA',${position},${area},'pj','2026-01-01',3900)`);
});
afterAll(async () => {
  audit.fail = false;
  for (const org of orgs) {
    await admin.execute(sql`delete from saas_subscription_users where subscription_id in (select id from saas_subscriptions where organization_id=${org})`);
    for (const table of ["audit_logs", "work_items", "documents", "files", "saas_subscriptions", "employees", "positions", "areas", "user"])
      await admin.execute(sql`delete from ${sql.identifier(table)} where organization_id=${org}`);
    await admin.execute(sql`delete from organizations where id=${org}`);
  }
  await admin.$client.end();
  await getDb().$client.end();
});

it("removes from DAL and preserves amount plus audit before/after and reason", async () => {
  const id = await createSubscription();
  await removeMistakenSaasSubscription(contexts[0], input(id));
  expect((await row(id)).deleted_at).not.toBeNull();
  expect((await row(id)).monthly_cost).toBe("123.45");
  expect((await listSaasSubscriptions(contexts[0])).some(item => item.id === id)).toBe(false);
  const log = (await admin.execute(sql`select action, before, after, metadata from audit_logs where entity_id=${id}`)).rows[0];
  expect(log).toMatchObject({ action: "delete", metadata: { reason: input(id).reason }, before: { deletedAt: null } });
  expect((log.after as { deletedAt: unknown }).deletedAt).not.toBeNull();
  await expect(removeMistakenSaasSubscription(contexts[0], input(id))).rejects.toThrow();
});
it("denies cross-tenant IDs and read-only users", async () => {
  const id = await createSubscription(orgs[1]);
  await expect(removeMistakenSaasSubscription(contexts[0], input(id))).rejects.toThrow();
  await expect(removeMistakenSaasSubscription({ ...contexts[1], permissions: ["saas.read"] }, input(id))).rejects.toThrow();
  expect((await row(id)).deleted_at).toBeNull();
});
it("rejects tampering and missing confirmation", async () => {
  const id = await createSubscription();
  await expect(removeMistakenSaasSubscription(contexts[0], { ...input(id), organizationId: orgs[1] })).rejects.toThrow();
  await expect(removeMistakenSaasSubscription(contexts[0], { ...input(id), confirmation: "" })).rejects.toThrow();
  expect((await row(id)).deleted_at).toBeNull();
});
it.each(["active", "inactive"])("protects %s employee links", async status => {
  const id = await createSubscription();
  await admin.execute(sql`insert into saas_subscription_users (subscription_id,employee_id,status) values (${id},${employeeId},${status})`);
  await expect(removeMistakenSaasSubscription(contexts[0], input(id))).rejects.toThrow("histórico de colaboradores");
  expect((await row(id)).deleted_at).toBeNull();
});
it("protects work item history", async () => {
  const id = await createSubscription();
  await admin.execute(sql`insert into work_items (organization_id,kind,source_type,source_id,occurrence_key,title,description) values (${orgs[0]},'saas_renewal','saas_subscription',${id},'test','QA','QA')`);
  await expect(removeMistakenSaasSubscription(contexts[0], input(id))).rejects.toThrow("documentos ou pendências");
  expect((await row(id)).deleted_at).toBeNull();
});
it("rolls back removal if audit fails", async () => {
  const id = await createSubscription();
  audit.fail = true;
  try {
    await expect(removeMistakenSaasSubscription(contexts[0], input(id))).rejects.toThrow("Audit unavailable");
  } finally { audit.fail = false; }
  expect((await row(id)).deleted_at).toBeNull();
});
it("protects attached documents", async () => {
  const id = await createSubscription(), fileId = randomUUID();
  await admin.execute(sql`insert into files (id,organization_id,storage_provider,storage_key,original_name,mime_type,extension,byte_size,uploaded_by_user_id) values (${fileId},${orgs[0]},'local',${fileId},'contract.pdf','application/pdf','pdf',10,${contexts[0].userId})`);
  await admin.execute(sql`insert into documents (organization_id,owner_type,owner_id,document_type,file_id,uploaded_by_user_id) values (${orgs[0]},'saas_subscription',${id},'contract',${fileId},${contexts[0].userId})`);
  await expect(removeMistakenSaasSubscription(contexts[0], input(id))).rejects.toThrow("documentos ou pendências");
  expect((await row(id)).deleted_at).toBeNull();
});
it("serializes duplicate removal attempts", async () => {
  const id = await createSubscription();
  const results = await Promise.allSettled([removeMistakenSaasSubscription(contexts[0], input(id)), removeMistakenSaasSubscription(contexts[0], input(id))]);
  expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
  expect((await admin.execute(sql`select count(*)::int n from audit_logs where entity_id=${id} and action='delete'`)).rows[0]).toMatchObject({ n: 1 });
});
