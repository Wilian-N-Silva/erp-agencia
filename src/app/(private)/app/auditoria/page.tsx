import { Download, Eye } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  listAuditActorOptions,
  listAuditLogs,
  type AuditActorOption,
  type AuditLogListItem,
} from "@/features/audit/dal";
import {
  auditActionLabels,
  auditEntityLabels,
  canExportAuditReport,
  canReadAuditPayloads,
  canReadAuditReport,
  getVisibleAuditEntityTypes,
  normalizeAuditFilters,
  type AuditFilters,
} from "@/features/audit/rules";
import { auditActions } from "@/lib/audit";
import { getCurrentAccessContext } from "@/lib/dal";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AuditPage({ searchParams }: PageProps) {
  const context = await getCurrentAccessContext();

  if (!context) {
    redirect("/login");
  }

  if (!canReadAuditReport(context)) {
    redirect("/acesso-negado");
  }

  const filters = normalizeAuditFilters((await searchParams) ?? {});
  const [logs, actorOptions] = await Promise.all([
    listAuditLogs(context, filters, { limit: 200 }),
    listAuditActorOptions(context),
  ]);
  const canExport = canExportAuditReport(context);
  const payloadsVisible = canReadAuditPayloads(context);
  const visibleEntityTypes = getVisibleAuditEntityTypes(context);
  const entityOptions = visibleEntityTypes ?? Object.keys(auditEntityLabels).sort();
  const payloadCount = logs.filter((log) => log.hasAfter || log.hasBefore || log.hasMetadata).length;

  return (
    <section className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-normal">Auditoria</h1>
          <p className="text-sm text-muted-foreground">
            Logs operacionais, filtros e rastreabilidade por perfil
          </p>
        </div>
        {canExport ? (
          <Link
            className={`${primaryButtonClassName} sm:w-auto`}
            href={`/app/auditoria/exportar?${buildSearchParams(filters)}` as Route}
          >
            <Download className="size-4" aria-hidden="true" />
            Exportar CSV
          </Link>
        ) : null}
      </div>

      <AuditFilterForm
        actorOptions={actorOptions}
        entityOptions={entityOptions}
        filters={filters}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Logs filtrados" value={String(logs.length)} />
        <SummaryCard label="Com payload" value={String(payloadCount)} />
        <SummaryCard label="Detalhes" value={payloadsVisible ? "Completos" : "Limitados"} />
      </div>

      <section className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-base font-semibold">Eventos recentes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Quando</th>
                <th className="px-4 py-3 font-medium">Acao</th>
                <th className="px-4 py-3 font-medium">Entidade</th>
                <th className="px-4 py-3 font-medium">Ator</th>
                <th className="px-4 py-3 font-medium">Payload</th>
                <th className="px-4 py-3 text-right font-medium">Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                    Nenhum log encontrado com os filtros atuais.
                  </td>
                </tr>
              ) : (
                logs.map((log) => <AuditLogRow key={log.id} log={log} />)
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function AuditFilterForm({
  actorOptions,
  entityOptions,
  filters,
}: {
  actorOptions: AuditActorOption[];
  entityOptions: string[];
  filters: AuditFilters;
}) {
  return (
    <form action="/app/auditoria" className="rounded-lg border bg-card p-4" method="get">
      <div className="grid gap-3 xl:grid-cols-[minmax(12rem,1fr)_minmax(10rem,0.5fr)_minmax(10rem,0.5fr)_minmax(10rem,0.5fr)_minmax(10rem,0.5fr)]">
        <label className={fieldClassName}>
          Busca
          <input
            className={inputClassName}
            defaultValue={filters.query ?? ""}
            name="q"
            placeholder="Ator, entidade ou ID"
          />
        </label>
        <label className={fieldClassName}>
          Acao
          <select className={inputClassName} defaultValue={filters.action ?? "all"} name="action">
            <option value="all">Todas</option>
            {auditActions.map((action) => (
              <option key={action} value={action}>
                {auditActionLabels[action]}
              </option>
            ))}
          </select>
        </label>
        <label className={fieldClassName}>
          Entidade
          <select className={inputClassName} defaultValue={filters.entityType ?? ""} name="entityType">
            <option value="">Todas</option>
            {entityOptions.map((entityType) => (
              <option key={entityType} value={entityType}>
                {auditEntityLabels[entityType] ?? entityType}
              </option>
            ))}
          </select>
        </label>
        <label className={fieldClassName}>
          Ator
          <select className={inputClassName} defaultValue={filters.actorUserId ?? ""} name="actorUserId">
            <option value="">Todos</option>
            {actorOptions.map((actor) => (
              <option key={actor.id} value={actor.id}>
                {actor.label}
              </option>
            ))}
          </select>
        </label>
        <label className={fieldClassName}>
          ID entidade
          <input className={inputClassName} defaultValue={filters.entityId ?? ""} name="entityId" />
        </label>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(10rem,0.25fr)_minmax(10rem,0.25fr)_auto_auto]">
        <label className={fieldClassName}>
          De
          <input className={inputClassName} defaultValue={filters.dateFrom ?? ""} name="dateFrom" type="date" />
        </label>
        <label className={fieldClassName}>
          Ate
          <input className={inputClassName} defaultValue={filters.dateTo ?? ""} name="dateTo" type="date" />
        </label>
        <button className={`${primaryButtonClassName} self-end`} type="submit">
          Filtrar
        </button>
        <Link className={`${secondaryButtonClassName} self-end`} href="/app/auditoria">
          Limpar
        </Link>
      </div>
    </form>
  );
}

function AuditLogRow({ log }: { log: AuditLogListItem }) {
  return (
    <tr className="border-b last:border-b-0">
      <td className="px-4 py-3 text-muted-foreground">{formatDateTime(log.createdAt)}</td>
      <td className="px-4 py-3">
        <Badge label={auditActionLabels[log.action as keyof typeof auditActionLabels] ?? log.action} />
      </td>
      <td className="px-4 py-3">
        <p className="font-medium">{auditEntityLabels[log.entityType] ?? log.entityType}</p>
        <p className="text-xs text-muted-foreground">{log.entityId ?? "-"}</p>
      </td>
      <td className="px-4 py-3">
        <p className="font-medium">{log.actorName ?? "Sistema"}</p>
        <p className="text-xs text-muted-foreground">{log.actorEmail ?? "-"}</p>
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {log.payloadsVisible
          ? log.hasBefore || log.hasAfter || log.hasMetadata
            ? "Disponivel"
            : "-"
          : "Restrito"}
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-end">
          <Link
            aria-label="Ver detalhe"
            className="inline-flex size-8 items-center justify-center rounded-md border border-primary/30 text-primary transition-colors hover:bg-primary/10"
            href={`/app/auditoria/${log.id}` as Route}
            title="Ver detalhe"
          >
            <Eye className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </td>
    </tr>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 break-words text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
      {label}
    </span>
  );
}

function buildSearchParams(filters: AuditFilters) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value && value !== "all") {
      params.set(key === "query" ? "q" : key, value);
    }
  }

  return params.toString();
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}

const inputClassName =
  "h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

const fieldClassName = "grid min-w-0 gap-1 text-sm font-medium";

const primaryButtonClassName =
  "inline-flex h-10 w-full min-w-0 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90";

const secondaryButtonClassName =
  "inline-flex h-10 w-full min-w-0 items-center justify-center rounded-md border px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";
