import { Ban, CheckCircle2, DollarSign, type LucideIcon } from "lucide-react";
import { redirect } from "next/navigation";

import {
  approveReimbursementByFinanceAction,
  approveReimbursementByManagerAction,
  markReimbursementPaidAction,
  rejectReimbursementByFinanceAction,
  rejectReimbursementByManagerAction,
} from "@/features/portal/actions";
import { listReimbursements, type ReimbursementListItem } from "@/features/portal/dal";
import {
  canApproveReimbursementByFinance,
  canApproveReimbursementByManager,
  canMarkReimbursementPaid,
  reimbursementStatusLabels,
} from "@/features/portal/rules";
import { formatDate, formatMoney } from "@/features/finance/rules";
import { getCurrentAccessContext, type AccessContext } from "@/lib/dal";
import { canAny } from "@/lib/rbac";

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

function ReimbursementRow({
  context,
  reimbursement,
}: {
  context: AccessContext;
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
        </div>
      </td>
    </tr>
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
