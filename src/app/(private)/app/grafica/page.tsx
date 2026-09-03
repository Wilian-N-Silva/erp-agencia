import { Plus, Search } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { EmptyState, Page, PageHeader, StatusBadge } from "@/components/fg";
import { getGraphicJobFormOptions, getGraphicJobs } from "@/features/graphics/dal";
import {
  canReadGraphicJobs,
  canWriteGraphicJobs,
  graphicJobOperationalStatusLabels,
  graphicJobOperationalStatuses,
  normalizeGraphicJobFilters,
} from "@/features/graphics/rules";
import { getCurrentAccessContext } from "@/lib/dal";

export const dynamic = "force-dynamic";

export default async function GraphicJobsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const context = await getCurrentAccessContext();
  if (!context) redirect("/login");
  if (!canReadGraphicJobs(context)) redirect("/acesso-negado");

  const filters = normalizeGraphicJobFilters((await searchParams) ?? {});
  const canWrite = canWriteGraphicJobs(context);
  const [jobs, options] = await Promise.all([
    getGraphicJobs(context, filters),
    getGraphicJobFormOptions(context),
  ]);

  return (
    <Page>
      <PageHeader
        title="Trabalhos da Gráfica"
        description={`${jobs.length} trabalho${jobs.length === 1 ? "" : "s"} encontrado${jobs.length === 1 ? "" : "s"}`}
        actions={canWrite ? <Link className={primaryButtonClassName} href="/app/grafica/novo"><Plus size={16} />Novo trabalho</Link> : undefined}
      />
      <form className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-2 xl:grid-cols-7">
        <label className="relative xl:col-span-2">
          <Search className="absolute left-3 top-3 size-4 text-muted-foreground" aria-hidden />
          <input className={`${inputClassName} pl-9`} defaultValue={filters.search} maxLength={120} name="search" placeholder="Código, título ou cliente" />
        </label>
        <FilterSelect label="Todos os status" name="status" value={filters.status} options={graphicJobOperationalStatuses.map((status) => ({ value: status, label: graphicJobOperationalStatusLabels[status] }))} />
        <FilterSelect label="Todos os clientes" name="clientId" value={filters.clientId} options={options.clients.map((item) => ({ value: item.id, label: item.name }))} />
        <FilterSelect label="Todos os responsáveis" name="responsibleEmployeeId" value={filters.responsibleEmployeeId} options={options.employees.map((item) => ({ value: item.id, label: item.name }))} />
        <FilterSelect label="Todos os projetos" name="projectId" value={filters.projectId} options={options.projects.map((item) => ({ value: item.id, label: item.name }))} />
        <button className={secondaryButtonClassName} type="submit">Filtrar</button>
      </form>
      {jobs.length === 0 ? (
        <div className="rounded-lg border bg-card"><EmptyState title="Nenhum trabalho encontrado" description="Ajuste os filtros ou crie o primeiro trabalho da Gráfica." /></div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground"><tr><th className="p-3">Trabalho</th><th className="p-3">Cliente</th><th className="p-3">Status</th><th className="p-3">Próxima ação</th><th className="p-3">Responsável</th><th className="p-3">Entrega</th></tr></thead>
            <tbody>{jobs.map((job) => (
              <tr className="border-b last:border-0 hover:bg-muted/30" key={job.id}>
                <td className="p-3"><Link className="font-medium text-primary hover:underline" href={`/app/grafica/${job.id}` as Route}>{job.internalCode}</Link><div className="text-muted-foreground">{job.title}</div></td>
                <td className="p-3">{job.clientName}</td>
                <td className="p-3"><StatusBadge label={graphicJobOperationalStatusLabels[job.operationalStatus]} tone={statusTone(job.operationalStatus)} /></td>
                <td className="p-3 font-medium">{job.nextAction}</td>
                <td className="p-3">{job.responsibleName}</td>
                <td className="p-3">{formatDate(job.desiredDeliveryAt)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </Page>
  );
}

function FilterSelect({ label, name, options, value }: { label: string; name: string; options: Array<{ label: string; value: string }>; value?: string }) {
  return <select className={inputClassName} defaultValue={value ?? ""} name={name}><option value="">{label}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
}

function statusTone(status: string): "success" | "warning" | "danger" | "muted" | "brand" {
  if (["closed", "delivered", "ready", "approved"].includes(status)) return "success";
  if (["cancelled", "client_rejected"].includes(status)) return "danger";
  if (["waiting", "client_revision"].includes(status)) return "warning";
  return "brand";
}

function formatDate(value: Date | null) { return value ? new Intl.DateTimeFormat("pt-BR").format(value) : "—"; }
const inputClassName = "h-10 w-full rounded-md border bg-background px-3 text-sm";
const primaryButtonClassName = "inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground";
const secondaryButtonClassName = "inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium hover:bg-muted";
