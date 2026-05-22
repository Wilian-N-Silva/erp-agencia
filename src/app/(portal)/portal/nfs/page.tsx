import { CheckCircle2, FileText, Upload } from "lucide-react";
import { redirect } from "next/navigation";

import { Button, Card, EmptyState, StatusBadge } from "@/components/fg";
import { MoneyInput } from "@/components/fg";
import { submitInvoiceRequestAction } from "@/features/portal/actions";
import {
  getPortalEmployeeSummary,
  listInvoiceRequests,
  type InvoiceRequestListItem,
} from "@/features/portal/dal";
import {
  canSubmitInvoice,
  invoiceItemKindLabels,
  invoiceRequestStatusLabels,
  type InvoiceRequestStatus,
} from "@/features/portal/rules";
import { formatCompetence, formatDate, formatMoney } from "@/features/finance/rules";
import { getCurrentAccessContext } from "@/lib/dal";

export const dynamic = "force-dynamic";

export default async function PortalNFsPage() {
  const context = await getCurrentAccessContext();
  if (!context) {
    redirect("/login");
  }

  const employee = await getPortalEmployeeSummary(context);
  const isPJ = employee?.employmentType === "pj";

  if (!isPJ) {
    return (
      <>
        <h1 className="fg-portal-h1">NFs</h1>
        <Card>
          <EmptyState
            icon={<FileText size={32} />}
            title="Você não é PJ"
            description="O fluxo de notas fiscais aparece aqui apenas para colaboradores com vínculo PJ."
          />
        </Card>
      </>
    );
  }

  const invoices = await listInvoiceRequests(context, { ownOnly: true });
  const open = invoices.find((invoice) => canSubmitInvoice(invoice.status));
  const history = invoices.filter((invoice) => !canSubmitInvoice(invoice.status));

  return (
    <>
      <h1 className="fg-portal-h1">Minhas notas fiscais</h1>

      {open ? (
        <>
          <NfStrip invoice={open} />
          <CompositionCard invoice={open} />
          <DescriptionCard invoice={open} />
          <SubmitCard invoice={open} />
        </>
      ) : (
        <Card>
          <EmptyState
            icon={<CheckCircle2 size={32} />}
            title="Nenhuma NF aberta no momento"
            description="A próxima composição será gerada automaticamente no início da nova competência."
          />
        </Card>
      )}

      {history.length > 0 ? <HistoryCard invoices={history} /> : null}
    </>
  );
}

function NfStrip({ invoice }: { invoice: InvoiceRequestListItem }) {
  const due = new Date(invoice.dueDate);
  const today = new Date();
  const diffDays = Math.round(
    (due.getTime() - new Date(today.toISOString().slice(0, 10)).getTime()) / 86_400_000,
  );
  const relative =
    diffDays === 0
      ? "Hoje"
      : diffDays === 1
      ? "Amanhã"
      : diffDays > 0
      ? `faltam ${diffDays} dias`
      : `${Math.abs(diffDays)} dias atrás`;

  return (
    <div className="fg-portal-nf-strip">
      <div>
        <span>Competência</span>
        <strong className="fg-tabular">{formatCompetence(invoice.competence)}</strong>
      </div>
      <div>
        <span>Prazo</span>
        <strong className="fg-tabular">
          {formatDate(invoice.dueDate)} · {relative}
        </strong>
      </div>
      <div>
        <span>Valor esperado</span>
        <strong className="fg-tabular">{formatMoney(invoice.expectedAmount)}</strong>
      </div>
    </div>
  );
}

function CompositionCard({ invoice }: { invoice: InvoiceRequestListItem }) {
  return (
    <Card
      title="Composição esperada"
      description="Esses são os itens que compõem o valor da sua NF. Confira antes de emitir."
    >
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
    </Card>
  );
}

function DescriptionCard({ invoice }: { invoice: InvoiceRequestListItem }) {
  return (
    <Card
      title="Descritivo sugerido"
      description="Cole esse texto no campo de descrição da sua NF. O financeiro espera essa redação."
    >
      <div className="fg-quote">{invoice.suggestedDescription}</div>
    </Card>
  );
}

function SubmitCard({ invoice }: { invoice: InvoiceRequestListItem }) {
  return (
    <Card title="Enviar NF emitida" description="Faça upload do PDF e informe os dados da nota emitida.">
      <form
        action={submitInvoiceRequestAction}
        encType="multipart/form-data"
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        <input type="hidden" name="id" value={invoice.id} />
        <div className="fg-field">
          <label className="fg-label">
            Arquivo da NF (PDF)<span className="fg-required">*</span>
          </label>
          <div className="fg-input-wrap">
            <input
              className="fg-input"
              name="file"
              type="file"
              accept=".pdf,application/pdf"
              required
            />
          </div>
          <div className="fg-field-helper">Até 10 MB. PDF emitido pelo seu portal de NFs.</div>
        </div>
        <div className="fg-form-row">
          <div className="fg-field">
            <label className="fg-label">
              Valor emitido<span className="fg-required">*</span>
            </label>
            <MoneyInput name="issuedAmount" required defaultValue={invoice.expectedAmount} />
            <div className="fg-field-helper">
              Valor esperado: {formatMoney(invoice.expectedAmount)}.
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <Button type="submit" variant="primary" size="lg" icon={<Upload size={14} />}>
            Enviar NF para aprovação
          </Button>
        </div>
      </form>
    </Card>
  );
}

function HistoryCard({ invoices }: { invoices: InvoiceRequestListItem[] }) {
  return (
    <Card title="Histórico de NFs" padding={false}>
      <table className="fg-aumento-table">
        <thead>
          <tr>
            <th>Competência</th>
            <th>Valor</th>
            <th>Status</th>
            <th>Aprovação</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr key={invoice.id}>
              <td className="fg-tabular">{formatCompetence(invoice.competence)}</td>
              <td className="fg-tabular fg-cell-strong">
                {formatMoney(invoice.issuedAmount ?? invoice.expectedAmount)}
              </td>
              <td>
                <StatusBadge
                  status={mapStatus(invoice.status)}
                  label={invoiceRequestStatusLabels[invoice.status]}
                />
              </td>
              <td className="fg-tabular fg-muted">
                {invoice.approvedAt ? formatDate(invoice.approvedAt) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function mapStatus(status: InvoiceRequestStatus) {
  switch (status) {
    case "approved":
      return "aprovada";
    case "paid":
      return "pago";
    case "rejected":
    case "cancelled":
      return "recusada";
    case "published":
      return "aguardando_envio";
    case "submitted":
    case "under_review":
      return "enviada";
    case "adjustment_requested":
      return "aguardando_ajuste";
    default:
      return "rascunho";
  }
}
