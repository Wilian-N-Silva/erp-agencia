import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createDatabase, getDb } from "@/lib/db";
import type { AccessContext } from "@/lib/dal";
import { getDocumentForAccess } from "@/features/documents/dal";
import { listInvoiceRequests } from "@/features/portal/dal";

const admin = createDatabase(process.env.DATABASE_TEST_ADMIN_URL!, { allowExitOnIdle: true });
const org = randomUUID(), otherOrg = randomUUID(), area = randomUUID(), position = randomUUID(), employee = randomUUID(), file = randomUUID(), document = randomUUID(), invoice = randomUUID();
const user = `invoice-document-${randomUUID()}`;
const context: AccessContext = { organizationId: org, userId: user, employeeId: null, roles: [], permissions: ["invoices.read"] };

beforeAll(async () => {
  await admin.execute(sql`insert into organizations (id,name,slug) values (${org},'Document QA',${org}),(${otherOrg},'Other QA',${otherOrg})`);
  await admin.execute(sql`insert into "user" (id,organization_id,name,email) values (${user},${org},'QA',${`${user}@example.test`})`);
  await admin.execute(sql`insert into areas (id,organization_id,name) values (${area},${org},'QA')`);
  await admin.execute(sql`insert into positions (id,organization_id,name) values (${position},${org},'QA')`);
  await admin.execute(sql`insert into employees (id,organization_id,registration_number,full_name,area_id,position_id,employment_type,start_date,current_compensation) values (${employee},${org},${employee},'QA PJ',${area},${position},'pj','2020-01-01',3900)`);
  await admin.execute(sql`insert into files (id,organization_id,owner_employee_id,storage_provider,storage_key,original_name,mime_type,extension,byte_size,uploaded_by_user_id) values (${file},${org},${employee},'local','test.pdf','test.pdf','application/pdf','pdf',10,${user})`);
  await admin.execute(sql`insert into invoice_requests (id,organization_id,employee_id,competence,due_date,expected_amount,suggested_description,status,created_by_user_id,file_id) values (${invoice},${org},${employee},'2026-09','2026-09-30',3900,'QA','submitted',${user},${file})`);
  await admin.execute(sql`insert into documents (id,organization_id,owner_type,owner_id,document_type,file_id,visibility,uploaded_by_user_id) values (${document},${org},'invoice_request',${invoice},'invoice',${file},'employee_visible',${user})`);
});
afterAll(async () => {
  for (const table of ["documents", "invoice_requests", "files", "employees", "areas", "positions", "user"]) await admin.execute(sql`delete from ${sql.identifier(table)} where organization_id=${org}`);
  await admin.execute(sql`delete from organizations where id in (${org},${otherOrg})`);
  await admin.$client.end(); await getDb().$client.end();
});
it("allows invoice readers and its owner but denies unrelated users and tenants", async () => {
  expect((await listInvoiceRequests(context))[0].documentId).toBe(document);
  expect((await getDocumentForAccess(context, document)).fileId).toBe(file);
  expect((await getDocumentForAccess({ ...context, employeeId: employee, permissions: ["invoices.read_own"] }, document)).fileId).toBe(file);
  await expect(getDocumentForAccess({ ...context, permissions: [] }, document)).rejects.toThrow();
  await expect(getDocumentForAccess({ ...context, employeeId: randomUUID(), permissions: ["invoices.read_own"] }, document)).rejects.toThrow();
  await expect(getDocumentForAccess({ ...context, organizationId: otherOrg }, document)).rejects.toThrow();
});
it("does not grant access to other document types, detached or deleted PDFs", async () => {
  await admin.execute(sql`update documents set document_type='personal_document' where id=${document}`);
  await expect(getDocumentForAccess(context, document)).rejects.toThrow();
  await admin.execute(sql`update documents set document_type='invoice' where id=${document}`);
  await admin.execute(sql`update invoice_requests set file_id=null where id=${invoice}`);
  await expect(getDocumentForAccess(context, document)).rejects.toThrow();
  await admin.execute(sql`update invoice_requests set file_id=${file} where id=${invoice}`);
  await admin.execute(sql`update files set deleted_at=now() where id=${file}`);
  await expect(getDocumentForAccess(context, document)).rejects.toThrow();
});
