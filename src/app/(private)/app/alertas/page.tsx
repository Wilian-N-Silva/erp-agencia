import { Ban, CheckCircle2, RefreshCw } from "lucide-react";
import { redirect } from "next/navigation";

import { RateLimitedActionForm } from "@/components/fg";

import {
  dismissAlertAction,
  generateAlertsAction,
  resolveAlertAction,
} from "@/features/alerts/actions";
import {
  listAlertCandidates,
  listStoredAlerts,
  type StoredAlertListItem,
} from "@/features/alerts/dal";
import {
  alertKindLabels,
  alertSeverityLabels,
  alertStatusLabels,
  canWriteAlerts,
  normalizeAlertFilters,
  type AlertCandidate,
  type AlertFilters,
  type AlertSeverity,
  type AlertStatus,
} from "@/features/alerts/rules";
import { formatDate } from "@/features/finance/rules";
import { resolveWorkItemAction } from "@/features/work-items/actions";
import {
  listActionableWorkItems,
  type ActionableWorkItemListItem,
} from "@/features/work-items/dal";
import type {
  WorkItemPriority,
  WorkItemStatus,
} from "@/features/work-items/rules";
import { getCurrentAccessContext } from "@/lib/dal";
import { canAny } from "@/lib/rbac";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AlertsPage({ searchParams }: PageProps) {
  const context = await getCurrentAccessContext();

  if (!context) {
    redirect("/login");
  }

  if (!canAny(["alerts.read", "alerts.write"], context)) {
    redirect("/acesso-negado");
  }

  const filters = normalizeAlertFilters((await searchParams) ?? {});
  const canWrite = canWriteAlerts(context);
  const [candidates, storedAlerts, actionableWorkItems] = await Promise.all([
    listAlertCandidates(context, filters),
    listStoredAlerts(context, filters),
    listActionableWorkItems(context),
  ]);
  const criticalCandidates = candidates.filter((alert) => alert.severity === "critical").length;
  const openStored = storedAlerts.filter((alert) => alert.status === "open").length;

  return (
    <section className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-normal">Alertas</h1>
          <p className="text-sm text-muted-foreground">
            Pendencias calculadas, snapshots persistidos e resolucao operacional
          </p>
        </div>
        {canWrite ? (
          <RateLimitedActionForm action={generateAlertsAction}>
            <button className={`${primaryButtonClassName} sm:w-auto`} type="submit">
              <RefreshCw className="size-4" aria-hidden="true" />
              Gerar alertas
            </button>
          </RateLimitedActionForm>
        ) : null}
      </div>

      <AlertFilterForm filters={filters} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Candidatos atuais" value={String(candidates.length)} />
        <SummaryCard label="Criticos atuais" value={String(criticalCandidates)} />
        <SummaryCard label="Alertas abertos" value={String(openStored)} />
        <SummaryCard label="Pendencias v2" value={String(actionableWorkItems.length)} />
      </div>

      <section className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-base font-semibold">Pendencias acionaveis</h2>
          <p className="text-sm text-muted-foreground">
            Itens persistidos que exigem acompanhamento e uma resolucao registrada.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="border-b bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Pendencia</th>
                <th className="px-4 py-3 font-medium">Prioridade</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Prazo</th>
                <th className="px-4 py-3 font-medium">Responsavel</th>
                <th className="px-4 py-3 font-medium">Resolucao</th>
              </tr>
            </thead>
            <tbody>
              {actionableWorkItems.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                    Nenhuma pendencia acionavel em aberto.
                  </td>
                </tr>
              ) : (
                actionableWorkItems.map((item) => (
                  <ActionableWorkItemRow canWrite={canWrite} item={item} key={item.id} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-base font-semibold">Calculados agora</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Alerta</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Severidade</th>
                <th className="px-4 py-3 font-medium">Prazo</th>
                <th className="px-4 py-3 font-medium">Entidade</th>
              </tr>
            </thead>
            <tbody>
              {candidates.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-muted-foreground" colSpan={5}>
                    Nenhum alerta calculado com os filtros atuais.
                  </td>
                </tr>
              ) : (
                candidates.map((alert) => <AlertCandidateRow alert={alert} key={`${alert.entityType}:${alert.entityId}:${alert.title}`} />)
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-base font-semibold">Persistidos</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Alerta</th>
                <th className="px-4 py-3 font-medium">Severidade</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Prazo</th>
                <th className="px-4 py-3 font-medium">Criado</th>
                {canWrite ? <th className="px-4 py-3 text-right font-medium">Acoes</th> : null}
              </tr>
            </thead>
            <tbody>
              {storedAlerts.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-muted-foreground" colSpan={canWrite ? 6 : 5}>
                    Nenhum alerta persistido.
                  </td>
                </tr>
              ) : (
                storedAlerts.map((alert) => (
                  <StoredAlertRow alert={alert} canWrite={canWrite} key={alert.id} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function ActionableWorkItemRow({
  canWrite,
  item,
}: {
  canWrite: boolean;
  item: ActionableWorkItemListItem;
}) {
  return (
    <tr className="border-b last:border-b-0">
      <td className="px-4 py-3">
        <p className="font-medium">{item.title}</p>
        <p className="text-xs text-muted-foreground">{item.description}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {item.sourceType}:{item.sourceId.slice(0, 8)}
        </p>
      </td>
      <td className="px-4 py-3">
        <WorkItemPriorityBadge priority={item.priority} />
      </td>
      <td className="px-4 py-3">
        <WorkItemStatusBadge status={item.status} />
      </td>
      <td className="px-4 py-3 text-muted-foreground">{formatDate(item.dueAt)}</td>
      <td className="px-4 py-3 text-muted-foreground">{item.ownerName ?? "Nao atribuido"}</td>
      <td className="px-4 py-3">
        {canWrite ? (
          <RateLimitedActionForm action={resolveWorkItemAction} className="flex min-w-[20rem] gap-2">
            <input name="id" type="hidden" value={item.id} />
            <label className="sr-only" htmlFor={`resolution-${item.id}`}>
              Motivo da resolucao de {item.title}
            </label>
            <input
              className={inputClassName}
              id={`resolution-${item.id}`}
              maxLength={2000}
              minLength={3}
              name="resolution"
              placeholder="Informe como a pendencia foi resolvida"
              required
            />
            <button className={`${primaryButtonClassName} w-auto shrink-0`} type="submit">
              <CheckCircle2 className="size-4" aria-hidden="true" />
              Resolver
            </button>
          </RateLimitedActionForm>
        ) : (
          <span className="text-muted-foreground">Somente leitura</span>
        )}
      </td>
    </tr>
  );
}

function AlertFilterForm({ filters }: { filters: AlertFilters }) {
  return (
    <form action="/app/alertas" className="rounded-lg border bg-card p-4" method="get">
      <div className="grid gap-3 md:grid-cols-[minmax(14rem,1fr)_minmax(10rem,0.3fr)_minmax(10rem,0.3fr)_auto_auto]">
        <label className={fieldClassName}>
          Busca
          <input
            className={inputClassName}
            defaultValue={filters.query ?? ""}
            name="q"
            placeholder="Titulo ou descricao"
          />
        </label>
        <label className={fieldClassName}>
          Severidade
          <select className={inputClassName} defaultValue={filters.severity ?? "all"} name="severity">
            <option value="all">Todas</option>
            {Object.entries(alertSeverityLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className={fieldClassName}>
          Status
          <select className={inputClassName} defaultValue={filters.status ?? "open"} name="status">
            <option value="all">Todos</option>
            {Object.entries(alertStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button className={`${primaryButtonClassName} self-end`} type="submit">
          Filtrar
        </button>
        <a className={`${secondaryButtonClassName} self-end`} href="/app/alertas">
          Limpar
        </a>
      </div>
    </form>
  );
}

function AlertCandidateRow({ alert }: { alert: AlertCandidate }) {
  return (
    <tr className="border-b last:border-b-0">
      <td className="px-4 py-3">
        <p className="font-medium">{alert.title}</p>
        <p className="text-xs text-muted-foreground">{alert.description}</p>
      </td>
      <td className="px-4 py-3 text-muted-foreground">{alertKindLabels[alert.kind]}</td>
      <td className="px-4 py-3">
        <SeverityBadge severity={alert.severity} />
      </td>
      <td className="px-4 py-3 text-muted-foreground">{formatDate(alert.dueDate)}</td>
      <td className="px-4 py-3 text-muted-foreground">
        {alert.entityType}:{alert.entityId.slice(0, 8)}
      </td>
    </tr>
  );
}

function StoredAlertRow({
  alert,
  canWrite,
}: {
  alert: StoredAlertListItem;
  canWrite: boolean;
}) {
  return (
    <tr className="border-b last:border-b-0">
      <td className="px-4 py-3">
        <p className="font-medium">{alert.title}</p>
        <p className="text-xs text-muted-foreground">{alert.description ?? "-"}</p>
      </td>
      <td className="px-4 py-3">
        <SeverityBadge severity={alert.severity} />
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={alert.status} />
      </td>
      <td className="px-4 py-3 text-muted-foreground">{formatDate(alert.dueDate)}</td>
      <td className="px-4 py-3 text-muted-foreground">{formatDate(alert.createdAt)}</td>
      {canWrite ? (
        <td className="px-4 py-3">
          {alert.status === "open" ? (
            <div className="flex justify-end gap-2">
              <form action={resolveAlertAction}>
                <input name="id" type="hidden" value={alert.id} />
                <IconButton icon={CheckCircle2} label="Resolver" tone="primary" />
              </form>
              <form action={dismissAlertAction}>
                <input name="id" type="hidden" value={alert.id} />
                <IconButton icon={Ban} label="Dispensar" tone="destructive" />
              </form>
            </div>
          ) : null}
        </td>
      ) : null}
    </tr>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  const className =
    severity === "critical" || severity === "high"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : severity === "medium"
        ? "border-secondary/30 bg-secondary/10 text-secondary-foreground"
        : "border-muted bg-muted text-muted-foreground";

  return <Badge className={className} label={alertSeverityLabels[severity]} />;
}

function StatusBadge({ status }: { status: AlertStatus }) {
  const className =
    status === "open"
      ? "border-secondary/30 bg-secondary/10 text-secondary-foreground"
      : status === "resolved"
        ? "border-primary/30 bg-primary/10 text-primary"
        : "border-muted bg-muted text-muted-foreground";

  return <Badge className={className} label={alertStatusLabels[status]} />;
}

function WorkItemPriorityBadge({ priority }: { priority: WorkItemPriority }) {
  const className =
    priority === "critical" || priority === "high"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : priority === "medium"
        ? "border-secondary/30 bg-secondary/10 text-secondary-foreground"
        : "border-muted bg-muted text-muted-foreground";

  return <Badge className={className} label={workItemPriorityLabels[priority]} />;
}

function WorkItemStatusBadge({ status }: { status: WorkItemStatus }) {
  const className =
    status === "open"
      ? "border-secondary/30 bg-secondary/10 text-secondary-foreground"
      : "border-primary/30 bg-primary/10 text-primary";

  return <Badge className={className} label={workItemStatusLabels[status]} />;
}

function Badge({ className, label }: { className: string; label: string }) {
  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

function IconButton({
  icon: Icon,
  label,
  tone,
}: {
  icon: typeof CheckCircle2;
  label: string;
  tone: "destructive" | "primary";
}) {
  const className =
    tone === "primary"
      ? "border-primary/30 text-primary hover:bg-primary/10"
      : "border-destructive/30 text-destructive hover:bg-destructive/10";

  return (
    <button
      aria-label={label}
      className={`inline-flex size-8 items-center justify-center rounded-md border transition-colors ${className}`}
      title={label}
      type="submit"
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}

const inputClassName =
  "h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

const fieldClassName = "grid min-w-0 gap-1 text-sm font-medium";

const primaryButtonClassName =
  "inline-flex h-10 w-full min-w-0 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90";

const secondaryButtonClassName =
  "inline-flex h-10 w-full min-w-0 items-center justify-center rounded-md border px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

const workItemPriorityLabels: Record<WorkItemPriority, string> = {
  low: "Baixa",
  medium: "Media",
  high: "Alta",
  critical: "Critica",
};

const workItemStatusLabels: Record<WorkItemStatus, string> = {
  open: "Aberta",
  in_progress: "Em andamento",
  resolved: "Resolvida",
  dismissed: "Dispensada",
};
