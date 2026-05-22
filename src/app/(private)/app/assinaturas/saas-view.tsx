"use client";

import { AlertTriangle, LayoutGrid, List as ListIcon } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import {
  DataTable,
  FilterPopover,
  KpiCard,
  Page,
  PageHeader,
  Pagination,
  StatusBadge,
  Toolbar,
} from "@/components/fg";
import type { DataTableColumn } from "@/components/fg/data-table";
import type { SaasSubscriptionListItem } from "@/features/saas/dal";
import {
  saasSubscriptionStatusLabels,
  type SaasSubscriptionStatus,
} from "@/features/saas/rules";
import { formatDate, formatMoney } from "@/features/finance/rules";

const statusOptions = Object.values(saasSubscriptionStatusLabels);

const STATUS_TONE: Record<SaasSubscriptionStatus, string> = {
  active: "ativo",
  trial: "previsto",
  suspended: "pausado",
  cancelled: "cancelado",
  renewing: "aguardando_envio",
  cancel_scheduled: "atrasado",
};

const RENEWAL_TONE: Record<
  SaasSubscriptionListItem["renewalState"],
  { label: string; tone: "danger" | "warning" | "success" | "muted" }
> = {
  overdue: { label: "Vencida", tone: "danger" },
  due_soon: { label: "Próxima", tone: "warning" },
  ok: { label: "Em dia", tone: "success" },
  none: { label: "Sem data", tone: "muted" },
};

function LogoMark({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
  const hue = (name.charCodeAt(0) * 47) % 360;
  return (
    <span
      className="fg-saas-logo"
      style={{ background: `oklch(0.62 0.13 ${hue})` }}
    >
      {initials}
    </span>
  );
}

interface SaasViewProps {
  subscriptions: SaasSubscriptionListItem[];
  canWrite: boolean;
  canSeeCosts: boolean;
  primaryAction?: ReactNode;
  rowActions?: Record<string, ReactNode>;
}

export function SaasView({
  subscriptions,
  canSeeCosts,
  primaryAction,
  rowActions,
}: SaasViewProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [renewalFilter, setRenewalFilter] = useState<string[]>([]);
  const [view, setView] = useState<"cards" | "list">("cards");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filtered = useMemo(() => {
    let xs = subscriptions;
    if (search) {
      const q = search.toLowerCase();
      xs = xs.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.provider ?? "").toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q),
      );
    }
    if (statusFilter.length) {
      xs = xs.filter((s) =>
        statusFilter.includes(saasSubscriptionStatusLabels[s.status]),
      );
    }
    if (renewalFilter.length) {
      xs = xs.filter((s) => renewalFilter.includes(RENEWAL_TONE[s.renewalState].label));
    }
    return xs;
  }, [subscriptions, search, statusFilter, renewalFilter]);

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const totalMonthly = canSeeCosts
    ? subscriptions.reduce((sum, s) => {
        if (s.costHidden) return sum;
        const n = Number.parseFloat(s.monthlyCost ?? "0");
        return sum + (Number.isFinite(n) ? n : 0);
      }, 0)
    : null;

  // Critical license: a "terminated" employee still holds an active license.
  const terminatedLicensesBySub = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of subscriptions) {
      const count = s.linkedUsers.filter(
        (u) => u.status === "active" && u.employeeStatus === "terminated",
      ).length;
      if (count > 0) map[s.id] = count;
    }
    return map;
  }, [subscriptions]);

  const renewalAlerts = subscriptions.filter(
    (s) => s.renewalState === "due_soon" || s.renewalState === "overdue",
  ).length;
  const subsWithAlert = subscriptions.filter(
    (s) => terminatedLicensesBySub[s.id] > 0,
  ).length;

  const columns: DataTableColumn<SaasSubscriptionListItem>[] = [
    {
      key: "name",
      label: "Assinatura",
      render: (r) => (
        <Link
          href={`/app/assinaturas/${r.id}` as Route}
          className="fg-cell-link"
          style={{ display: "inline-flex", alignItems: "center", gap: 10 }}
        >
          <span
            className="fg-saas-logo sm"
            style={{ background: "var(--surface-2)", color: "var(--ink-700)" }}
          >
            {r.name.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <div className="fg-cell-strong">{r.name}</div>
            <div className="fg-cell-sub">
              {r.provider ?? "—"} · {r.category}
            </div>
          </div>
        </Link>
      ),
    },
    {
      key: "linkedUsers",
      label: "Licenças",
      render: (r) => {
        const active = r.linkedUsers.filter((u) => u.status === "active");
        return (
          <div>
            <div className="fg-tabular">{active.length}</div>
            <div className="fg-cell-sub">vinculadas</div>
          </div>
        );
      },
    },
    {
      key: "renewalDate",
      label: "Renovação",
      render: (r) => (
        <div>
          <StatusBadge
            tone={RENEWAL_TONE[r.renewalState].tone}
            label={RENEWAL_TONE[r.renewalState].label}
            withDot={false}
          />
          <div className="fg-cell-sub fg-tabular">{formatDate(r.renewalDate)}</div>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <StatusBadge
          status={STATUS_TONE[r.status]}
          label={saasSubscriptionStatusLabels[r.status]}
        />
      ),
    },
    {
      key: "monthlyCost",
      label: "Custo / mês",
      align: "right",
      render: (r) => (
        <span className="fg-tabular fg-cell-strong">
          {r.costHidden ? (
            <span className="fg-muted">Restrito</span>
          ) : (
            formatMoney(r.monthlyCost)
          )}
        </span>
      ),
    },
    {
      key: "_alert",
      label: "Alertas",
      render: (r) => {
        const count = terminatedLicensesBySub[r.id] ?? 0;
        if (count === 0) return <span className="fg-muted">—</span>;
        return (
          <span className="fg-saas-warn-row">
            <AlertTriangle size={12} />
            {count} desligado{count > 1 ? "s" : ""}
          </span>
        );
      },
    },
  ];

  if (rowActions) {
    columns.push({
      key: "_actions",
      label: "",
      width: 140,
      render: (r) => rowActions[r.id] ?? null,
    });
  }

  return (
    <Page>
      <PageHeader
        eyebrow="TI e Governança"
        title="Assinaturas"
        description={`${subscriptions.length} ferramentas · ${subscriptions.filter((s) => s.status === "active").length} ativas`}
        actions={
          <>
            <div className="fg-density-toggle">
              <button
                type="button"
                className={view === "cards" ? "active" : ""}
                title="Cards"
                onClick={() => setView("cards")}
              >
                <LayoutGrid size={14} />
              </button>
              <button
                type="button"
                className={view === "list" ? "active" : ""}
                title="Lista"
                onClick={() => setView("list")}
              >
                <ListIcon size={14} />
              </button>
            </div>
            {primaryAction}
          </>
        }
      />

      <div className="fg-grid fg-grid-kpis" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <KpiCard
          label="Custo mensal"
          value={totalMonthly !== null ? formatMoney(String(totalMonthly.toFixed(2))) : "Restrito"}
          secondary="visíveis ao perfil"
          accent
        />
        <KpiCard
          label="Custo anualizado"
          value={
            totalMonthly !== null
              ? formatMoney(String((totalMonthly * 12).toFixed(2)))
              : "Restrito"
          }
          secondary="estimativa 12 meses"
        />
        <KpiCard
          label="Renovações próximas"
          value={String(renewalAlerts)}
          secondary="14 dias / vencidas"
          accent={renewalAlerts > 0}
        />
        <KpiCard
          label="Com alerta"
          value={String(subsWithAlert)}
          secondary="licenças de desligado"
        />
      </div>

      <Toolbar
        search={search}
        onSearch={setSearch}
        placeholder="Nome, fornecedor, categoria..."
        filters={
          <>
            <FilterPopover
              label="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={statusOptions}
            />
            <FilterPopover
              label="Renovação"
              value={renewalFilter}
              onChange={setRenewalFilter}
              options={Array.from(new Set(Object.values(RENEWAL_TONE).map((r) => r.label)))}
            />
          </>
        }
      />

      {view === "cards" ? (
        <>
          <div className="fg-saas-grid">
            {paged.map((s) => {
              const active = s.linkedUsers.filter((u) => u.status === "active");
              const renewal = RENEWAL_TONE[s.renewalState];
              const alertSoon = s.renewalState === "due_soon" || s.renewalState === "overdue";
              const terminatedActive = terminatedLicensesBySub[s.id] ?? 0;
              return (
                <div
                  key={s.id}
                  className={`fg-saas-card ${alertSoon ? "alert-soon" : ""}`.trim()}
                >
                  <Link
                    href={`/app/assinaturas/${s.id}` as Route}
                    className="fg-cell-link"
                    style={{ display: "contents" }}
                  >
                    <div className="fg-saas-head">
                      <LogoMark name={s.name} />
                      <div className="fg-saas-head-meta">
                        <div className="fg-saas-name">{s.name}</div>
                        <div className="fg-saas-cat">
                          <span
                            className="fg-saas-cat-dot"
                            style={{ background: "var(--ink-400)" }}
                          />
                          {s.category}
                        </div>
                      </div>
                      <StatusBadge
                        status={STATUS_TONE[s.status]}
                        label={saasSubscriptionStatusLabels[s.status]}
                        withDot={false}
                      />
                    </div>
                    <div className="fg-saas-cost">
                      <span className="fg-saas-cost-val fg-tabular">
                        {s.costHidden ? "Restrito" : formatMoney(s.monthlyCost)}
                      </span>
                      {!s.costHidden && <span className="fg-saas-cost-unit">/mês</span>}
                    </div>
                    <div className="fg-saas-licencas">
                      <div className="fg-saas-licencas-text">
                        <span className="fg-tabular">{active.length}</span> licenças
                        vinculadas
                      </div>
                      <div className="fg-saas-bar">
                        <div
                          className="fg-saas-bar-fill"
                          style={{
                            width: `${Math.min(100, active.length * 16)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </Link>
                  <div className="fg-saas-foot">
                    <div className="fg-saas-renew">
                      Próx. renovação:{" "}
                      <span className="fg-tabular">{formatDate(s.renewalDate)}</span>
                      <span
                        className={`fg-saas-renew-rel ${alertSoon ? "alert" : ""}`.trim()}
                      >
                        {" "}
                        · {renewal.label}
                      </span>
                    </div>
                    {terminatedActive > 0 ? (
                      <span className="fg-saas-warn-row">
                        <AlertTriangle size={12} />
                        {terminatedActive} desligado{terminatedActive > 1 ? "s" : ""}
                      </span>
                    ) : null}
                    {rowActions && rowActions[s.id] ? (
                      <div style={{ display: "inline-flex", gap: 4 }}>
                        {rowActions[s.id]}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
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
        </>
      ) : (
        <>
          <DataTable
            columns={columns}
            data={paged}
            getRowKey={(r) => r.id}
            emptyMessage="Nenhuma assinatura para os filtros selecionados."
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
        </>
      )}
    </Page>
  );
}
