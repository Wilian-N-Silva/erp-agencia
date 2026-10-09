import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, expect, it } from "vitest";
import { createDatabase } from "@/lib/db";

const admin = createDatabase(process.env.DATABASE_TEST_ADMIN_URL!, { allowExitOnIdle: true });
afterAll(() => admin.$client.end());
it("migrates legacy cancelled AP state without inventing actor, cancellation date, cash or tenant links", async () => {
  const namespace = `saas_migration_${randomUUID().replaceAll("-", "")}`;
  const org = randomUUID(), other = randomUUID(), subscription = randomUUID(), cancelled = randomUUID(), open = randomUUID(), legacy = randomUUID(), active = randomUUID(), foreign = randomUUID();
  // Minimal pre-0060 copies isolate the actual migration/backfill from every existing database row.
  await admin.transaction(async tx => {
    await tx.execute(sql`create schema ${sql.identifier(namespace)}`);
    await tx.execute(sql.raw(`set local search_path to "${namespace}",public`));
    await tx.execute(sql.raw(`create table financial_expenses (id uuid,organization_id uuid,status text,deleted_at timestamptz,amount numeric,legacy_settled_amount numeric);
      create table saas_subscriptions (id uuid,organization_id uuid,deleted_at timestamptz);
      create table saas_subscription_charges (id uuid,organization_id uuid,subscription_id uuid,competence text,financial_expense_id uuid,total_amount_brl numeric);
      create unique index saas_subscription_charges_occurrence_idx on saas_subscription_charges(organization_id,subscription_id,competence);`));
    await tx.execute(sql`insert into financial_expenses values (${cancelled},${org},'cancelled',null,795,12),(${open},${org},'planned',null,800,0)`);
    await tx.execute(sql`insert into saas_subscription_charges values (${legacy},${org},${subscription},'2026-10',${cancelled},795),(${active},${org},${subscription},'2026-11',${open},800),(${foreign},${other},${subscription},'2026-10',${cancelled},795)`);
    await tx.execute(sql.raw(readFileSync("drizzle/0060_spotty_nico_minoru.sql", "utf8")));
    const rows = (await tx.execute(sql`select id,cancelled_at,cancellation_reason,total_amount_brl from saas_subscription_charges order by id`)).rows;
    expect(rows.find(row => row.id === legacy)).toMatchObject({ cancelled_at: (await tx.execute(sql`select now() as observed_at`)).rows[0].observed_at, cancellation_reason: expect.stringContaining("autor original desconhecido"), total_amount_brl: "795" });
    for (const id of [active,foreign]) expect(rows.find(row => row.id === id)).toMatchObject({ cancelled_at: null, cancellation_reason: null });
    expect((await tx.execute(sql`select status,amount,legacy_settled_amount from financial_expenses where id=${cancelled}`)).rows[0]).toEqual({ status: "cancelled", amount: "795", legacy_settled_amount: "12" });
    // Backfill is safe to repeat and does not replace its original observation timestamp.
    await tx.execute(sql.raw(readFileSync("drizzle/0060_spotty_nico_minoru.sql", "utf8").split("--> statement-breakpoint")[5]));
    expect((await tx.execute(sql`select cancelled_at from saas_subscription_charges where id=${legacy}`)).rows[0].cancelled_at).toEqual(rows.find(row => row.id === legacy)?.cancelled_at);
    await tx.execute(sql`drop schema ${sql.identifier(namespace)} cascade`);
  });
});
