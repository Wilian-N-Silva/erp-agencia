import { Plus, Search } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, EmptyState, Page, PageHeader, StatusBadge } from "@/components/fg";
import { getGraphicJobFormOptions } from "@/features/graphics/dal";
import { getGraphicDashboard } from "@/features/graphics/dashboard";
import { formatMoney } from "@/features/finance/rules";
import {
  canReadGraphicJobs,
  canWriteGraphicJobs,
  graphicJobOperationalStatusLabels,
  graphicJobOperationalStatuses,
  graphicJobFinancialStatusLabels,
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
  const [dashboard, options] = await Promise.all([
    getGraphicDashboard(context, filters),
    getGraphicJobFormOptions(context),
  ]);
  const { jobs, operations, finance } = dashboard;

  return (
    <Page>
      <PageHeader
        title="Trabalhos da Gráfica"
        description={`${jobs.length} trabalho${jobs.length === 1 ? "" : "s"} encontrado${jobs.length === 1 ? "" : "s"}`}
        actions={canWrite ? <Link className={primaryButtonClassName} href="/app/grafica/novo"><Plus size={16} />Novo trabalho</Link> : undefined}
      />
      <form className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-2 xl:grid-cols-7">
        <label className="relative xl:col-span-2">
          <span className="mb-1 block text-sm">Buscar trabalho</span>
          <Search className="absolute bottom-3 left-3 size-4 text-muted-foreground" aria-hidden />
          <input className={`${inputClassName} pl-9`} defaultValue={filters.search} maxLength={120} name="search" placeholder="Código, título ou cliente" />
        </label>
        <FilterSelect label="Todos os status" name="status" value={filters.status} options={graphicJobOperationalStatuses.map((status) => ({ value: status, label: graphicJobOperationalStatusLabels[status] }))} />
        <FilterSelect label="Todos os clientes" name="clientId" value={filters.clientId} options={options.clients.map((item) => ({ value: item.id, label: item.name }))} />
        <FilterSelect label="Todos os responsáveis" name="responsibleEmployeeId" value={filters.responsibleEmployeeId} options={options.employees.map((item) => ({ value: item.id, label: item.name }))} />
        <FilterSelect label="Todos os projetos" name="projectId" value={filters.projectId} options={options.projects.map((item) => ({ value: item.id, label: item.name }))} />
        <div className="flex items-end gap-2"><button className={secondaryButtonClassName} type="submit">Filtrar</button><Link className="text-sm text-primary underline" href="/app/grafica">Limpar</Link></div>
      </form>
      <Card title="Visão operacional" description="Os indicadores e a lista abaixo respeitam os filtros selecionados.">
        <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Metric label="Trabalhos" value={operations.total} />
          <Metric label="Aguardando aprovação interna" value={operations.internalApproval} />
          <Metric label="Aguardando cliente ou revisão" value={operations.clientApproval} />
          <Metric label="Em produção" value={operations.production} />
          <Metric label="Entrega atrasada" value={operations.late} />
          <Metric label="Em espera" value={operations.waiting} />
          <Metric label="Pendências abertas" value={dashboard.pending} />
        </dl>
        <div className="mt-5 flex flex-wrap gap-2" aria-label="Trabalhos por etapa">{graphicJobOperationalStatuses.filter(status => operations.byStatus[status] > 0).map(status => {
          const query = new URLSearchParams(Object.entries(filters).filter((entry): entry is [string, string] => typeof entry[1] === "string")); query.set("status", status);
          return <Link className="rounded-md border px-3 py-2 text-sm hover:bg-muted" key={status} href={`/app/grafica?${query}` as Route}>{graphicJobOperationalStatusLabels[status]}: {operations.byStatus[status]}</Link>;
        })}</div>
      </Card>
      {finance ? <Card title="Visão financeira" description="Totais dos trabalhos filtrados, derivados dos títulos e dos vínculos confirmados no Financeiro.">
        <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Metric label="Valor contratado" value={formatMoney(finance.contracted)} />
          <Metric label="A receber em aberto" value={formatMoney(finance.receivableOpen)} />
          <Metric label="Recebido e conciliado" value={formatMoney(finance.received)} />
          <Metric label="Custos contratados ativos" value={formatMoney(finance.payableTotal)} />
          <Metric label="A pagar em aberto" value={formatMoney(finance.payableOpen)} />
          <Metric label="Pago e conciliado" value={formatMoney(finance.paid)} />
          <Metric label="Margem contratada" value={finance.reliable ? formatMoney(finance.contractedMargin) : "Aguardando vínculos confiáveis"} />
          <Metric label="Resultado de caixa" value={finance.reliable ? formatMoney(finance.cashResult) : "Aguardando vínculos confiáveis"} />
        </dl>
        <p className="mt-4 text-sm text-muted-foreground">{finance.unreliable ? `${finance.unreliable} trabalho(s) com informações incompletas ou pendentes de conciliação. Abra o detalhe para revisar os vínculos. ` : ""}A margem considera somente os custos cadastrados. Não confunda o valor contratado com dinheiro recebido.</p>
      </Card> : null}
      {jobs.length === 0 ? (
        <div className="rounded-lg border bg-card"><EmptyState title="Nenhum trabalho encontrado" description="Ajuste os filtros ou crie o primeiro trabalho da Gráfica." /></div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground"><tr><th className="p-3">Trabalho</th><th className="p-3">Cliente</th><th className="p-3">Status</th>{finance ? <th className="p-3">Financeiro</th> : null}<th className="p-3">Próxima ação</th><th className="p-3">Responsável</th><th className="p-3">Entrega</th></tr></thead>
            <tbody>{jobs.map((job) => (
              <tr className="border-b last:border-0 hover:bg-muted/30" key={job.id}>
                <td className="p-3"><Link className="font-medium text-primary hover:underline" href={`/app/grafica/${job.id}` as Route}>{job.internalCode}</Link><div className="text-muted-foreground">{job.title}</div></td>
                <td className="p-3">{job.clientName}</td>
                <td className="p-3"><StatusBadge label={graphicJobOperationalStatusLabels[job.operationalStatus]} tone={statusTone(job.operationalStatus)} /></td>
                {finance ? <td className="p-3">{job.finance ? graphicJobFinancialStatusLabels[job.finance.status] : "Sem resumo"}</td> : null}
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
  const title = name === "status" ? "Etapa" : name === "clientId" ? "Cliente" : name === "responsibleEmployeeId" ? "Responsável" : "Projeto/evento";
  return <label className="grid gap-1 text-sm">{title}<select className={inputClassName} defaultValue={value ?? ""} name={name}><option value="">{label}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}
function Metric({ label, value }: { label: string; value: string | number }) { return <div><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd></div>; }

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
