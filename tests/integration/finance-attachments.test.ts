import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { createDatabase, getDb, withTenantDb } from "@/lib/db";
import type { AccessContext } from "@/lib/dal";
import { uploadFinancialAttachment, listFinancialAttachments } from "@/features/finance/attachments";
import { getDocumentForAccess } from "@/features/documents/dal";

const state = vi.hoisted(() => ({ auditFails: false }));
vi.mock("@/lib/storage", async original => ({ ...await original<typeof import("@/lib/storage")>(), putStorageObject: vi.fn(async ({ key }: { key: string }) => ({ provider: "local", bucket: null, key })), deleteStorageObject: vi.fn(async () => undefined) }));
vi.mock("@/lib/audit", async original => {
  const actual = await original<typeof import("@/lib/audit")>();
  return { ...actual, writeAuditLog: (...args: Parameters<typeof actual.writeAuditLog>) => { if (state.auditFails) throw new Error("audit failure"); return actual.writeAuditLog(...args); } };
});
const admin = createDatabase(process.env.DATABASE_TEST_ADMIN_URL!, { allowExitOnIdle: true });
const org = randomUUID(), other = randomUUID(), user = randomUUID(), ar = randomUUID(), ap = randomUUID(), movement = randomUUID(), account = randomUUID();
const context: AccessContext = { organizationId: org, userId: user, employeeId: null, roles: [], permissions: ["finance.read", "finance.write"] };
beforeAll(async () => {
  await admin.execute(sql`insert into organizations (id,name,slug) values (${org},'Attachment test',${org}),(${other},'Other attachment',${other})`);
  await admin.execute(sql`insert into "user" (id,organization_id,name,email) values (${user},${org},'QA',${`${user}@example.test`})`);
  await admin.execute(sql`insert into financial_entries (id,organization_id,description,amount,due_date,competence,responsible_user_id) values (${ar},${org},'Attachment AR',100,'2026-10-10','2026-10',${user})`);
  await admin.execute(sql`insert into financial_expenses (id,organization_id,supplier,category,description,amount,due_date,competence,responsible_user_id) values (${ap},${org},'QA','QA','Attachment AP',100,'2026-10-10','2026-10',${user})`);
  await admin.execute(sql`insert into financial_accounts (id,organization_id,name,type) values (${account},${org},'Attachment account','bank')`);
  await admin.execute(sql`insert into financial_transactions (id,organization_id,account_id,direction,amount,occurred_at,created_by_user_id) values (${movement},${org},${account},'in',100,now(),${user})`);
});
afterAll(async () => {
  for (const table of ["audit_logs", "documents", "files", "financial_transactions", "financial_entries", "financial_expenses", "financial_accounts", "user"]) await admin.execute(sql`delete from ${sql.identifier(table)} where organization_id=${org}`);
  await admin.execute(sql`delete from organizations where id in (${org},${other})`);
  await admin.$client.end(); await getDb().$client.end();
});
const upload = () => new File(["%PDF-1.4\n%%EOF"], "receipt.pdf", { type: "application/pdf" });
it("serializes versions for each AR/AP/movement and authorizes downloads by finance scope", async () => {
  for (const [ownerType, ownerId] of [["financial_entry", ar], ["financial_expense", ap], ["financial_transaction", movement]]) {
    const input = { ownerType, ownerId, documentType: "receipt" };
    const docs = await Promise.all([uploadFinancialAttachment(context, input, upload()), uploadFinancialAttachment(context, input, upload())]);
    expect(docs.map(d => d.version).sort()).toEqual([1,2]);
    expect(await listFinancialAttachments(context, { ownerType, ownerId })).toHaveLength(2);
    expect((await getDocumentForAccess({ ...context, permissions: ["finance.read"] }, docs[0].id)).fileId).toBe(docs[0].fileId);
    await expect(getDocumentForAccess({ ...context, permissions: ["documents.read_sensitive", "documents.write"] }, docs[0].id)).rejects.toThrow();
    await expect(getDocumentForAccess({ ...context, organizationId: other }, docs[0].id)).rejects.toThrow();
    expect((await withTenantDb({ ...context, organizationId: other }, tx => tx.execute(sql`select id from documents where id=${docs[0].id}`))).rows).toHaveLength(0);
  }
  expect((await admin.execute(sql`select received_amount from financial_entries where id=${ar}`)).rows[0].received_amount).toBeNull();
  expect((await admin.execute(sql`select count(*)::int n from financial_allocations where organization_id=${org}`)).rows[0].n).toBe(0);
});
it("rejects foreign owners, payload tampering and unauthorized writes before storage", async () => {
  const input = { ownerType: "financial_entry", ownerId: ar, documentType: "receipt" };
  await expect(uploadFinancialAttachment({ ...context, organizationId: other }, input, upload())).rejects.toThrow();
  await expect(uploadFinancialAttachment({ ...context, permissions: ["finance.read"] }, input, upload())).rejects.toThrow();
  await expect(uploadFinancialAttachment(context, { ...input, version: 99 }, upload())).rejects.toThrow();
});
it("rolls back file/document metadata on audit failure and compensates stored object", async () => {
  const { deleteStorageObject } = await import("@/lib/storage");
  const before = (await admin.execute(sql`select count(*)::int n from documents where organization_id=${org}`)).rows[0].n;
  state.auditFails = true;
  try { await expect(uploadFinancialAttachment(context, { ownerType: "financial_entry", ownerId: ar, documentType: "other" }, upload())).rejects.toThrow("audit failure"); }
  finally { state.auditFails = false; }
  expect((await admin.execute(sql`select count(*)::int n from documents where organization_id=${org}`)).rows[0].n).toBe(before);
  expect(deleteStorageObject).toHaveBeenCalled();
});
