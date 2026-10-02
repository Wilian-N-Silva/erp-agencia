import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createDatabase, getDb, withTenantDb } from "@/lib/db";
import type { AccessContext } from "@/lib/dal";

const admin = createDatabase(process.env.DATABASE_TEST_ADMIN_URL!, { allowExitOnIdle: true });
const org = randomUUID(), other = randomUUID(), area = randomUUID(), position = randomUUID(), employee = randomUUID();
const user = `invoice-link-${randomUUID()}`, payable = randomUUID(), foreignPayable = randomUUID();
const invoice = randomUUID(), second = randomUUID();
const context: AccessContext = { organizationId: org, userId: user, employeeId: null, roles: [], permissions: [] };
beforeAll(async () => {
  await admin.execute(sql`insert into organizations (id,name,slug) values (${org},'Link QA',${org}),(${other},'Other QA',${other})`);
  await admin.execute(sql`insert into "user" (id,organization_id,name,email) values (${user},${org},'QA',${`${user}@example.test`})`);
  await admin.execute(sql`insert into areas (id,organization_id,name) values (${area},${org},'QA')`);
  await admin.execute(sql`insert into positions (id,organization_id,name) values (${position},${org},'QA')`);
  await admin.execute(sql`insert into employees (id,organization_id,registration_number,full_name,area_id,position_id,employment_type,start_date,current_compensation) values (${employee},${org},${employee},'PJ QA',${area},${position},'pj','2020-01-01',3900)`);
  for (const [id, tenant] of [[payable, org], [foreignPayable, other]]) await admin.execute(sql`insert into financial_expenses (id,organization_id,supplier,category,description,amount,due_date,competence,responsible_user_id) values (${id},${tenant},'PJ QA','nota_fiscal_pj','QA',3900,'2026-09-30','2026-09',${user})`);
  for (const [id, competence] of [[invoice, '2026-09'], [second, '2026-10']]) await admin.execute(sql`insert into invoice_requests (id,organization_id,employee_id,competence,due_date,expected_amount,suggested_description,created_by_user_id) values (${id},${org},${employee},${competence},'2026-09-30',3900,'QA',${user})`);
});
afterAll(async () => {
  for (const table of ["invoice_requests", "financial_expenses", "employees", "areas", "positions", "user"]) await admin.execute(sql`delete from ${sql.identifier(table)} where organization_id in (${org},${other})`);
  await admin.execute(sql`delete from organizations where id in (${org},${other})`);
  await admin.$client.end(); await getDb().$client.end();
});
it("allows a tenant-owned payable and preserves one-to-one linkage even for archived invoices", async () => {
  await withTenantDb(context, async db => { await db.execute(sql`update invoice_requests set financial_expense_id=${payable} where id=${invoice}`); });
  await expect(withTenantDb(context, async db => { await db.execute(sql`update invoice_requests set financial_expense_id=${payable} where id=${second}`); })).rejects.toThrow();
  await admin.execute(sql`update invoice_requests set deleted_at=now() where id=${invoice}`);
  await expect(withTenantDb(context, async db => { await db.execute(sql`update invoice_requests set financial_expense_id=${payable} where id=${second}`); })).rejects.toThrow();
  await expect(admin.execute(sql`delete from financial_expenses where id=${payable}`)).rejects.toThrow();
});
it("rejects cross-tenant and nonexistent payables at the database boundary", async () => {
  for (const id of [foreignPayable, randomUUID()]) await expect(withTenantDb(context, async db => { await db.execute(sql`update invoice_requests set financial_expense_id=${id} where id=${second}`); })).rejects.toThrow();
  const result = await withTenantDb({ ...context, organizationId: other }, async db => db.execute(sql`update invoice_requests set financial_expense_id=${foreignPayable} where id=${second} returning id`));
  expect(result.rows).toHaveLength(0);
  expect((await admin.execute(sql`select financial_expense_id from invoice_requests where id=${second}`)).rows).toEqual([{ financial_expense_id: null }]);
});
