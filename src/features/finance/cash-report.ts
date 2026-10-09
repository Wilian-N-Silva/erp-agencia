import { sql } from "drizzle-orm";
import { z } from "zod";
import { withTenantDb } from "@/lib/db";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCan } from "@/lib/rbac";
import { isoMonthSchema } from "@/lib/validation";

export type CashAccountReport = {
  id: string;
  name: string;
  opening: string;
  income: string;
  expense: string;
  reversedIncome: string;
  reversedExpense: string;
  net: string;
  closing: string;
  untracedReversals: number;
};

export async function getCashReport(context: AccessContext, raw: unknown) {
  assertCan("finance.read", context);
  if (!context.organizationId) throw new AccessDeniedError();
  const { month } = z.strictObject({ month: isoMonthSchema }).parse(raw);
  const org = context.organizationId;
  return withTenantDb(context, async tx => {
    // Keep the original event in its period; compensate at the reversal date.
    // Allocations never participate in cash sums, even when a movement has many targets.
    const result = await tx.execute(sql`
      with bounds as (
        select (${month} || '-01')::date as start,
          ((${month} || '-01')::date + interval '1 month')::date as finish
      ), events as (
        select t.account_id, (t.occurred_at at time zone 'America/Sao_Paulo')::date as day,
          t.direction, t.amount, false as reversal
        from financial_transactions t where t.organization_id=${org}
        union all
        select t.account_id, (r.occurred_at at time zone 'America/Sao_Paulo')::date,
          t.direction, -r.amount, true
        from financial_transaction_reversals r join financial_transactions t
          on t.id=r.transaction_id and t.organization_id=r.organization_id
        where r.organization_id=${org} and t.organization_id=${org}
      )
      select a.id, a.name,
        (coalesce(a.opening_balance,0) + coalesce(sum(case when e.day < b.start then
          case when e.direction='in' then e.amount else -e.amount end else 0 end),0))::numeric(18,2)::text as opening,
        coalesce(sum(e.amount) filter (where e.day >= b.start and e.day < b.finish and e.direction='in' and not e.reversal),0)::numeric(18,2)::text as income,
        coalesce(sum(e.amount) filter (where e.day >= b.start and e.day < b.finish and e.direction='out' and not e.reversal),0)::numeric(18,2)::text as expense,
        coalesce(-sum(e.amount) filter (where e.day >= b.start and e.day < b.finish and e.direction='in' and e.reversal),0)::numeric(18,2)::text as "reversedIncome",
        coalesce(-sum(e.amount) filter (where e.day >= b.start and e.day < b.finish and e.direction='out' and e.reversal),0)::numeric(18,2)::text as "reversedExpense",
        coalesce(sum(case when e.direction='in' then e.amount else -e.amount end)
          filter (where e.day >= b.start and e.day < b.finish),0)::numeric(18,2)::text as net,
        (coalesce(a.opening_balance,0) + coalesce(sum(case when e.direction='in' then e.amount else -e.amount end)
          filter (where e.day < b.finish),0))::numeric(18,2)::text as closing,
        (select count(*)::int from financial_transactions t where t.organization_id=${org}
          and t.account_id=a.id and t.status='reversed' and not exists (
            select 1 from financial_transaction_reversals r where r.organization_id=${org} and r.transaction_id=t.id)) as "untracedReversals"
      from financial_accounts a cross join bounds b left join events e on e.account_id=a.id
      where a.organization_id=${org} group by a.id, a.name, a.opening_balance order by a.name, a.id
    `);
    return { month, accounts: result.rows as CashAccountReport[] };
  });
}
