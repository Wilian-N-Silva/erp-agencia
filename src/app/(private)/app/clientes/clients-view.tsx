"use client";

import {
  AlertCircle,
  ArrowDownRight,
  CalendarClock,
  CalendarPlus,
  Clock,
  Download,
  MoreHorizontal,
  PauseCircle,
  Pencil,
  Plus,
  Repeat,
} from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";

import {
  Avatar,
  DataTable,
  Dropdown,
  FilterPopover,
  KpiCard,
  Page,
  PageHeader,
  Pagination,
  StatusBadge,
  Toolbar,
} from "@/components/fg";
import type { DataTableColumn, SortDir } from "@/components/fg/data-table";
import {
  clientFinancialStatusLabels,
  clientStatusLabels,
  type ClientFinancialStatus,
  type ClientListItem,
  type ClientStatus,
} from "@/features/clients/rules";
import { formatMoney, moneyToCents } from "@/features/finance/rules";

const statusOptions = Object.values(clientStatusLabels);
const monthStatusOptions = Object.values(clientFinancialStatusLabels);

const STATUS_TONE: Record<ClientStatus, string> = {
  active: "ativo",
  paused: "pausado",
  cancelled: "cancelado",
};

const MONTH_STATUS_TONE: Record<
  ClientFinancialStatus,
  "success" | "warning" | "warning-soft" | "danger" | "muted" | "brand"
> = {
  not_generated: "muted",
  planned: "warning",
  due_today: "brand",
  overdue: "danger",
  partial: "warning",
  received: "success",
  cancelled: "muted",
  restricted: "muted",
};

function formatDayMonth(dateKey: string | null) {
  if (!dateKey) return "—";
  const [, m, d] = dateKey.split("-");
  if (!m || !d) return "—";
  return `${d}/${m}`;
}

function formatRelative(dateKey: string | null, now = new Date()) {
  if (!dateKey) return "";
  const target = new Date(`${dateKey}T00:00:00.000Z`);
  const today = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
  );
  const days = Math.round(
    (target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (days === 0) return "hoje";
  if (days === 1) return "amanhã";
  if (days === -1) return "ontem";
  if (days > 0 && days <= 30) return `em ${days} dias`;
  if (days < 0 && days >= -30) return `há ${-days} dias`;
  if (days > 30) return `em ${Math.round(days / 30)} meses`;
  return `há ${Math.round(-days / 30)} meses`;
}

export interface ClientMonthlyStatus {
  status: ClientFinancialStatus;
  openCount: number;
  hasOverdue: boolean;
  nextDueDate: string | null;
}

export interface ClientKpis {
  feeRecorrente: string;
  aReceberMes: string;
  recebidoMes: string;
  emAtraso: string;
  feeHidden: boolean;
  contractsActive: number;
  clientsOverdue: number;
}

interface ClientsViewProps {
  clients: ClientListItem[];
  canWrite: boolean;
  monthlyByClient: Record<string, ClientMonthlyStatus>;
  kpis: ClientKpis;
  rowActions?: Record<string, React.ReactNode>;
  exportHref?: string;
  newClientHref?: string;
}

export function ClientsView({
  clients,
  canWrite,
  monthlyByClient,
  kpis,
  rowActions,
  exportHref,
  newClientHref,
}: ClientsViewProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [monthFilter, setMonthFilter] = useState<string[]>([]);
  const [respFilter, setRespFilter] = useState<string[]>([]);
  const [density, setDensity] = useState<"regular" | "compact">("regular");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState<{ key: string; dir: SortDir }>({
    key: "name",
    dir: "asc",
  });

  const onSort = (key: string) =>
    setSort((p) =>
      p.key === key ? { key, dir: p.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );

  const updateSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };
  const updateStatusFilter = (value: string[]) => {
    setStatusFilter(value);
    setPage(1);
  };
  const updateMonthFilter = (value: string[]) => {
    setMonthFilter(value);
    setPage(1);
  };
  const updateRespFilter = (value: string[]) => {
    setRespFilter(value);
    setPage(1);
  };

  const responsaveis = useMemo(
    () =>
      Array.from(
        new Set(
          clients
            .map((c) => c.internalOwnerName)
            .filter((n): n is string => !!n),
        ),
      ).sort(),
    [clients],
  );

  const filtered = useMemo(() => {
    let xs = clients;
    if (search) {
      const q = search.toLowerCase();
      xs = xs.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q) ||
          (c.internalOwnerName ?? "").toLowerCase().includes(q),
      );
    }
    if (statusFilter.length) {
      xs = xs.filter((c) => statusFilter.includes(clientStatusLabels[c.status]));
    }
    if (monthFilter.length) {
      xs = xs.filter((c) => {
        const ms = monthlyByClient[c.id]?.status ?? "not_generated";
        return monthFilter.includes(clientFinancialStatusLabels[ms]);
      });
    }
    if (respFilter.length) {
      xs = xs.filter(
        (c) => c.internalOwnerName && respFilter.includes(c.internalOwnerName),
      );
    }
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...xs].sort((a, b) => {
      const x = getClientSortValue(a, sort.key, monthlyByClient);
      const y = getClientSortValue(b, sort.key, monthlyByClient);
      if (x < y) return -1 * dir;
      if (x > y) return 1 * dir;
      return 0;
    });
  }, [clients, search, statusFilter, monthFilter, respFilter, sort, monthlyByClient]);

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const columns: DataTableColumn<ClientListItem>[] = [
    {
      key: "name",
      label: "Cliente",
      sortable: true,
      render: (r) => {
        const ms = monthlyByClient[r.id];
        const multiOpen = ms && ms.openCount > 1;
        return (
          <Link
            href={`/app/clientes/${r.id}` as Route}
            className="fg-cell-user fg-cell-link"
          >
            <Avatar name={r.name} size={28} />
            <div>
              <div className="fg-cell-strong">
                {r.name}
                {multiOpen ? (
                  <span
                    title={`${ms!.openCount} cobranças em aberto`}
                    style={{
                      marginLeft: 6,
                      verticalAlign: "-2px",
                      color: "var(--status-warning-text)",
                    }}
                  >
                    <AlertCircle size={13} />
                  </span>
                ) : null}
              </div>
              <div className="fg-cell-sub fg-mono">{r.code}</div>
            </div>
          </Link>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <StatusBadge status={STATUS_TONE[r.status]} label={clientStatusLabels[r.status]} />
      ),
    },
    {
      key: "monthlyFee",
      label: "Fee mensal",
      sortable: true,
      align: "right",
      render: (r) => (
        <span className="fg-tabular fg-cell-strong">
          {r.valueHidden ? (
            <span className="fg-muted">Restrito</span>
          ) : (
            formatMoney(r.monthlyFee)
          )}
        </span>
      ),
    },
    {
      key: "billingDay",
      label: "Dia cob.",
      align: "right",
      render: (r) => <span className="fg-tabular fg-muted">dia {r.billingDay}</span>,
    },
    {
      key: "nextDue",
      label: "Próx. vencimento",
      render: (r) => {
        const ms = monthlyByClient[r.id];
        if (!ms?.nextDueDate) return <span className="fg-muted">—</span>;
        return (
          <div className="fg-cell-strong fg-tabular">
            {formatDayMonth(ms.nextDueDate)}
            <div className="fg-cell-sub">{formatRelative(ms.nextDueDate)}</div>
          </div>
        );
      },
    },
    {
      key: "monthStatus",
      label: "Status do mês",
      render: (r) => {
        const ms = monthlyByClient[r.id];
        const status: ClientFinancialStatus = ms?.status ?? "not_generated";
        return (
          <StatusBadge
            tone={MONTH_STATUS_TONE[status]}
            label={clientFinancialStatusLabels[status]}
          />
        );
      },
    },
    {
      key: "internalOwnerName",
      label: "Responsável",
      render: (r) =>
        r.internalOwnerName ? (
          <div className="fg-cell-user">
            <Avatar name={r.internalOwnerName} size={22} />
            <span>{r.internalOwnerName.split(" ")[0]}</span>
          </div>
        ) : (
          <span className="fg-muted">—</span>
        ),
    },
  ];

  if (rowActions) {
    columns.push({
      key: "_actions",
      label: "",
      width: 44,
      render: (r) => rowActions[r.id] ?? null,
    });
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Financeiro"
        title="Clientes"
        description={`${filtered.length} clientes · ${kpis.contractsActive} com fee recorrente ativo`}
        actions={
          <>
            {exportHref ? (
              <a
                href={exportHref}
                className="fg-btn fg-btn-outline fg-btn-sm"
              >
                <Download size={14} aria-hidden />
                <span>Exportar</span>
              </a>
            ) : null}
            {canWrite && newClientHref ? (
              <Link className="fg-btn fg-btn-primary fg-btn-sm" href={newClientHref as Route}>
                <Plus size={14} aria-hidden />
                <span>Novo cliente</span>
              </Link>
            ) : null}
          </>
        }
      />

      <div className="fg-grid fg-grid-4">
        <KpiCard
          label="Fee recorrente"
          value={kpis.feeHidden ? "Restrito" : kpis.feeRecorrente}
          secondary={`${kpis.contractsActive} contratos ativos`}
          icon={<Repeat size={16} />}
        />
        <KpiCard
          label="A receber no mês"
          value={kpis.aReceberMes}
          secondary="cobranças previstas"
          icon={<Clock size={16} />}
        />
        <KpiCard
          label="Recebido no mês"
          value={kpis.recebidoMes}
          secondary="confirmado"
          icon={<ArrowDownRight size={16} />}
          accent
        />
        <KpiCard
          label="Em atraso"
          value={kpis.emAtraso}
          secondary={`${kpis.clientsOverdue} cliente${kpis.clientsOverdue !== 1 ? "s" : ""} atrasado${kpis.clientsOverdue !== 1 ? "s" : ""}`}
          icon={<AlertCircle size={16} />}
        />
      </div>

      <Toolbar
        search={search}
        onSearch={updateSearch}
        placeholder="Nome, código, responsável..."
        filters={
          <>
            <FilterPopover
              label="Status"
              value={statusFilter}
              onChange={updateStatusFilter}
              options={statusOptions}
            />
            <FilterPopover
              label="Status do mês"
              value={monthFilter}
              onChange={updateMonthFilter}
              options={monthStatusOptions}
            />
            <FilterPopover
              label="Responsável"
              value={respFilter}
              onChange={updateRespFilter}
              options={responsaveis}
            />
          </>
        }
        density={density}
        onDensity={setDensity}
      />

      <DataTable
        columns={columns}
        data={paged}
        getRowKey={(r) => r.id}
        sortKey={sort.key}
        sortDir={sort.dir}
        onSort={onSort}
        density={density}
        rowAttention={(r) =>
          monthlyByClient[r.id]?.hasOverdue ? "danger" : null
        }
        emptyMessage="Nenhum cliente para os filtros selecionados."
      />

      <Pagination
        page={page}
        pageSize={pageSize}
        total={filtered.length}
        onPage={setPage}
        onPageSize={(v) => {
          setPageSize(v);
          setPage(1);
        }}
      />
    </Page>
  );
}

function getClientSortValue(
  client: ClientListItem,
  key: string,
  monthlyByClient: Record<string, ClientMonthlyStatus>,
) {
  switch (key) {
    case "monthlyFee":
      return moneyToCents(client.monthlyFee);
    case "billingDay":
      return client.billingDay ?? 0;
    case "nextDue":
      return monthlyByClient[client.id]?.nextDueDate ?? "9999-12-31";
    case "monthStatus":
      return monthlyByClient[client.id]?.status ?? "not_generated";
    case "internalOwnerName":
      return client.internalOwnerName ?? "";
    case "status":
      return clientStatusLabels[client.status];
    default: {
      const value = (client as unknown as Record<string, unknown>)[key];
      if (typeof value === "number") return value;
      if (typeof value === "string") return value;
      return "";
    }
  }
}

export function ClientRowMenu({
  clientId,
  status,
  canWrite,
}: {
  clientId: string;
  status: ClientStatus;
  canWrite: boolean;
}) {
  const items: Array<
    | { separator: true }
    | {
        label: React.ReactNode;
        icon?: React.ReactNode;
        onClick?: () => void;
        danger?: boolean;
      }
  > = [
    {
      label: "Abrir cliente",
      icon: <CalendarClock size={14} />,
      onClick: () => {
        window.location.href = `/app/clientes/${clientId}`;
      },
    },
  ];

  if (canWrite) {
    items.push({
      label: "Editar cadastro",
      icon: <Pencil size={14} />,
      onClick: () => {
        window.location.href = `/app/clientes/${clientId}?tab=cobranca`;
      },
    });
    items.push({
      label: "Gerar entrada prevista",
      icon: <CalendarPlus size={14} />,
      onClick: () => {
        window.location.href = `/app/clientes/${clientId}?tab=cobranca`;
      },
    });
    items.push({ separator: true });
    items.push({
      label: status === "active" ? "Pausar" : "Reativar",
      icon: <PauseCircle size={14} />,
      onClick: () => {
        window.location.href = `/app/clientes/${clientId}`;
      },
    });
  }

  return (
    <Dropdown
      align="right"
      trigger={
        <button
          type="button"
          className="fg-icon-btn sm"
          title="Ações"
          aria-label="Ações"
        >
          <MoreHorizontal size={14} />
        </button>
      }
      items={items}
    />
  );
}
