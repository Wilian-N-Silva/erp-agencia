"use client";

import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  FileText,
  MoreHorizontal,
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
  Toolbar,
} from "@/components/fg";
import type { DataTableColumn } from "@/components/fg/data-table";
import type { InvoiceRequestListItem } from "@/features/portal/dal";
import type { InvoiceRequestStatus } from "@/features/portal/rules";

const invoiceRequestStatusLabels: Record<InvoiceRequestStatus, string> = {
  draft: "Rascunho",
  published: "Aguardando envio",
  submitted: "Enviada",
  under_review: "Em conferencia",
  adjustment_requested: "Aguardando ajuste",
  approved: "Aprovada",
  rejected: "Recusada",
  paid: "Paga",
  cancelled: "Cancelada",
};

const invoiceItemKindLabels: Record<string, string> = {
  base: "Remuneracao base",
  transport: "Transporte",
  allowance: "Ajuda de custo",
  reimbursement: "Reembolsos aprovados",
  other: "Outros adicionais",
  discount: "Descontos",
};
import {
  centsToMoney,
  formatCompetence,
  formatDate,
  formatMoney,
  moneyToCents,
  toDateKey,
} from "@/features/finance/rules";

type InvoiceTab =
  | "awaiting"
  | "review"
  | "divergent"
  | "approved"
  | "paid"
  | "closed"
  | "all";

const invoiceTabs: { value: InvoiceTab; label: string }[] = [
  { value: "awaiting", label: "Aguardando envio" },
  { value: "review", label: "Em conferencia" },
  { value: "divergent", label: "Divergentes" },
  { value: "approved", label: "Aprovadas" },
  { value: "paid", label: "Pagas" },
  { value: "closed", label: "Encerradas" },
  { value: "all", label: "Todas" },
];

interface NfsViewProps {
  invoices: InvoiceRequestListItem[];
  canCreate: boolean;
  canApprove: boolean;
  newInvoiceAction?: ReactNode;
  rowActions?: Record<string, ReactNode>;
}

export function NfsView({
  invoices,
  canCreate,
  canApprove,
  newInvoiceAction,
  rowActions,
}: NfsViewProps) {
  const [tab, setTab] = useState<InvoiceTab>("awaiting");
  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState<string[]>([]);
  const [competenceFilter, setCompetenceFilter] = useState<string[]>([]);
  const [density, setDensity] = useState<"regular" | "compact">("regular");
  const [open, setOpen] = useState<InvoiceRequestListItem | null>(null);

  const tabCounts = useMemo(
    () =>
      Object.fromEntries(
        invoiceTabs.map((item) => [
          item.value,
          invoices.filter((invoice) => invoiceMatchesTab(invoice, item.value)).length,
        ]),
      ) as Record<InvoiceTab, number>,
    [invoices],
  );
  const areaOptions = useMemo(
    () => uniqueSorted(invoices.map((invoice) => invoice.areaName)),
    [invoices],
  );
  const competenceOptions = useMemo(
    () =>
      uniqueSorted(invoices.map((invoice) => formatCompetence(invoice.competence))),
    [invoices],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return invoices.filter((invoice) => {
      const searchable = [
        invoice.employeeName,
        invoice.employeeRegistrationNumber,
        invoice.areaName,
        invoice.suggestedDescription,
      ];

      return (
        invoiceMatchesTab(invoice, tab) &&
        (!query ||
          searchable.some((value) => value.toLowerCase().includes(query))) &&
        (areaFilter.length === 0 || areaFilter.includes(invoice.areaName)) &&
        (competenceFilter.length === 0 ||
          competenceFilter.includes(formatCompetence(invoice.competence)))
      );
    });
  }, [areaFilter, competenceFilter, invoices, search, tab]);

  const totalExpected = filtered.reduce(
    (total, invoice) => total + moneyToCents(invoice.expectedAmount),
    0,
  );
  const totalIssued = filtered.reduce(
    (total, invoice) => total + moneyToCents(invoice.issuedAmount),
    0,
  );
  const divergentCount = filtered.filter((invoice) => invoice.divergence).length;

  const columns: DataTableColumn<InvoiceRequestListItem>[] = [
    {
      key: "employeeName",
      label: "PJ",
      render: (invoice) => (
        <div className="fg-cell-user">
          <Avatar name={invoice.employeeName} size={28} />
          <div>
            <div className="fg-cell-strong">{invoice.employeeName}</div>
            <div className="fg-cell-sub fg-tabular">
              {invoice.employeeRegistrationNumber} - {invoice.areaName}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "competence",
      label: "Comp.",
      render: (invoice) => (
        <span className="fg-tabular fg-muted">
          {formatCompetence(invoice.competence)}
        </span>
      ),
    },
    {
      key: "expectedAmount",
      label: "Esperado",
      align: "right",
      render: (invoice) => (
        <span className="fg-tabular fg-cell-strong">
          {formatMoney(invoice.expectedAmount)}
        </span>
      ),
    },
    {
      key: "issuedAmount",
      label: "Emitido",
      align: "right",
      render: (invoice) =>
        invoice.issuedAmount ? (
          <span className="fg-tabular">{formatMoney(invoice.issuedAmount)}</span>
        ) : (
          <span className="fg-muted">-</span>
        ),
    },
    {
      key: "divergence",
      label: "Divergencia",
      align: "right",
      render: (invoice) => {
        const delta = moneyToCents(invoice.issuedAmount) - moneyToCents(invoice.expectedAmount);
        return invoice.divergence ? (
          <span className="fg-tabular fg-bad">
            {delta > 0 ? "+" : "-"}
            {formatMoney(centsToMoney(Math.abs(delta)))}
          </span>
        ) : (
          <span className="fg-muted">-</span>
        );
      },
    },
    {
      key: "dueDate",
      label: "Prazo",
      render: (invoice) => (
        <div className="fg-cell-strong fg-tabular">
          {formatDayMonth(invoice.dueDate)}
          <div className="fg-cell-sub">{relativeDateLabel(invoice.dueDate)}</div>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (invoice) => (
        <StatusBadge
          status={mapInvoiceStatus(invoice.status, invoice.divergence)}
          label={invoiceRequestStatusLabels[invoice.status]}
        />
      ),
    },
    {
      key: "_actions",
      label: "",
      width: 96,
      render: (invoice) => (
        <div
          style={{ display: "inline-flex", gap: 4, justifyContent: "flex-end" }}
          onClick={(event) => event.stopPropagation()}
        >
          <Dropdown
            trigger={
              <button className="fg-icon-btn sm" type="button" aria-label="Acoes">
                <MoreHorizontal size={14} />
              </button>
            }
            items={[
              {
                label: "Abrir detalhes",
                icon: <FileText size={13} />,
                onClick: () => setOpen(invoice),
              },
              {
                label: "Baixar PDF",
                icon: <Download size={13} />,
                disabled: !invoice.fileId,
              },
            ]}
          />
          {rowActions?.[invoice.id]}
        </div>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        eyebrow="Fluxos"
        title="Notas fiscais"
        description={`${filtered.length} composicoes - Esperado ${formatMoney(
          centsToMoney(totalExpected),
        )} - Emitido ${formatMoney(centsToMoney(totalIssued))}`}
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={<Download size={14} />}
              disabled
            >
              Exportar composicoes
            </Button>
            {canCreate ? (
              newInvoiceAction
            ) : (
              <Button type="button" variant="primary" size="sm" disabled>
                Nova composicao
              </Button>
            )}
          </>
        }
        tabs={
          <Tabs
            value={tab}
            onChange={(value) => setTab(value as InvoiceTab)}
            items={invoiceTabs.map((item) => ({
              ...item,
              count: tabCounts[item.value],
            }))}
          />
        }
      />

      <div className="fg-grid fg-grid-4">
        <KpiCard
          label="Esperado"
          value={formatMoney(centsToMoney(totalExpected))}
          secondary={`${filtered.length} composicoes`}
          icon={<FileText size={16} />}
        />
        <KpiCard
          label="Emitido"
          value={formatMoney(centsToMoney(totalIssued))}
          secondary="Notas enviadas"
          icon={<CheckCircle2 size={16} />}
          accent
        />
        <KpiCard
          label="Divergencias"
          value={divergentCount}
          secondary="Precisam conferencia"
          icon={<AlertCircle size={16} />}
        />
        <KpiCard
          label="Aguardando"
          value={tabCounts.awaiting}
          secondary="Envio pelo PJ"
          icon={<Clock size={16} />}
        />
      </div>

      <Toolbar
        search={search}
        onSearch={setSearch}
        placeholder="Buscar PJ, matricula ou area..."
        filters={
          <>
            <FilterPopover
              label="Area"
              value={areaFilter}
              onChange={setAreaFilter}
              options={areaOptions}
            />
            <FilterPopover
              label="Competencia"
              value={competenceFilter}
              onChange={setCompetenceFilter}
              options={competenceOptions}
            />
          </>
        }
        density={density}
        onDensity={setDensity}
      />

      <DataTable
        columns={columns}
        data={filtered}
        getRowKey={(invoice) => invoice.id}
        density={density}
        onRowClick={setOpen}
        rowAttention={(invoice) => (invoice.divergence ? "danger" : null)}
        emptyMessage="Nenhuma NF para os filtros selecionados."
      />

      <InvoiceDetailSheet
        invoice={open}
        onClose={() => setOpen(null)}
        actions={open ? rowActions?.[open.id] : null}
        canApprove={canApprove}
      />
    </Page>
  );
}

function InvoiceDetailSheet({
  actions,
  canApprove,
  invoice,
  onClose,
}: {
  actions?: ReactNode;
  canApprove: boolean;
  invoice: InvoiceRequestListItem | null;
  onClose: () => void;
}) {
  if (!invoice) return null;

  return (
    <Sheet
      open
      onClose={onClose}
      title={`NF ${formatCompetence(invoice.competence)} - ${invoice.employeeName}`}
      description={`${invoice.employeeRegistrationNumber} - ${invoice.areaName}`}
      width={680}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Fechar
          </Button>
          <div style={{ flex: 1 }} />
          {canApprove ? actions : null}
        </>
      }
    >
      <div className="fg-nf-strip">
        <div className="fg-nf-strip-item">
          <div className="fg-nf-strip-label">Status</div>
          <StatusBadge
            status={mapInvoiceStatus(invoice.status, invoice.divergence)}
            label={invoiceRequestStatusLabels[invoice.status]}
          />
        </div>
        <div className="fg-nf-strip-item">
          <div className="fg-nf-strip-label">Prazo</div>
          <div className="fg-nf-strip-val fg-tabular">
            {formatDayMonth(invoice.dueDate)}{" "}
            <span className="fg-muted">- {relativeDateLabel(invoice.dueDate)}</span>
          </div>
        </div>
        <div className="fg-nf-strip-item">
          <div className="fg-nf-strip-label">Esperado</div>
          <div className="fg-nf-strip-val fg-tabular">
            {formatMoney(invoice.expectedAmount)}
          </div>
        </div>
        <div className="fg-nf-strip-item">
          <div className="fg-nf-strip-label">Emitido</div>
          <div className="fg-nf-strip-val fg-tabular">
            {formatMoney(invoice.issuedAmount)}
          </div>
        </div>
      </div>

      {invoice.divergence ? (
        <div className="fg-inline-alert danger">
          <AlertCircle size={16} />
          <div>
            <div className="fg-inline-alert-title">Divergencia detectada</div>
            <div className="fg-inline-alert-desc">
              O valor emitido nao bate com a composicao esperada.
            </div>
          </div>
        </div>
      ) : null}

      <div className="fg-section">
        <div className="fg-section-head">
          <div className="fg-section-title">Composicao esperada</div>
          <Button type="button" variant="ghost" size="sm" icon={<Copy size={13} />} disabled>
            Copiar descritivo
          </Button>
        </div>
        <table className="fg-compo-table">
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id}>
                <td>
                  {item.label ||
                    invoiceItemKindLabels[item.kind as keyof typeof invoiceItemKindLabels] ||
                    item.kind}
                </td>
                <td className="right fg-tabular">{formatMoney(item.amount)}</td>
              </tr>
            ))}
            <tr className="fg-compo-total">
              <td>Total esperado</td>
              <td className="right fg-tabular">{formatMoney(invoice.expectedAmount)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="fg-section">
        <div className="fg-section-head">
          <div className="fg-section-title">Descritivo sugerido</div>
        </div>
        <div className="fg-quote">{invoice.suggestedDescription}</div>
      </div>

      <div className="fg-section">
        <div className="fg-section-head">
          <div className="fg-section-title">
            {invoice.fileId ? "NF enviada" : "Aguardando emissao pelo PJ"}
          </div>
          {invoice.approvedAt ? (
            <span className="fg-tabular fg-muted">
              Aprovada em {formatDate(invoice.approvedAt)}
            </span>
          ) : null}
        </div>
        {invoice.fileId ? (
          <div className="fg-pdf-preview">
            <div className="fg-pdf-thumb">
              <FileText size={36} />
              <div className="fg-pdf-thumb-name">
                nf-{invoice.employeeName.split(" ")[0].toLowerCase()}-
                {invoice.competence}.pdf
              </div>
            </div>
            <div className="fg-pdf-meta">
              <div className="fg-pdf-line">
                <span>Valor emitido</span>
                <strong className="fg-tabular">{formatMoney(invoice.issuedAmount)}</strong>
              </div>
              <div className="fg-pdf-line">
                <span>Pagamento</span>
                <strong className="fg-tabular">
                  {invoice.paidAt ? formatDate(invoice.paidAt) : "-"}
                </strong>
              </div>
              <Button type="button" variant="outline" size="sm" icon={<Download size={13} />} disabled>
                Baixar PDF
              </Button>
            </div>
          </div>
        ) : (
          <div className="fg-inline-alert default">
            <Clock size={16} />
            <div>
              <div className="fg-inline-alert-title">Composicao publicada</div>
              <div className="fg-inline-alert-desc">
                O colaborador deve enviar a NF pelo portal ate {formatDate(invoice.dueDate)}.
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="fg-field">
        <label className="fg-label">Observacao interna</label>
        <textarea
          className="fg-input fg-textarea"
          disabled
          placeholder="Anexada ao historico quando houver suporte a observacao na action."
          rows={3}
        />
      </div>
    </Sheet>
  );
}

function invoiceMatchesTab(invoice: InvoiceRequestListItem, tab: InvoiceTab) {
  if (tab === "all") return true;
  if (tab === "awaiting") {
    return invoice.status === "published" || invoice.status === "adjustment_requested";
  }
  if (tab === "review") {
    return invoice.status === "submitted" || invoice.status === "under_review";
  }
  if (tab === "divergent") return invoice.divergence;
  if (tab === "approved") return invoice.status === "approved";
  if (tab === "paid") return invoice.status === "paid";
  return invoice.status === "rejected" || invoice.status === "cancelled";
}

function mapInvoiceStatus(status: InvoiceRequestStatus, divergence: boolean) {
  if (divergence) return "divergente";

  switch (status) {
    case "published":
      return "aguardando_envio";
    case "submitted":
    case "under_review":
      return "enviada";
    case "adjustment_requested":
      return "aguardando_ajuste";
    case "approved":
      return "aprovada";
    case "paid":
      return "pago";
    case "rejected":
    case "cancelled":
      return "recusada";
    default:
      return "rascunho";
  }
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function formatDayMonth(value: string | Date | null | undefined) {
  if (!value) return "-";
  const [, month, day] = toDateKey(value).split("-");
  return month && day ? `${day}/${month}` : formatDate(value);
}

function relativeDateLabel(value: string | Date | null | undefined) {
  if (!value) return "";

  const diff = diffDays(toDateKey(value), toDateKey(new Date()));

  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanha";
  if (diff === -1) return "Ontem";
  if (diff < 0) return `${Math.abs(diff)} dias atras`;
  return `Em ${diff} dias`;
}

function diffDays(targetKey: string, baseKey: string) {
  return (dateKeyToUtc(targetKey) - dateKeyToUtc(baseKey)) / 86_400_000;
}

function dateKeyToUtc(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

