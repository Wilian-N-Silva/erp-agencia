import { Ban, CheckCircle2, DollarSign, FilePlus2, FileMinus2, type LucideIcon } from "lucide-react";
import { redirect } from "next/navigation";

import { ActionDialog } from "@/components/ui/action-dialog";
import {
  approveReimbursementByFinanceAction,
  approveReimbursementByManagerAction,
  excludeReimbursementFromInvoiceAction,
  includeReimbursementInInvoiceAction,
  markReimbursementPaidAction,
  rejectReimbursementByFinanceAction,
  rejectReimbursementByManagerAction,
} from "@/features/portal/actions";
import {
  listOpenInvoicesForEmployee,
  listReimbursements,
  type OpenInvoiceOption,
  type ReimbursementListItem,
} from "@/features/portal/dal";
import {
  canApproveReimbursementByFinance,
  canApproveReimbursementByManager,
  canIncludeReimbursementInInvoice,
  canMarkReimbursementPaid,
  invoiceRequestStatusLabels,
  reimbursementStatusLabels,
} from "@/features/portal/rules";
import { formatCompetence, formatDate, formatMoney } from "@/features/finance/rules";
import { getCurrentAccessContext, type AccessContext } from "@/lib/dal";
import { can, canAny } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function ReimbursementsPage() {
  const context = await getCurrentAccessContext();

  if (!context) {
    redirect("/login");
  }

  if (
    !canAny(
      [
        "reimbursements.read",
        "reimbursements.approve_team",
        "reimbursements.approve_finance",
      ],
      context,
    )
  ) {
    redirect("/acesso-negado");
  }

  const reimbursements = await listReimbursements(context);
  const openInvoicesByEmployee = await loadOpenInvoicesForReimbursements(context, reimbursements);

  return (
    <section className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-normal">Reembolsos</h1>
        <p className="text-sm text-muted-foreground">Aprovacao, conferencia e pagamento</p>
      </div>

      <section className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-base font-semibold">Solicitacoes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Colaborador</th>
                <th className="px-4 py-3 font-medium">Descricao</th>
                <th className="px-4 py-3 font-medium">Categoria</th>
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Valor</th>
                <th className="px-4 py-3 text-right font-medium">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {reimbursements.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-muted-foreground" colSpan={7}>
                    Nenhum reembolso encontrado.
                  </td>
                </tr>
              ) : (
                reimbursements.map((reimbursement) => (
                  <ReimbursementRow
                    context={context}
                    key={reimbursement.id}
                    openInvoices={openInvoicesByEmployee.get(reimbursement.employeeId) ?? []}
                    reimbursement={reimbursement}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

async function loadOpenInvoicesForReimbursements(
  context: AccessContext,
  reimbursements: readonly ReimbursementListItem[],
): Promise<Map<string, OpenInvoiceOption[]>> {
  const result = new Map<string, OpenInvoiceOption[]>();

  if (!can("invoices.write", context)) {
    return result;
  }

  const employeeIds = new Set<string>();

  for (const reimbursement of reimbursements) {
    if (reimbursement.status === "finance_approved") {
      employeeIds.add(reimbursement.employeeId);
    }
  }

  for (const employeeId of employeeIds) {
    result.set(employeeId, await listOpenInvoicesForEmployee(context, employeeId));
  }

  return result;
}

function ReimbursementRow({
  context,
  openInvoices,
  reimbursement,
}: {
  context: AccessContext;
  openInvoices: OpenInvoiceOption[];
  reimbursement: ReimbursementListItem;
}) {
  const target = {
    employeeId: reimbursement.employeeId,
    managerEmployeeId: reimbursement.managerEmployeeId,
    status: reimbursement.status,
  };
  const canManagerApprove = canApproveReimbursementByManager(context, target);
  const canFinanceApprove = canApproveReimbursementByFinance(context, target);
  const canPay = canMarkReimbursementPaid(context, target);
  const eligibleInvoices = openInvoices.filter((invoice) =>
    canIncludeReimbursementInInvoice(
      context,
      { employeeId: reimbursement.employeeId, status: reimbursement.status },
      { employeeId: reimbursement.employeeId, status: invoice.status },
    ),
  );
  const showIncludeAction = reimbursement.status === "finance_approved" && eligibleInvoices.length > 0;
  const showExcludeAction =
    reimbursement.status === "included_in_invoice" && can("invoices.write", context);

  return (
    <tr className="border-b last:border-b-0">
      <td className="px-4 py-3 font-medium">{reimbursement.employeeName}</td>
      <td className="px-4 py-3">
        <p className="font-medium">{reimbursement.title}</p>
        {reimbursement.notes ? <p className="text-xs text-muted-foreground">{reimbursement.notes}</p> : null}
      </td>
      <td className="px-4 py-3 text-muted-foreground">{reimbursement.category}</td>
      <td className="px-4 py-3 text-muted-foreground">{formatDate(reimbursement.expenseDate)}</td>
      <td className="px-4 py-3">
        <StatusBadge label={reimbursementStatusLabels[reimbursement.status]} />
      </td>
      <td className="px-4 py-3 text-right font-medium">{formatMoney(reimbursement.amount)}</td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-2">
          {canManagerApprove ? (
            <>
              <form action={approveReimbursementByManagerAction}>
                <input name="id" type="hidden" value={reimbursement.id} />
                <IconButton icon={CheckCircle2} label="Aprovar gestor" tone="primary" />
              </form>
              <form action={rejectReimbursementByManagerAction}>
                <input name="id" type="hidden" value={reimbursement.id} />
                <IconButton icon={Ban} label="Recusar gestor" tone="destructive" />
              </form>
            </>
          ) : null}
          {canFinanceApprove ? (
            <>
              <form action={approveReimbursementByFinanceAction}>
                <input name="id" type="hidden" value={reimbursement.id} />
                <IconButton icon={CheckCircle2} label="Aprovar financeiro" tone="primary" />
              </form>
              <form action={rejectReimbursementByFinanceAction}>
                <input name="id" type="hidden" value={reimbursement.id} />
                <IconButton icon={Ban} label="Recusar financeiro" tone="destructive" />
              </form>
            </>
          ) : null}
          {canPay ? (
            <form action={markReimbursementPaidAction}>
              <input name="id" type="hidden" value={reimbursement.id} />
              <IconButton icon={DollarSign} label="Marcar pago" tone="primary" />
            </form>
          ) : null}
          {showIncludeAction ? (
            <IncludeInInvoiceDialog
              eligibleInvoices={eligibleInvoices}
              reimbursementId={reimbursement.id}
            />
          ) : null}
          {showExcludeAction ? (
            <form action={excludeReimbursementFromInvoiceAction}>
              <input name="reimbursementId" type="hidden" value={reimbursement.id} />
              <IconButton icon={FileMinus2} label="Remover da NF" tone="destructive" />
            </form>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function IncludeInInvoiceDialog({
  eligibleInvoices,
  reimbursementId,
}: {
  eligibleInvoices: OpenInvoiceOption[];
  reimbursementId: string;
}) {
  return (
    <ActionDialog
      title="Incluir reembolso em NF"
      trigger={<FilePlus2 className="size-4" aria-hidden="true" />}
      triggerClassName="inline-flex size-8 items-center justify-center rounded-md border border-primary/30 text-primary transition-colors hover:bg-primary/10"
      triggerLabel="Incluir na NF"
    >
      <form action={includeReimbursementInInvoiceAction} className="flex flex-col gap-3">
        <input name="reimbursementId" type="hidden" value={reimbursementId} />
        <p className="text-sm text-muted-foreground">
          Selecione a NF do colaborador para somar este reembolso na composicao.
        </p>
        <div className="flex flex-col gap-2">
          {eligibleInvoices.map((invoice) => (
            <label
              className="flex cursor-pointer items-center gap-3 rounded-md border bg-background px-3 py-2 hover:bg-muted"
              key={invoice.id}
            >
              <input
                name="invoiceRequestId"
                required
                type="radio"
                value={invoice.id}
              />
              <div className="flex flex-1 flex-col">
                <span className="text-sm font-medium">
                  {formatCompetence(invoice.competence)} - {invoiceRequestStatusLabels[invoice.status]}
                </span>
                <span className="text-xs text-muted-foreground">
                  Vencimento {formatDate(invoice.dueDate)} - Valor esperado {formatMoney(invoice.expectedAmount)}
                </span>
              </div>
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            className="inline-flex items-center justify-center rounded-md border bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            type="submit"
          >
            Incluir na NF
          </button>
        </div>
      </form>
    </ActionDialog>
  );
}

function StatusBadge({ label }: { label: string }) {
  return <span className="inline-flex rounded-md border border-secondary/30 bg-secondary/10 px-2 py-1 text-xs font-medium text-secondary-foreground">{label}</span>;
}

function IconButton({
  icon: Icon,
  label,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  tone: "destructive" | "primary";
}) {
  const className =
    tone === "primary"
      ? "border-primary/30 text-primary hover:bg-primary/10"
      : "border-destructive/30 text-destructive hover:bg-destructive/10";

  return (
    <button aria-label={label} className={`inline-flex size-8 items-center justify-center rounded-md border transition-colors ${className}`} title={label} type="submit">
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}
