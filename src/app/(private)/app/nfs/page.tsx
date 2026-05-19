import { Ban, CheckCircle2, DollarSign, Plus, type LucideIcon } from "lucide-react";
import { redirect } from "next/navigation";

import {
  approveInvoiceRequestAction,
  createInvoiceRequestAction,
  markInvoicePaidAction,
  rejectInvoiceRequestAction,
} from "@/features/portal/actions";
import {
  listInvoiceEmployeeOptions,
  listInvoiceRequests,
  type InvoiceEmployeeOption,
  type InvoiceRequestListItem,
} from "@/features/portal/dal";
import {
  canCreateInvoiceRequest,
  canReviewInvoice,
  invoiceRequestStatusLabels,
} from "@/features/portal/rules";
import { formatCompetence, formatDate, formatMoney } from "@/features/finance/rules";
import { getCurrentAccessContext } from "@/lib/dal";
import { canAny } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function InvoiceRequestsPage() {
  const context = await getCurrentAccessContext();

  if (!context) {
    redirect("/login");
  }

  if (!canAny(["invoices.read", "invoices.write", "invoices.approve"], context)) {
    redirect("/acesso-negado");
  }

  const [invoices, employeeOptions] = await Promise.all([
    listInvoiceRequests(context),
    canCreateInvoiceRequest(context) ? listInvoiceEmployeeOptions(context) : Promise.resolve([]),
  ]);
  const canCreate = canCreateInvoiceRequest(context);
  const canApprove = canAny(["invoices.approve"], context);

  return (
    <section className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-normal">Notas fiscais PJ</h1>
        <p className="text-sm text-muted-foreground">Composicao mensal, envio e aprovacao</p>
      </div>

      {canCreate ? <CreateInvoiceForm employeeOptions={employeeOptions} /> : null}

      <section className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-base font-semibold">Solicitacoes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Colaborador</th>
                <th className="px-4 py-3 font-medium">Competencia</th>
                <th className="px-4 py-3 font-medium">Prazo</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Esperado</th>
                <th className="px-4 py-3 text-right font-medium">Emitido</th>
                {canApprove ? <th className="px-4 py-3 text-right font-medium">Acoes</th> : null}
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-muted-foreground" colSpan={canApprove ? 7 : 6}>
                    Nenhuma solicitacao de NF.
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => (
                  <InvoiceRow canApprove={canApprove} invoice={invoice} key={invoice.id} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function CreateInvoiceForm({ employeeOptions }: { employeeOptions: InvoiceEmployeeOption[] }) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="text-base font-semibold">Nova solicitacao</h2>
      </div>
      <form action={createInvoiceRequestAction} className="grid gap-4 p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_0.35fr_0.35fr]">
          <label className={fieldClassName}>
            Colaborador PJ
            <select className={inputClassName} name="employeeId" required>
              {employeeOptions.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </label>
          <label className={fieldClassName}>
            Competencia
            <input className={inputClassName} defaultValue={currentCompetence()} name="competence" required type="month" />
          </label>
          <label className={fieldClassName}>
            Prazo envio
            <input className={inputClassName} name="dueDate" required type="date" />
          </label>
        </div>
        <div className="grid gap-3 lg:grid-cols-6">
          <label className={fieldClassName}>
            Base
            <input className={inputClassName} inputMode="decimal" name="baseAmount" required />
          </label>
          <label className={fieldClassName}>
            Transporte
            <input className={inputClassName} inputMode="decimal" name="transportAmount" />
          </label>
          <label className={fieldClassName}>
            Ajuda
            <input className={inputClassName} inputMode="decimal" name="allowanceAmount" />
          </label>
          <label className={fieldClassName}>
            Reembolsos
            <input className={inputClassName} inputMode="decimal" name="reimbursementAmount" />
          </label>
          <label className={fieldClassName}>
            Outros
            <input className={inputClassName} inputMode="decimal" name="otherAmount" />
          </label>
          <label className={fieldClassName}>
            Descontos
            <input className={inputClassName} inputMode="decimal" name="discountAmount" />
          </label>
        </div>
        <label className={fieldClassName}>
          Descritivo sugerido
          <textarea className={textareaClassName} maxLength={700} name="suggestedDescription" rows={3} />
        </label>
        <div className="flex justify-end">
          <button className={`${primaryButtonClassName} sm:w-auto`} type="submit">
            <Plus className="size-4" aria-hidden="true" />
            Publicar solicitacao
          </button>
        </div>
      </form>
    </section>
  );
}

function InvoiceRow({
  canApprove,
  invoice,
}: {
  canApprove: boolean;
  invoice: InvoiceRequestListItem;
}) {
  return (
    <tr className="border-b last:border-b-0">
      <td className="px-4 py-3 font-medium">{invoice.employeeName}</td>
      <td className="px-4 py-3 text-muted-foreground">{formatCompetence(invoice.competence)}</td>
      <td className="px-4 py-3 text-muted-foreground">{formatDate(invoice.dueDate)}</td>
      <td className="px-4 py-3">
        <StatusBadge danger={invoice.divergence} label={invoiceRequestStatusLabels[invoice.status]} />
      </td>
      <td className="px-4 py-3 text-right font-medium">{formatMoney(invoice.expectedAmount)}</td>
      <td className="px-4 py-3 text-right text-muted-foreground">{formatMoney(invoice.issuedAmount)}</td>
      {canApprove ? (
        <td className="px-4 py-3">
          <div className="flex justify-end gap-2">
            {canReviewInvoice(invoice.status) ? (
              <>
                <form action={approveInvoiceRequestAction}>
                  <input name="id" type="hidden" value={invoice.id} />
                  <IconButton icon={CheckCircle2} label="Aprovar" tone="primary" />
                </form>
                <form action={rejectInvoiceRequestAction}>
                  <input name="id" type="hidden" value={invoice.id} />
                  <input name="adjustment" type="hidden" value="on" />
                  <IconButton icon={Ban} label="Ajuste" tone="warning" />
                </form>
              </>
            ) : null}
            {invoice.status === "approved" ? (
              <form action={markInvoicePaidAction}>
                <input name="id" type="hidden" value={invoice.id} />
                <IconButton icon={DollarSign} label="Pago" tone="primary" />
              </form>
            ) : null}
          </div>
        </td>
      ) : null}
    </tr>
  );
}

function StatusBadge({ danger, label }: { danger: boolean; label: string }) {
  const className = danger
    ? "border-destructive/30 bg-destructive/10 text-destructive"
    : "border-secondary/30 bg-secondary/10 text-secondary-foreground";

  return <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${className}`}>{label}</span>;
}

function IconButton({
  icon: Icon,
  label,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  tone: "primary" | "warning";
}) {
  const className =
    tone === "primary"
      ? "border-primary/30 text-primary hover:bg-primary/10"
      : "border-secondary/30 text-secondary-foreground hover:bg-secondary/10";

  return (
    <button aria-label={label} className={`inline-flex size-8 items-center justify-center rounded-md border transition-colors ${className}`} title={label} type="submit">
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}

function currentCompetence() {
  return new Date().toISOString().slice(0, 7);
}

const inputClassName =
  "h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

const textareaClassName =
  "min-h-24 w-full min-w-0 resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

const fieldClassName = "grid min-w-0 gap-1 text-sm font-medium";

const primaryButtonClassName =
  "inline-flex h-10 w-full min-w-0 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90";
