import { sql } from "drizzle-orm";
import { withTenantDb } from "@/lib/db";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCanAny } from "@/lib/rbac";
import { getGraphicJobs } from "./dal";
import { canReadGraphicFinance, getGraphicFinanceSummaries } from "./finance-summary";
import { graphicJobFiltersSchema, graphicJobReadPermissions } from "./rules";
import { summarizeGraphicOperations, summarizeGraphicPortfolio } from "./dashboard-rules";

export async function getGraphicDashboard(context: AccessContext, rawFilters: unknown = {}) {
  assertCanAny(graphicJobReadPermissions, context);
  if (!context.organizationId) throw new AccessDeniedError();
  const organizationId = context.organizationId;
  const filters = graphicJobFiltersSchema.parse(rawFilters);
  return withTenantDb(context, async tx => {
    const jobs = await getGraphicJobs(context, filters);
    const jobIds = jobs.map(job => job.id);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const finance = canReadGraphicFinance(context) ? await getGraphicFinanceSummaries(context, jobIds) : null;
    const pending = jobIds.length ? await tx.execute(sql`
      select count(distinct w.id)::int as total from work_items w
      where w.organization_id=${organizationId} and w.status in ('open','in_progress') and (
        (w.source_type='graphic_job' and w.source_id in (${sql.join(jobIds.map(id => sql`${id}`), sql`, `)})) or
        (w.source_type='graphic_supplier_quote' and exists (select 1 from graphic_supplier_quotes q where q.organization_id=${organizationId} and q.id::text=w.source_id and q.job_id in (${sql.join(jobIds.map(id => sql`${id}::uuid`), sql`, `)}))) or
        (w.source_type='graphic_reconciliation_suggestion' and exists (select 1 from graphic_reconciliation_suggestions s where s.organization_id=${organizationId} and s.id::text=w.source_id and s.job_id in (${sql.join(jobIds.map(id => sql`${id}::uuid`), sql`, `)})))
      )
    `) : null;
    return {
      jobs: jobs.map(job => { const summary = finance?.get(job.id); return { ...job, finance: summary ?? null, nextAction: job.operationalStatus === "closed" && summary && summary.status !== "settled" ? "Resolver pendência financeira" : job.nextAction }; }),
      operations: summarizeGraphicOperations(jobs, today), pending: Number(pending?.rows[0]?.total ?? 0),
      finance: finance ? summarizeGraphicPortfolio([...finance.values()]) : null,
    };
  });
}
