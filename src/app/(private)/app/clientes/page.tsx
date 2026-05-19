import {
  Ban,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  PauseCircle,
  Plus,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { updateClientStatusAction } from "@/features/clients/actions";
import { listClients } from "@/features/clients/dal";
import {
  canWriteClients,
  clientStatusLabels,
  normalizeClientFilters,
  type ClientFilters,
  type ClientStatus,
} from "@/features/clients/rules";
import { centsToMoney, formatMoney, moneyToCents } from "@/features/finance/rules";
import { getCurrentAccessContext } from "@/lib/dal";
import { canAny } from "@/lib/rbac";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ClientsPage({ searchParams }: PageProps) {
  const context = await getCurrentAccessContext();

  if (!context) {
    redirect("/login");
  }

  if (!canAny(["clients.read", "clients.read_limited", "clients.configure"], context)) {
    redirect("/acesso-negado");
  }

  const filters = normalizeClientFilters((await searchParams) ?? {});
  const clients = await listClients(context, filters);
  const activeClients = clients.filter((client) => client.status === "active").length;
  const pausedClients = clients.filter((client) => client.status === "paused");
  const portfolioClients = clients.filter((client) => client.status !== "paused");
  const visibleMonthlyFeeCents = clients.reduce(
    (total, client) => total + moneyToCents(client.monthlyFee),
    0,
  );
  const canWrite = canWriteClients(context);

  return (
    <section className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-normal">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            {canWrite ? "Gestao de carteira" : "Carteira disponivel"}
          </p>
        </div>
        {canWrite ? (
          <Link className={`${primaryButtonClassName} sm:w-auto`} href="/app/clientes/novo">
            <Plus className="size-4" aria-hidden="true" />
            Novo cliente
          </Link>
        ) : null}
      </div>

      <ClientFilterForm filters={filters} />

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard icon={Building2} label="Clientes" value={String(clients.length)} />
        <SummaryCard icon={UsersRound} label="Ativos" value={String(activeClients)} />
        <SummaryCard
          icon={CircleDollarSign}
          label="Fee mensal visivel"
          value={
            visibleMonthlyFeeCents > 0
              ? formatMoney(centsToMoney(visibleMonthlyFeeCents))
              : "-"
          }
        />
      </div>

      <section className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-base font-semibold">Carteira ativa e cancelada</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Codigo</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Responsavel</th>
                <th className="px-4 py-3 font-medium">Cobranca</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Fee mensal</th>
                {canWrite ? <th className="px-4 py-3 text-right font-medium">Acoes</th> : null}
              </tr>
            </thead>
            <tbody>
              {portfolioClients.length === 0 ? (
                <tr>
                  <td
                    className="px-4 py-8 text-center text-muted-foreground"
                    colSpan={canWrite ? 7 : 6}
                  >
                    Nenhum cliente cadastrado.
                  </td>
                </tr>
              ) : (
                portfolioClients.map((client) => (
                  <tr className="border-b last:border-b-0" key={client.id}>
                    <td className="px-4 py-3 font-medium">{client.code}</td>
                    <td className="px-4 py-3">
                      <Link
                        className="font-medium text-primary underline-offset-4 hover:underline"
                        href={`/app/clientes/${client.id}` as Route}
                      >
                        {client.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {client.internalOwnerName ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      Dia {client.billingDay}
                    </td>
                    <td className="px-4 py-3">
                      <ClientStatusBadge status={client.status} />
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {client.valueHidden ? "Restrito" : formatMoney(client.monthlyFee)}
                    </td>
                    {canWrite ? (
                      <td className="px-4 py-3">
                        <ClientActions id={client.id} status={client.status} />
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {pausedClients.length > 0 ? (
        <section className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="text-base font-semibold">Clientes pausados</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b bg-muted/60 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Codigo</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Responsavel</th>
                  <th className="px-4 py-3 font-medium">Cobranca</th>
                  <th className="px-4 py-3 text-right font-medium">Fee mensal</th>
                  {canWrite ? <th className="px-4 py-3 text-right font-medium">Acoes</th> : null}
                </tr>
              </thead>
              <tbody>
                {pausedClients.map((client) => (
                  <tr className="border-b last:border-b-0" key={client.id}>
                    <td className="px-4 py-3 font-medium">{client.code}</td>
                    <td className="px-4 py-3">
                      <Link
                        className="font-medium text-primary underline-offset-4 hover:underline"
                        href={`/app/clientes/${client.id}` as Route}
                      >
                        {client.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {client.internalOwnerName ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      Dia {client.billingDay}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {client.valueHidden ? "Restrito" : formatMoney(client.monthlyFee)}
                    </td>
                    {canWrite ? (
                      <td className="px-4 py-3">
                        <ClientActions id={client.id} status={client.status} />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </section>
  );
}

function ClientFilterForm({ filters }: { filters: ClientFilters }) {
  return (
    <form action="/app/clientes" className="rounded-lg border bg-card p-4" method="get">
      <div className="grid gap-3 md:grid-cols-[minmax(14rem,1fr)_minmax(10rem,0.35fr)_auto_auto]">
        <label className={fieldClassName}>
          Busca
          <input
            className={inputClassName}
            defaultValue={filters.query ?? ""}
            name="q"
            placeholder="Nome, codigo, responsavel"
          />
        </label>
        <label className={fieldClassName}>
          Status
          <select
            className={inputClassName}
            defaultValue={filters.status ?? "all"}
            name="status"
          >
            <option value="all">Todos</option>
            {Object.entries(clientStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button className={`${primaryButtonClassName} self-end`} type="submit">
          Filtrar
        </button>
        <Link className={`${secondaryButtonClassName} self-end`} href="/app/clientes">
          Limpar
        </Link>
      </div>
    </form>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function ClientActions({ id, status }: { id: string; status: ClientStatus }) {
  return (
    <div className="flex justify-end gap-2">
      {status !== "active" ? (
        <StatusActionButton id={id} label="Ativar" status="active" tone="primary" />
      ) : null}
      {status !== "paused" ? (
        <StatusActionButton id={id} label="Pausar" status="paused" tone="warning" />
      ) : null}
      {status !== "cancelled" ? (
        <StatusActionButton id={id} label="Cancelar" status="cancelled" tone="destructive" />
      ) : null}
    </div>
  );
}

function StatusActionButton({
  id,
  label,
  status,
  tone,
}: {
  id: string;
  label: string;
  status: ClientStatus;
  tone: "destructive" | "primary" | "warning";
}) {
  const Icon = tone === "primary" ? CheckCircle2 : tone === "warning" ? PauseCircle : Ban;
  const className =
    tone === "primary"
      ? "border-primary/30 text-primary hover:bg-primary/10"
      : tone === "warning"
        ? "border-secondary/30 text-secondary-foreground hover:bg-secondary/10"
        : "border-destructive/30 text-destructive hover:bg-destructive/10";

  return (
    <form action={updateClientStatusAction}>
      <input name="id" type="hidden" value={id} />
      <input name="status" type="hidden" value={status} />
      <button
        aria-label={label}
        className={`inline-flex size-8 items-center justify-center rounded-md border transition-colors ${className}`}
        title={label}
        type="submit"
      >
        <Icon className="size-4" aria-hidden="true" />
      </button>
    </form>
  );
}

function ClientStatusBadge({ status }: { status: ClientStatus }) {
  const className =
    status === "active"
      ? "border-primary/30 bg-primary/10 text-primary"
      : status === "cancelled"
        ? "border-muted bg-muted text-muted-foreground"
        : "border-secondary/30 bg-secondary/10 text-secondary-foreground";

  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${className}`}>
      {clientStatusLabels[status]}
    </span>
  );
}

const inputClassName =
  "h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

const fieldClassName = "grid min-w-0 gap-1 text-sm font-medium";

const primaryButtonClassName =
  "inline-flex h-10 w-full min-w-0 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90";

const secondaryButtonClassName =
  "inline-flex h-10 w-full min-w-0 items-center justify-center rounded-md border px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";
