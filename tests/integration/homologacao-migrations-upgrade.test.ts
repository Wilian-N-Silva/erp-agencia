import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { sql } from "drizzle-orm";
import { expect, it } from "vitest";
import { createDatabase } from "@/lib/db";

it("upgrades 0050 through 0053 preserving historical obligations and installs tenant/reversal guards", async () => {
  const admin = createDatabase(process.env.DATABASE_TEST_ADMIN_URL!, { allowExitOnIdle: true, max: 1 });
  const schema = `hml_upgrade_${randomUUID().replaceAll("-", "")}`;
  const org = randomUUID(), employee = randomUUID(), user = randomUUID(), invoice = randomUUID();
  const journal = JSON.parse(await readFile(new URL("../../drizzle/meta/_journal.json", import.meta.url), "utf8")) as { entries: Array<{ idx: number; tag: string }> };
  try {
    await admin.transaction(async tx => {
      await tx.execute(sql.raw(`create schema "${schema}"`));
      await tx.execute(sql.raw(`set local search_path to "${schema}", public`));
      const apply = async (idx: number) => {
        const entry = journal.entries.find(e => e.idx === idx);
        if (!entry) throw new Error(`Missing migration ${idx}`);
        const source = (await readFile(new URL(`../../drizzle/${entry.tag}.sql`, import.meta.url), "utf8")).replaceAll('"public".', `"${schema}".`);
        for (const statement of source.split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean)) await tx.execute(sql.raw(statement));
      };
      for (let i = 0; i <= 50; i++) await apply(i);
      const area = randomUUID(), position = randomUUID();
      await tx.execute(sql`insert into organizations (id,name,slug) values (${org},'Upgrade HML',${org})`);
      await tx.execute(sql`insert into "user" (id,organization_id,name,email) values (${user},${org},'Upgrade QA',${`${user}@example.test`})`);
      await tx.execute(sql`insert into areas (id,organization_id,name) values (${area},${org},'QA')`);
      await tx.execute(sql`insert into positions (id,organization_id,name) values (${position},${org},'QA')`);
      await tx.execute(sql`insert into employees (id,organization_id,registration_number,full_name,position_id,area_id,employment_type,start_date,current_compensation) values (${employee},${org},'HML','Upgrade employee',${position},${area},'pj','2026-01-01',1000)`);
      await tx.execute(sql`insert into invoice_requests (id,organization_id,employee_id,competence,due_date,expected_amount,suggested_description,created_by_user_id) values (${invoice},${org},${employee},'2026-10','2026-10-15',100,'External invoice',${user})`);
      await tx.execute(sql`insert into reimbursement_requests (organization_id,employee_id,title,category,amount,expense_date,status,paid_at,included_invoice_request_id) values
        (${org},${employee},'Historical paid','QA',100,'2026-10-01','paid','2026-10-02T12:00:00Z',null),
        (${org},${employee},'Historical NF','QA',50,'2026-10-01','included_in_invoice',null,${invoice})`);
      const before = await tx.execute(sql`select title,amount,status,paid_at,included_invoice_request_id from reimbursement_requests order by title`);
      for (const idx of [51, 52, 53]) await apply(idx);
      expect((await tx.execute(sql`select title,amount,status,paid_at,included_invoice_request_id from reimbursement_requests order by title`)).rows).toEqual(before.rows);
      expect((await tx.execute(sql`select count(*)::int n from reimbursement_requests where financial_expense_id is not null`)).rows[0].n).toBe(0);
      expect((await tx.execute(sql`select count(*)::int n from financial_expenses`)).rows[0].n).toBe(0);
      expect((await tx.execute(sql`select count(*)::int n from financial_transaction_reversals`)).rows[0].n).toBe(0);
      expect((await tx.execute(sql`select count(*)::int n from pg_policies where schemaname=${schema} and tablename='financial_transaction_reversals' and qual like '%app.organization_id%' and with_check like '%app.organization_id%'`)).rows[0].n).toBe(1);
      expect((await tx.execute(sql`select count(*)::int n from pg_constraint where conname in ('reimbursements_payable_tenant_fk','reimbursements_payment_origin_check') and connamespace=${schema}::regnamespace`)).rows[0].n).toBe(2);
      expect((await tx.execute(sql`select count(*)::int n from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname=${schema} and t.tgname in ('financial_reversals_immutable','reimbursement_payable_link_guard')`)).rows[0].n).toBe(2);
      await tx.execute(sql.raw(`drop schema "${schema}" cascade`));
    });
  } finally { await admin.$client.end(); }
}, 60_000);
