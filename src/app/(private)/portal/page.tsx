import {
  Boxes,
  CalendarClock,
  Download,
  Files,
  FileText,
  KeyRound,
  Laptop,
  Plus,
  ReceiptText,
  Send,
} from "lucide-react";
import { redirect } from "next/navigation";

import { listAccessRecords, type AccessRecordListItem } from "@/features/accesses/dal";
import { accessRecordStatusLabels } from "@/features/accesses/rules";
import { ActionDialog } from "@/components/ui/action-dialog";
import { listDocuments, type DocumentListItem } from "@/features/documents/dal";
import { documentTypeLabels, fileSensitivityLabels } from "@/features/documents/rules";
import { listEquipment, type EquipmentListItem } from "@/features/equipment/dal";
import { equipmentStatusLabels } from "@/features/equipment/rules";
import {
  createReimbursementAction,
  submitInvoiceRequestAction,
} from "@/features/portal/actions";
import {
  getPortalEmployeeSummary,
  listInvoiceRequests,
  listReimbursements,
  type InvoiceRequestListItem,
  type ReimbursementListItem,
} from "@/features/portal/dal";
import {
  canSubmitInvoice,
  invoiceRequestStatusLabels,
  reimbursementCategories,
  reimbursementStatusLabels,
} from "@/features/portal/rules";
import { formatCompetence, formatDate, formatMoney } from "@/features/finance/rules";
import { listSaasSubscriptions, type SaasSubscriptionListItem } from "@/features/saas/dal";
import { saasSubscriptionStatusLabels } from "@/features/saas/rules";
import { createTimeOffRequestAction } from "@/features/timeoff/actions";
import { listTimeOffRequests, type TimeOffListItem } from "@/features/timeoff/dal";
import { timeOffStatusLabels, timeOffTypeLabels } from "@/features/timeoff/rules";
import { getCurrentAccessContext } from "@/lib/dal";

export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const context = await getCurrentAccessContext();

  if (!context) {
    redirect("/login");
  }

  const [
    employee,
    invoices,
    reimbursements,
    timeOffRequests,
    documents,
    equipment,
    accessRecords,
    subscriptions,
  ] = await Promise.all([
    getPortalEmployeeSummary(context),
    listInvoiceRequests(context, { ownOnly: true, limit: 6 }),
    listReimbursements(context, { ownOnly: true, limit: 8 }),
    listTimeOffRequests(context, { ownOnly: true, limit: 6 }),
    listDocuments(context, { ownOnly: true }),
    listEquipment(context, {}, { ownOnly: true, limit: 6 }),
    listAccessRecords(context, {}, { ownOnly: true, limit: 6 }),
    listSaasSubscriptions(context, {}, { linkedOnly: true, limit: 6 }),
  ]);
  const pendingInvoice = invoices.find((invoice) => canSubmitInvoice(invoice.status));

  return (
    <section className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-normal">Portal</h1>
        <p className="text-sm text-muted-foreground">
          {employee ? `${employee.fullName} - ${employee.positionName}` : "Dados e solicitacoes"}
        </p>
      </div>

      {employee?.employmentType === "pj" && pendingInvoice ? (
        <InvoiceCallout invoice={pendingInvoice} />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-lg border bg-card">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <h2 className="text-base font-semibold">Minhas NFs</h2>
            <FileText className="size-4 text-primary" aria-hidden="true" />
          </div>
          <InvoiceList invoices={invoices} />
        </section>

        <section className="rounded-lg border bg-card">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <h2 className="text-base font-semibold">Meus reembolsos</h2>
            <div className="flex items-center gap-2">
              <ActionDialog
                title="Solicitar reembolso"
                trigger={
                  <>
                    <Plus className="size-4" aria-hidden="true" />
                    Solicitar
                  </>
                }
                triggerClassName={secondaryButtonClassName}
                triggerLabel="Solicitar reembolso"
              >
                <ReimbursementRequestForm />
              </ActionDialog>
              <ReceiptText className="size-4 text-primary" aria-hidden="true" />
            </div>
          </div>
          <ReimbursementList reimbursements={reimbursements} />
        </section>
      </div>

      <section className="rounded-lg border bg-card">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <h2 className="text-base font-semibold">Ferias e pausas</h2>
          <div className="flex items-center gap-2">
            <ActionDialog
              title="Solicitar ferias ou pausa"
              trigger={
                <>
                  <Plus className="size-4" aria-hidden="true" />
                  Solicitar
                </>
              }
              triggerClassName={secondaryButtonClassName}
              triggerLabel="Solicitar ferias ou pausa"
            >
              <TimeOffRequestForm />
            </ActionDialog>
            <CalendarClock className="size-4 text-primary" aria-hidden="true" />
          </div>
        </div>
        <TimeOffList requests={timeOffRequests} />
      </section>

      <section className="rounded-lg border bg-card">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <h2 className="text-base font-semibold">Meus documentos</h2>
          <Files className="size-4 text-primary" aria-hidden="true" />
        </div>
        <DocumentList documents={documents} />
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="rounded-lg border bg-card">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <h2 className="text-base font-semibold">Meus equipamentos</h2>
            <Laptop className="size-4 text-primary" aria-hidden="true" />
          </div>
          <EquipmentList equipment={equipment} />
        </section>

        <section className="rounded-lg border bg-card">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <h2 className="text-base font-semibold">Meus acessos</h2>
            <KeyRound className="size-4 text-primary" aria-hidden="true" />
          </div>
          <AccessRecordList records={accessRecords} />
        </section>

        <section className="rounded-lg border bg-card">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <h2 className="text-base font-semibold">Minhas ferramentas</h2>
            <Boxes className="size-4 text-primary" aria-hidden="true" />
          </div>
          <SaasList subscriptions={subscriptions} />
        </section>
      </div>

    </section>
  );
}

function TimeOffRequestForm() {
  return (
    <form action={createTimeOffRequestAction} className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className={fieldClassName}>
          Tipo
          <select className={inputClassName} name="type" required>
            {Object.entries(timeOffTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className={fieldClassName}>
          Inicio
          <input className={inputClassName} name="startDate" required type="date" />
        </label>
      </div>
      <label className={fieldClassName}>
        Fim
        <input className={inputClassName} name="endDate" required type="date" />
      </label>
      <label className={fieldClassName}>
        Observacao
        <textarea className={textareaClassName} maxLength={1000} name="notes" rows={3} />
      </label>
      <div className="flex justify-end">
        <button className={`${primaryButtonClassName} sm:w-auto`} type="submit">
          <Plus className="size-4" aria-hidden="true" />
          Enviar solicitacao
        </button>
      </div>
    </form>
  );
}

function ReimbursementRequestForm() {
  return (
    <form action={createReimbursementAction} className="grid gap-4" encType="multipart/form-data">
      <label className={fieldClassName}>
        Descricao
        <input className={inputClassName} maxLength={180} name="title" required />
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        <label className={fieldClassName}>
          Categoria
          <select className={inputClassName} name="category" required>
            {reimbursementCategories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label className={fieldClassName}>
          Valor
          <input className={inputClassName} inputMode="decimal" name="amount" required />
        </label>
      </div>
      <label className={fieldClassName}>
        Data
        <input className={inputClassName} name="expenseDate" required type="date" />
      </label>
      <label className={fieldClassName}>
        Comprovante
        <input className={fileInputClassName} name="file" type="file" accept={uploadAccept} />
      </label>
      <label className={fieldClassName}>
        Observacao
        <textarea className={textareaClassName} maxLength={1000} name="notes" rows={3} />
      </label>
      <div className="flex justify-end">
        <button className={`${primaryButtonClassName} sm:w-auto`} type="submit">
          <Plus className="size-4" aria-hidden="true" />
          Enviar reembolso
        </button>
      </div>
    </form>
  );
}

function EquipmentList({ equipment }: { equipment: EquipmentListItem[] }) {
  if (equipment.length === 0) {
    return <EmptyState label="Nenhum equipamento vinculado." />;
  }

  return (
    <div className="divide-y">
      {equipment.map((item) => (
        <div className="grid gap-2 px-4 py-3 text-sm" key={item.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">{item.assetNumber}</p>
            <StatusBadge label={equipmentStatusLabels[item.status]} tone={item.returnAlert ? "danger" : "neutral"} />
          </div>
          <p className="text-muted-foreground">
            {[item.type, item.brand, item.model].filter(Boolean).join(" - ")}
          </p>
        </div>
      ))}
    </div>
  );
}

function AccessRecordList({ records }: { records: AccessRecordListItem[] }) {
  const activeRecords = records.filter((record) => record.status !== "removed");

  if (activeRecords.length === 0) {
    return <EmptyState label="Nenhum acesso ativo." />;
  }

  return (
    <div className="divide-y">
      {activeRecords.map((record) => (
        <div className="grid gap-2 px-4 py-3 text-sm" key={record.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">{record.platform}</p>
            <StatusBadge label={accessRecordStatusLabels[record.status]} tone={record.alert ? "danger" : "neutral"} />
          </div>
          <p className="text-muted-foreground">
            {record.accessLevel} - revisao {formatDate(record.reviewDueDate)}
          </p>
        </div>
      ))}
    </div>
  );
}

function SaasList({ subscriptions }: { subscriptions: SaasSubscriptionListItem[] }) {
  if (subscriptions.length === 0) {
    return <EmptyState label="Nenhuma ferramenta vinculada." />;
  }

  return (
    <div className="divide-y">
      {subscriptions.map((subscription) => (
        <div className="grid gap-2 px-4 py-3 text-sm" key={subscription.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">{subscription.name}</p>
            <StatusBadge
              label={saasSubscriptionStatusLabels[subscription.status]}
              tone={subscription.renewalState === "overdue" ? "danger" : "neutral"}
            />
          </div>
          <p className="text-muted-foreground">
            {subscription.category} - renovacao {formatDate(subscription.renewalDate)}
          </p>
        </div>
      ))}
    </div>
  );
}

function DocumentList({ documents }: { documents: DocumentListItem[] }) {
  if (documents.length === 0) {
    return <EmptyState label="Nenhum documento disponivel." />;
  }

  return (
    <div className="divide-y">
      {documents.slice(0, 8).map((document) => (
        <div className="grid gap-2 px-4 py-3 text-sm" key={document.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">{document.originalName}</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">v{document.version}</span>
              <a
                aria-label="Baixar documento"
                className="inline-flex size-8 items-center justify-center rounded-md border border-primary/30 text-primary transition-colors hover:bg-primary/10"
                href={`/app/documentos/${document.id}/download`}
                title="Baixar documento"
              >
                <Download className="size-4" aria-hidden="true" />
              </a>
            </div>
          </div>
          <p className="text-muted-foreground">
            {documentTypeLabels[document.documentType as keyof typeof documentTypeLabels] ?? document.documentType} -{" "}
            {fileSensitivityLabels[document.sensitivity]} - {formatDate(document.createdAt)}
          </p>
        </div>
      ))}
    </div>
  );
}

function TimeOffList({ requests }: { requests: TimeOffListItem[] }) {
  if (requests.length === 0) {
    return <EmptyState label="Nenhuma solicitacao de ferias ou pausa." />;
  }

  return (
    <div className="divide-y">
      {requests.map((request) => (
        <div className="grid gap-2 px-4 py-3 text-sm" key={request.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">{timeOffTypeLabels[request.type as keyof typeof timeOffTypeLabels] ?? request.type}</p>
            <StatusBadge label={timeOffStatusLabels[request.status]} tone="neutral" />
          </div>
          <p className="text-muted-foreground">
            {formatDate(request.startDate)} a {formatDate(request.endDate)} - {request.businessDays} dia(s) uteis
          </p>
        </div>
      ))}
    </div>
  );
}

function InvoiceCallout({ invoice }: { invoice: InvoiceRequestListItem }) {
  return (
    <section className="rounded-lg border border-secondary/30 bg-secondary/10 p-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Voce precisa emitir sua NF</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Competencia {formatCompetence(invoice.competence)} - prazo {formatDate(invoice.dueDate)}
          </p>
          <p className="mt-3 text-2xl font-semibold">{formatMoney(invoice.expectedAmount)}</p>
          <p className="mt-2 text-sm text-muted-foreground">{invoice.suggestedDescription}</p>
          <div className="mt-3 grid gap-2 text-sm">
            {invoice.items.map((item) => (
              <div className="flex justify-between gap-4" key={item.id}>
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-medium">{formatMoney(item.amount)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-end lg:justify-end">
          <ActionDialog
            title="Enviar NF"
            trigger={
              <>
                <Send className="size-4" aria-hidden="true" />
                Enviar NF
              </>
            }
            triggerClassName={`${primaryButtonClassName} sm:w-auto`}
            triggerLabel="Enviar NF"
          >
            <InvoiceSubmissionForm invoice={invoice} />
          </ActionDialog>
        </div>
      </div>
    </section>
  );
}

function InvoiceSubmissionForm({ invoice }: { invoice: InvoiceRequestListItem }) {
  return (
    <form action={submitInvoiceRequestAction} className="grid gap-4" encType="multipart/form-data">
      <input name="id" type="hidden" value={invoice.id} />
      <label className={fieldClassName}>
        Valor emitido
        <input
          className={inputClassName}
          defaultValue={invoice.expectedAmount}
          inputMode="decimal"
          name="issuedAmount"
          required
        />
      </label>
      <label className={fieldClassName}>
        Arquivo da NF
        <input className={fileInputClassName} name="file" required type="file" accept={uploadAccept} />
      </label>
      <div className="flex justify-end">
        <button className={`${primaryButtonClassName} sm:w-auto`} type="submit">
          <Send className="size-4" aria-hidden="true" />
          Enviar NF
        </button>
      </div>
    </form>
  );
}

function InvoiceList({ invoices }: { invoices: InvoiceRequestListItem[] }) {
  if (invoices.length === 0) {
    return <EmptyState label="Nenhuma NF solicitada." />;
  }

  return (
    <div className="divide-y">
      {invoices.map((invoice) => (
        <div className="grid gap-2 px-4 py-3 text-sm" key={invoice.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">{formatCompetence(invoice.competence)}</p>
            <StatusBadge label={invoiceRequestStatusLabels[invoice.status]} tone={invoice.divergence ? "danger" : "neutral"} />
          </div>
          <p className="text-muted-foreground">
            Prazo {formatDate(invoice.dueDate)} - Valor {formatMoney(invoice.expectedAmount)}
          </p>
        </div>
      ))}
    </div>
  );
}

function ReimbursementList({ reimbursements }: { reimbursements: ReimbursementListItem[] }) {
  if (reimbursements.length === 0) {
    return <EmptyState label="Nenhum reembolso enviado." />;
  }

  return (
    <div className="divide-y">
      {reimbursements.map((reimbursement) => (
        <div className="grid gap-2 px-4 py-3 text-sm" key={reimbursement.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">{reimbursement.title}</p>
            <StatusBadge label={reimbursementStatusLabels[reimbursement.status]} tone="neutral" />
          </div>
          <p className="text-muted-foreground">
            {reimbursement.category} - {formatDate(reimbursement.expenseDate)} - {formatMoney(reimbursement.amount)}
          </p>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: "danger" | "neutral" }) {
  const className =
    tone === "danger"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : "border-secondary/30 bg-secondary/10 text-secondary-foreground";

  return <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${className}`}>{label}</span>;
}

function EmptyState({ label }: { label: string }) {
  return <p className="px-4 py-8 text-center text-sm text-muted-foreground">{label}</p>;
}

const inputClassName =
  "h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

const textareaClassName =
  "min-h-24 w-full min-w-0 resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

const fileInputClassName =
  "min-h-10 w-full min-w-0 rounded-md border bg-background px-3 py-2 text-sm outline-none transition-colors file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground focus:border-primary focus:ring-2 focus:ring-primary/20";

const fieldClassName = "grid min-w-0 gap-1 text-sm font-medium";

const primaryButtonClassName =
  "inline-flex h-10 w-full min-w-0 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90";

const secondaryButtonClassName =
  "inline-flex h-9 min-w-0 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

const uploadAccept =
  "application/pdf,image/jpeg,image/png,application/xml,text/xml,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
