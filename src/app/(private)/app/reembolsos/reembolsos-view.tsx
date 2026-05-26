"use client";

import {
  Check,
  CheckCircle2,
  DollarSign,
  Download,
  Eye,
  File as FileIcon,
  MoreHorizontal,
  Paperclip,
  Plus,
  Wallet,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import {
  Avatar,
  Button,
  DataTable,
  Dropdown,
  FilterPopover,
  KpiCard,
  Page,
  PageHeader,
  Sheet,
  StatusBadge,
  Tabs,
  Tag,
  Toolbar,
} from "@/components/fg";
import type { DataTableColumn } from "@/components/fg/data-table";
import type { ReimbursementListItem } from "@/features/portal/dal";
import type { ReimbursementStatus } from "@/features/portal/rules";

const reimbursementStatusLabels: Record<ReimbursementStatus, string> = {
  draft: "Rascunho",
  submitted: "Enviado",
  manager_approved: "Aprovado pelo gestor",
  manager_rejected: "Recusado pelo gestor",
  finance_approved: "Aprovado pelo financeiro",
  finance_rejected: "Recusado pelo financeiro",
  included_in_invoice: "Incluido na NF",
  paid: "Pago",
  cancelled: "Cancelado",
};
import {
  formatDate,
  formatMoney,
  moneyToCents,
  toDateKey,
} from "@/features/finance/rules";

type ReimbursementTab =
  | "awaiting_manager"
  | "in_finance"
  | "approved"
  | "rejected"
  | "paid"
  | "all";

const reimbursementTabs: { value: ReimbursementTab; label: string }[] = [
  { value: "awaiting_manager", label: "Aguardando aprov." },
  { value: "in_finance", label: "Em revisão" },
  { value: "approved", label: "Aprovados" },
  { value: "rejected", label: "Recusados" },
  { value: "paid", label: "Pagos" },
  { value: "all", label: "Todos" },
];

export interface ReembolsosViewProps {
  reimbursements: ReimbursementListItem[];
  canCreate: boolean;
  rowActions?: Record<string, ReactNode>;
  detailActions?: Record<string, ReactNode>;
}

export function ReembolsosView({
  reimbursements,
  canCreate,
  rowActions,
  detailActions,
}: ReembolsosViewProps) {
  const [tab, setTab] = useState<ReimbursementTab>("awaiting_manager");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [areaFilter, setAreaFilter] = useState<string[]>([]);
  const [density, setDensity] = useState<"regular" | "compact">("regular");
  const [open, setOpen] = useState<ReimbursementListItem | null>(null);

  const tabCounts = useMemo(
    () =>
      Object.fromEntries(
        reimbursementTabs.map((item) => [
          item.value,
          reimbursements.filter((r) => matchesTab(r, item.value)).length,
        ]),
      ) as Record<ReimbursementTab, number>,
    [reimbursements],
  );

  const categoryOptions = useMemo(
    () => uniqueSorted(reimbursements.map((r) => r.category)),
    [reimbursements],
  );
  const areaOptions = useMemo(
    () => uniqueSorted(reimbursements.map((r) => r.areaName)),
    [reimbursements],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return reimbursements.filter((r) => {
      const searchable = [r.employeeName, r.employeeRegistrationNumber, r.title, r.areaName];

      return (
        matchesTab(r, tab) &&
        (!query || searchable.some((value) => value.toLowerCase().includes(query))) &&
        (categoryFilter.length === 0 || categoryFilter.includes(r.category)) &&
        (areaFilter.length === 0 || areaFilter.includes(r.areaName))
      );
    });
  }, [areaFilter, categoryFilter, reimbursements, search, tab]);

  const totalAmount = filtered.reduce((total, r) => total + moneyToCents(r.amount), 0);
  const totalApproved = reimbursements
    .filter(
      (r) =>
        r.status === "finance_approved" ||
        r.status === "included_in_invoice" ||
        r.status === "paid",
    )
    .reduce((total, r) => total + moneyToCents(r.amount), 0);

  const columns: DataTableColumn<ReimbursementListItem>[] = [
    {
      key: "employeeName",
      label: "Colaborador",
      render: (r) => (
        <div className="fg-cell-user">
          <Avatar name={r.employeeName} size={26} />
          <div>
            <div className="fg-cell-strong">{r.employeeName}</div>
            <div className="fg-cell-sub">
              {r.areaName} · {employmentLabel(r.employmentType)}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "expenseDate",
      label: "Data",
      render: (r) => (
        <span className="fg-tabular">{formatDayMonth(r.expenseDate)}</span>
      ),
    },
    {
      key: "category",
      label: "Categoria",
      render: (r) => <Tag>{r.category}</Tag>,
    },
    {
      key: "title",
      label: "Descrição",
      render: (r) => <div className="fg-cell-clamp">{r.title}</div>,
    },
    {
      key: "amount",
      label: "Valor",
      align: "right",
      render: (r) => (
        <span className="fg-tabular fg-cell-strong">{formatMoney(r.amount)}</span>
      ),
    },
    {
      key: "fileId",
      label: "Anexo",
      render: (r) =>
        r.fileId ? (
          <span className="fg-cell-attach">
            <Paperclip size={13} />
          </span>
        ) : (
          <span className="fg-muted">—</span>
        ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <StatusBadge
          status={mapReimbursementStatus(r.status)}
          label={reimbursementStatusLabels[r.status]}
        />
      ),
    },
    {
      key: "_actions",
      label: "",
      width: 96,
      render: (r) => (
        <div
          style={{ display: "inline-flex", gap: 4, justifyContent: "flex-end" }}
          onClick={(event) => event.stopPropagation()}
        >
          <Dropdown
            trigger={
              <button className="fg-icon-btn sm" type="button" aria-label="Ações">
                <MoreHorizontal size={14} />
              </button>
            }
            items={[
              {
                label: "Abrir detalhe",
                icon: <Eye size={13} />,
                onClick: () => setOpen(r),
              },
              {
                label: "Baixar anexo",
                icon: <Download size={13} />,
                disabled: !r.fileId,
              },
            ]}
          />
          {rowActions?.[r.id]}
        </div>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        eyebrow="Fluxos"
        title="Reembolsos"
        description={`${filtered.length} solicitações · ${formatMoney(centsToMoneyStr(totalAmount))} no fluxo`}
        actions={
          canCreate ? (
            <Button type="button" variant="primary" size="sm" icon={<Plus size={14} />} disabled>
              Reembolso manual
            </Button>
          ) : null
        }
        tabs={
          <Tabs
            value={tab}
            onChange={(value) => setTab(value as ReimbursementTab)}
            items={reimbursementTabs.map((item) => ({
              ...item,
              count: tabCounts[item.value],
            }))}
          />
        }
      />

      <div className="fg-grid fg-grid-4">
        <KpiCard
          label="No fluxo"
          value={formatMoney(centsToMoneyStr(totalAmount))}
          secondary={`${filtered.length} solicitações`}
          icon={<Wallet size={16} />}
        />
        <KpiCard
          label="Aguardando aprov."
          value={tabCounts.awaiting_manager}
          secondary="Gestor"
          icon={<CheckCircle2 size={16} />}
        />
        <KpiCard
          label="Em revisão"
          value={tabCounts.in_finance}
          secondary="Financeiro"
          icon={<CheckCircle2 size={16} />}
        />
        <KpiCard
          label="Já aprovado no mês"
          value={formatMoney(centsToMoneyStr(totalApproved))}
          secondary="Histórico geral"
          icon={<DollarSign size={16} />}
          accent
        />
      </div>

      <Toolbar
        search={search}
        onSearch={setSearch}
        placeholder="Buscar colaborador, descrição ou área..."
        filters={
          <>
            <FilterPopover
              label="Categoria"
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={categoryOptions}
            />
            <FilterPopover
              label="Área"
              value={areaFilter}
              onChange={setAreaFilter}
              options={areaOptions}
            />
          </>
        }
        density={density}
        onDensity={setDensity}
      />

      <DataTable
        columns={columns}
        data={filtered}
        getRowKey={(r) => r.id}
        density={density}
        onRowClick={setOpen}
        emptyMessage="Nenhum reembolso para os filtros selecionados."
      />

      <ReimbursementDetailSheet
        reimbursement={open}
        onClose={() => setOpen(null)}
        actions={open ? detailActions?.[open.id] : null}
      />
    </Page>
  );
}

function ReimbursementDetailSheet({
  actions,
  onClose,
  reimbursement,
}: {
  actions?: ReactNode;
  onClose: () => void;
  reimbursement: ReimbursementListItem | null;
}) {
  if (!reimbursement) return null;

  const steps = buildTimeline(reimbursement);

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Reembolso · ${formatMoney(reimbursement.amount)}`}
      description={`${reimbursement.employeeName} · ${reimbursement.areaName} · ${formatDate(reimbursement.expenseDate)}`}
      width={720}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Fechar
          </Button>
          <div style={{ flex: 1 }} />
          {actions}
        </>
      }
    >
      <div className="fg-rb-grid">
        <div className="fg-rb-attach">
          <div className="fg-rb-attach-frame">
            <div className="fg-pdf-thumb-big">
              <FileIcon size={64} />
              <div className="fg-pdf-thumb-name">
                {reimbursement.fileId
                  ? `anexo-${reimbursement.id.slice(0, 8)}.pdf`
                  : "sem-anexo"}
              </div>
            </div>
          </div>
          <div className="fg-rb-attach-actions">
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={<Eye size={13} />}
              disabled={!reimbursement.fileId}
            >
              Abrir
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={<Download size={13} />}
              disabled={!reimbursement.fileId}
            >
              Baixar
            </Button>
          </div>
        </div>

        <div className="fg-rb-details">
          <dl className="fg-deflist">
            <div>
              <dt>Solicitante</dt>
              <dd>{reimbursement.employeeName}</dd>
            </div>
            <div>
              <dt>Data da despesa</dt>
              <dd className="fg-tabular">{formatDate(reimbursement.expenseDate)}</dd>
            </div>
            <div>
              <dt>Categoria</dt>
              <dd>{reimbursement.category}</dd>
            </div>
            <div>
              <dt>Valor</dt>
              <dd className="fg-tabular fg-cell-strong">
                {formatMoney(reimbursement.amount)}
              </dd>
            </div>
            <div>
              <dt>Área</dt>
              <dd>
                <Tag>{reimbursement.areaName}</Tag>
              </dd>
            </div>
            <div>
              <dt>Vínculo</dt>
              <dd>{employmentLabel(reimbursement.employmentType)}</dd>
            </div>
            <div className="full">
              <dt>Descrição</dt>
              <dd>{reimbursement.title}</dd>
            </div>
            {reimbursement.notes ? (
              <div className="full">
                <dt>Observações</dt>
                <dd>{reimbursement.notes}</dd>
              </div>
            ) : null}
          </dl>

          <div className="fg-section" style={{ marginTop: 18 }}>
            <div className="fg-section-head">
              <div className="fg-section-title">Histórico de aprovação</div>
            </div>
            <ol className="fg-timeline">
              {steps.map((step, index) => (
                <li key={index} className={`fg-tl-step fg-tl-${step.state}`}>
                  <div className="fg-tl-dot">
                    {step.state === "done" ? <Check size={10} strokeWidth={3} /> : null}
                    {step.state === "rejected" ? <X size={10} strokeWidth={3} /> : null}
                  </div>
                  <div className="fg-tl-body">
                    <div className="fg-tl-label">{step.label}</div>
                    {step.meta ? <div className="fg-tl-meta">{step.meta}</div> : null}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {reimbursement.includedInvoiceRequestId ? (
            <div className="fg-inline-alert default">
              <FileIcon size={16} />
              <div>
                <div className="fg-inline-alert-title">Incluído em NF</div>
                <div className="fg-inline-alert-desc">
                  Este reembolso integra a composição de NF do colaborador.
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </Sheet>
  );
}

type TimelineState = "done" | "rejected" | "current" | "pending";

function buildTimeline(r: ReimbursementListItem) {
  const steps: { label: string; state: TimelineState; meta: string | null }[] = [];

  steps.push({
    label: "Enviado",
    state: r.status === "draft" ? "current" : "done",
    meta: `${r.employeeName} · ${formatDate(r.createdAt)}`,
  });

  const managerDone =
    !!r.managerApproverUserId ||
    r.status === "manager_approved" ||
    r.status === "finance_approved" ||
    r.status === "finance_rejected" ||
    r.status === "included_in_invoice" ||
    r.status === "paid";

  steps.push({
    label: "Aprovação do gestor",
    state:
      r.status === "manager_rejected"
        ? "rejected"
        : managerDone
        ? "done"
        : r.status === "submitted"
        ? "current"
        : "pending",
    meta: r.managerApproverName
      ? `${r.managerApproverName}${r.updatedAt ? ` · ${formatDate(r.updatedAt)}` : ""}`
      : null,
  });

  const financeDone =
    !!r.financeApproverUserId ||
    r.status === "finance_approved" ||
    r.status === "included_in_invoice" ||
    r.status === "paid";

  steps.push({
    label: "Aprovação do financeiro",
    state:
      r.status === "finance_rejected"
        ? "rejected"
        : financeDone
        ? "done"
        : r.status === "manager_approved"
        ? "current"
        : "pending",
    meta: r.financeApproverName
      ? `${r.financeApproverName}${r.updatedAt ? ` · ${formatDate(r.updatedAt)}` : ""}`
      : null,
  });

  steps.push({
    label: "Pago",
    state: r.status === "paid" ? "done" : "pending",
    meta: r.paidAt ? formatDate(r.paidAt) : null,
  });

  return steps;
}

function matchesTab(r: ReimbursementListItem, tab: ReimbursementTab) {
  if (tab === "all") return true;
  if (tab === "awaiting_manager") return r.status === "submitted";
  if (tab === "in_finance") return r.status === "manager_approved";
  if (tab === "approved") {
    return r.status === "finance_approved" || r.status === "included_in_invoice";
  }
  if (tab === "rejected") {
    return r.status === "manager_rejected" || r.status === "finance_rejected" || r.status === "cancelled";
  }
  if (tab === "paid") return r.status === "paid";
  return false;
}

function mapReimbursementStatus(status: ReimbursementStatus) {
  switch (status) {
    case "draft":
      return "rascunho";
    case "submitted":
      return "aguardando_envio";
    case "manager_approved":
      return "enviada";
    case "manager_rejected":
    case "finance_rejected":
      return "recusada";
    case "finance_approved":
    case "included_in_invoice":
      return "aprovada";
    case "paid":
      return "pago";
    case "cancelled":
      return "cancelado";
    default:
      return "rascunho";
  }
}

function employmentLabel(employmentType: string) {
  if (employmentType === "pj") return "PJ";
  if (employmentType === "clt") return "CLT";
  return employmentType;
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function centsToMoneyStr(cents: number) {
  return (cents / 100).toFixed(2);
}

function formatDayMonth(value: string | Date | null | undefined) {
  if (!value) return "-";
  const [, month, day] = toDateKey(value).split("-");
  return month && day ? `${day}/${month}` : formatDate(value);
}

