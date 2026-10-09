import { sql, type SQL } from "drizzle-orm";

/** A correlated, tenant-scoped expression evaluated in the title query snapshot. */
export function activeTitleAllocations(type: "receivable" | "payable"): SQL<string> {
  const table = sql.identifier(type === "receivable" ? "financial_entries" : "financial_expenses");
  const target = type === "receivable" ? sql`a.financial_entry_id` : sql`a.financial_expense_id`;
  const direction = type === "receivable" ? "in" : "out";
  return sql<string>`coalesce((select sum(a.amount) from financial_allocations a
    join financial_transactions t on t.id=a.transaction_id and t.organization_id=a.organization_id
    where a.organization_id=${table}.organization_id and ${target}=${table}.id
      and t.status <> 'reversed' and t.direction=${direction}),0)::numeric(12,2)::text`;
}

export function titleSettledAmount(type: "receivable" | "payable"): SQL<string> {
  return sql<string>`((${titleLegacyReserved(type)})::numeric + (${activeTitleAllocations(type)})::numeric)::numeric(12,2)::text`;
}

/** Original immutable baseline less explicitly reviewed releases; never cash. */
export function titleLegacyReserved(type: "receivable" | "payable"): SQL<string> {
  const table = sql.identifier(type === "receivable" ? "financial_entries" : "financial_expenses");
  return sql<string>`financial_legacy_reserved(${table}.organization_id, ${type === "receivable" ? sql`${table}.id` : sql`null::uuid`}, ${type === "payable" ? sql`${table}.id` : sql`null::uuid`})::numeric(12,2)::text`;
}

export function titleLastAllocationDate(type: "receivable" | "payable"): SQL<string | null> {
  const table = sql.identifier(type === "receivable" ? "financial_entries" : "financial_expenses");
  const target = type === "receivable" ? sql`a.financial_entry_id` : sql`a.financial_expense_id`;
  const direction = type === "receivable" ? "in" : "out";
  return sql<string | null>`(select max(t.occurred_at at time zone 'America/Sao_Paulo')::date::text
    from financial_allocations a join financial_transactions t on t.id=a.transaction_id and t.organization_id=a.organization_id
    where a.organization_id=${table}.organization_id and ${target}=${table}.id
      and t.status <> 'reversed' and t.direction=${direction})`;
}
