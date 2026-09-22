import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { withTenantDb } from "@/lib/db";
import { graphicJobs } from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, canAny } from "@/lib/rbac";
import { summarizeGraphicFinance, type GraphicFinancialTitle } from "./finance-summary-rules";

export function canReadGraphicFinance(context: AccessContext) {
  return canAny(["graphics.finance_read", "finance.read"], context);
}

export async function getGraphicFinanceSummary(context: AccessContext, rawJobId: unknown) {
  if (!context.organizationId || !canReadGraphicFinance(context)) throw new AccessDeniedError();
  const organizationId = context.organizationId;
  const jobId = z.string().uuid().parse(rawJobId);
  return withTenantDb(context, async tx => {
    const [job] = await tx.select({ id: graphicJobs.id }).from(graphicJobs).where(and(eq(graphicJobs.organizationId, organizationId), eq(graphicJobs.id, jobId), isNull(graphicJobs.deletedAt))).limit(1);
    if (!job) return null;
    // One SQL statement gives all monetary inputs the same PostgreSQL snapshot.
    const result = await tx.execute(sql`
      with ar as (
        select e.id, e.amount, coalesce(e.received_amount, case when e.status = 'received' then e.amount else 0 end) as settled,
          e.due_date, e.status = 'cancelled' as cancelled, e.deleted_at is not null as archived,
          coalesce((select sum(a.amount) from financial_allocations a join financial_transactions t on t.id=a.transaction_id and t.organization_id=a.organization_id
            where a.organization_id=${organizationId} and a.financial_entry_id=e.id and t.status <> 'reversed'), 0) as allocated
        from graphic_sales s join graphic_sale_installments i on i.sale_id=s.id and i.organization_id=s.organization_id
        join financial_entries e on e.id=i.entry_id and e.organization_id=i.organization_id
        where s.organization_id=${organizationId} and s.job_id=${jobId}
      ), ap as (
        select e.id, e.amount, e.paid_amount as settled, e.due_date, e.status = 'cancelled' as cancelled, e.deleted_at is not null as archived,
          coalesce((select sum(a.amount) from financial_allocations a join financial_transactions t on t.id=a.transaction_id and t.organization_id=a.organization_id
            where a.organization_id=${organizationId} and a.financial_expense_id=e.id and t.status <> 'reversed'), 0) as allocated
        from graphic_supplier_commitments c join financial_expenses e on e.id=c.expense_id and e.organization_id=c.organization_id
        where c.organization_id=${organizationId} and c.job_id=${jobId}
      )
      select
        (select amount::text from graphic_sales where organization_id=${organizationId} and job_id=${jobId}) as contracted,
        coalesce((select jsonb_agg(jsonb_build_object('amount',amount::text,'settled',settled::text,'allocated',allocated::text,'dueDate',due_date,'cancelled',cancelled,'archived',archived)) from ar), '[]') as receivables,
        coalesce((select jsonb_agg(jsonb_build_object('amount',amount::text,'settled',settled::text,'allocated',allocated::text,'dueDate',due_date,'cancelled',cancelled,'archived',archived)) from ap), '[]') as payables,
        (select count(distinct t.id)::int from financial_transactions t join financial_allocations a on a.transaction_id=t.id and a.organization_id=t.organization_id
          where t.organization_id=${organizationId} and t.status in ('pending_reconciliation','partially_reconciled')
          and (a.financial_entry_id in (select id from ar) or a.financial_expense_id in (select id from ap))) as pending
    `);
    const row = result.rows[0] as { contracted: string | null; receivables: GraphicFinancialTitle[]; payables: GraphicFinancialTitle[]; pending: number };
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    return summarizeGraphicFinance({ ...row, pendingMovements: row.pending, today });
  });
}
