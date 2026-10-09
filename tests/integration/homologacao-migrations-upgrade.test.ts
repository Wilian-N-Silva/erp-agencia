import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { sql } from "drizzle-orm";
import { expect, it } from "vitest";
import { createDatabase } from "@/lib/db";

it("upgrades 0050 through 0061 preserving historical obligations and captures unverified settlement separately", async () => {
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
      const ar = randomUUID(), ap = randomUUID(), account = randomUUID(), movement = randomUUID();
      await tx.execute(sql`insert into financial_entries (id,organization_id,description,amount,received_amount,status,due_date,competence,responsible_user_id) values (${ar},${org},'Historical AR',100,70,'received','2026-10-10','2026-10',${user})`);
      await tx.execute(sql`insert into financial_expenses (id,organization_id,supplier,category,description,amount,paid_amount,status,due_date,competence,responsible_user_id) values (${ap},${org},'Supplier','QA','Historical AP',80,0,'paid','2026-10-10','2026-10',${user})`);
      await tx.execute(sql`insert into financial_accounts (id,organization_id,name,type) values (${account},${org},'Upgrade account','bank')`);
      await tx.execute(sql`insert into financial_transactions (id,organization_id,account_id,direction,amount,occurred_at,created_by_user_id) values (${movement},${org},${account},'in',20,now(),${user})`);
      await tx.execute(sql`insert into financial_allocations (organization_id,transaction_id,financial_entry_id,amount,created_by_user_id) values (${org},${movement},${ar},20,${user})`);
      for (const idx of [51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61]) await apply(idx);
      expect((await tx.execute(sql`select received_amount,legacy_settled_amount,status from financial_entries where id=${ar}`)).rows[0]).toEqual({ received_amount: '70.00', legacy_settled_amount: '50.00', status: 'received' });
      expect((await tx.execute(sql`select paid_amount,legacy_settled_amount,status from financial_expenses where id=${ap}`)).rows[0]).toEqual({ paid_amount: '0.00', legacy_settled_amount: '80.00', status: 'paid' });
      expect((await tx.execute(sql`select count(*)::int n from financial_transactions`)).rows[0].n).toBe(1);
      expect((await tx.execute(sql`select title,amount,status,paid_at,included_invoice_request_id from reimbursement_requests order by title`)).rows).toEqual(before.rows);
      expect((await tx.execute(sql`select count(*)::int n from reimbursement_requests where financial_expense_id is not null`)).rows[0].n).toBe(0);
      expect((await tx.execute(sql`select count(*)::int n from financial_expenses`)).rows[0].n).toBe(1);
      expect((await tx.execute(sql`select count(*)::int n from financial_transaction_reversals`)).rows[0].n).toBe(0);
      expect((await tx.execute(sql`select count(*)::int n from graphic_sale_revisions`)).rows[0].n).toBe(0);
      expect((await tx.execute(sql`select relrowsecurity,relforcerowsecurity from pg_class where oid='graphic_sale_revisions'::regclass`)).rows[0]).toEqual({ relrowsecurity: true, relforcerowsecurity: true });
      expect((await tx.execute(sql`select count(*)::int n from pg_policies where schemaname=${schema} and tablename='graphic_sale_revisions' and qual like '%app.organization_id%' and with_check like '%app.organization_id%'`)).rows[0].n).toBe(1);
      expect((await tx.execute(sql`select count(*)::int n from pg_policies where schemaname=${schema} and tablename='financial_transaction_reversals' and qual like '%app.organization_id%' and with_check like '%app.organization_id%'`)).rows[0].n).toBe(1);
      expect((await tx.execute(sql`select count(*)::int n from pg_constraint where conname in ('reimbursements_payable_tenant_fk','reimbursements_payment_origin_check') and connamespace=${schema}::regnamespace`)).rows[0].n).toBe(2);
      expect((await tx.execute(sql`select count(*)::int n from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname=${schema} and t.tgname in ('financial_reversals_immutable','reimbursement_payable_link_guard')`)).rows[0].n).toBe(2);
      await tx.execute(sql.raw(`drop schema "${schema}" cascade`));
    });
  } finally { await admin.$client.end(); }
}, 60_000);
