import Link from "next/link";
import { getFinanceMasterData } from "@/features/finance-master-data/dal";
import { ReimbursementPayableSheet } from "./reimbursement-payable-sheet";
import { Ban, Check, CheckCircle2, FileMinus2, FilePlus2 } from "lucide-react";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { ActionSheet, Button, RateLimitedActionForm } from "@/components/fg";
import {
  approveReimbursementByFinanceAction,
  approveReimbursementByManagerAction,
  excludeReimbursementFromInvoiceAction,
  includeReimbursementInInvoiceAction,
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
  invoiceRequestStatusLabels,
} from "@/features/portal/rules";
import { formatCompetence, formatDate, formatMoney } from "@/features/finance/rules";
import { getCurrentAccessContext, type AccessContext } from "@/lib/dal";
import { can, canAny } from "@/lib/rbac";

import { ReembolsosView } from "./reembolsos-view";

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
  const canCreate = can("reimbursements.write", context);
  const masterData = can("finance.write", context) && can("reimbursements.approve_finance", context) ? await getFinanceMasterData(context) : null;

  const rowActions: Record<string, ReactNode> = {};
  const detailActions: Record<string, ReactNode> = {};

  for (const reimbursement of reimbursements) {
    const target = {
      employeeId: reimbursement.employeeId,
      managerEmployeeId: reimbursement.managerEmployeeId,
      status: reimbursement.status,
    };
    const canManagerApprove = canApproveReimbursementByManager(context, target);
    const canFinanceApprove = canApproveReimbursementByFinance(context, target);
    const canPay = Boolean(reimbursement.financialExpenseId ? can("finance.read", context) : !reimbursement.includedInvoiceRequestId && reimbursement.status === "finance_approved" && masterData);
    const payableAction = reimbursement.financialExpenseId
      ? <Link href="/app/financeiro/movimentacoes">Registrar pagamento e conciliar</Link>
      : masterData ? <ReimbursementPayableSheet id={reimbursement.id} masterData={masterData} /> : null;
    const eligibleInvoices = (openInvoicesByEmployee.get(reimbursement.employeeId) ?? []).filter(
      (invoice) =>
        canIncludeReimbursementInInvoice(
          context,
          { employeeId: reimbursement.employeeId, status: reimbursement.status },
          { employeeId: reimbursement.employeeId, status: invoice.status },
        ),
    );
    const showInclude = !reimbursement.financialExpenseId && reimbursement.status === "finance_approved" && eligibleInvoices.length > 0;
    const showExclude =
      reimbursement.status === "included_in_invoice" && can("invoices.write", context);

    rowActions[reimbursement.id] = (
      <RowActionForms
        canManagerApprove={canManagerApprove}
        canFinanceApprove={canFinanceApprove}
        canPay={canPay}
        payableAction={payableAction}
        reimbursementId={reimbursement.id}
      />
    );

    detailActions[reimbursement.id] = (
      <DetailActionForms
        canManagerApprove={canManagerApprove}
        canFinanceApprove={canFinanceApprove}
        canPay={canPay}
        payableAction={payableAction}
        showInclude={showInclude}
        showExclude={showExclude}
        eligibleInvoices={eligibleInvoices}
        reimbursementId={reimbursement.id}
      />
    );
  }

  return (
    <ReembolsosView
      reimbursements={reimbursements}
      canCreate={canCreate}
      rowActions={rowActions}
      detailActions={detailActions}
    />
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

function RowActionForms({
  canManagerApprove,
  canFinanceApprove,
  canPay,
  payableAction,
  reimbursementId,
}: {
  canManagerApprove: boolean;
  canFinanceApprove: boolean;
  canPay: boolean;
  payableAction: ReactNode;
  reimbursementId: string;
}) {
  if (!canManagerApprove && !canFinanceApprove && !canPay) return null;

  return (
    <>
      {canManagerApprove ? (
        <RateLimitedActionForm
          action={approveReimbursementByManagerAction}
          style={{ display: "inline" }}
        >
          <input name="id" type="hidden" value={reimbursementId} />
          <button
            type="submit"
            className="fg-icon-btn sm"
            aria-label="Aprovar (gestor)"
            title="Aprovar (gestor)"
          >
            <Check size={13} />
          </button>
        </RateLimitedActionForm>
      ) : null}
      {canFinanceApprove ? (
        <RateLimitedActionForm
          action={approveReimbursementByFinanceAction}
          style={{ display: "inline" }}
        >
          <input name="id" type="hidden" value={reimbursementId} />
          <button
            type="submit"
            className="fg-icon-btn sm"
            aria-label="Aprovar (financeiro)"
            title="Aprovar (financeiro)"
          >
            <CheckCircle2 size={13} />
          </button>
        </RateLimitedActionForm>
      ) : null}
      {canPay ? payableAction : null}
    </>
  );
}

function DetailActionForms({
  canManagerApprove,
  canFinanceApprove,
  canPay,
  payableAction,
  showInclude,
  showExclude,
  eligibleInvoices,
  reimbursementId,
}: {
  canManagerApprove: boolean;
  canFinanceApprove: boolean;
  canPay: boolean;
  payableAction: ReactNode;
  showInclude: boolean;
  showExclude: boolean;
  eligibleInvoices: OpenInvoiceOption[];
  reimbursementId: string;
}) {
  const hasAny =
    canManagerApprove || canFinanceApprove || canPay || showInclude || showExclude;

  if (!hasAny) return null;

  return (
    <>
      {canManagerApprove ? (
        <>
          <RateLimitedActionForm
            action={rejectReimbursementByManagerAction}
            style={{ display: "inline" }}
          >
            <input name="id" type="hidden" value={reimbursementId} />
            <Button type="submit" variant="destructive" size="sm" icon={<Ban size={13} />}>
              Recusar
            </Button>
          </RateLimitedActionForm>
          <RateLimitedActionForm
            action={approveReimbursementByManagerAction}
            style={{ display: "inline" }}
          >
            <input name="id" type="hidden" value={reimbursementId} />
            <Button type="submit" variant="primary" size="sm" icon={<Check size={13} />}>
              Aprovar como gestor
            </Button>
          </RateLimitedActionForm>
        </>
      ) : null}
      {canFinanceApprove ? (
        <>
          <RateLimitedActionForm
            action={rejectReimbursementByFinanceAction}
            style={{ display: "inline" }}
          >
            <input name="id" type="hidden" value={reimbursementId} />
            <Button type="submit" variant="destructive" size="sm" icon={<Ban size={13} />}>
              Recusar
            </Button>
          </RateLimitedActionForm>
          <RateLimitedActionForm
            action={approveReimbursementByFinanceAction}
            style={{ display: "inline" }}
          >
            <input name="id" type="hidden" value={reimbursementId} />
            <Button type="submit" variant="primary" size="sm" icon={<CheckCircle2 size={13} />}>
              Aprovar para pagamento
            </Button>
          </RateLimitedActionForm>
        </>
      ) : null}
      {canPay ? payableAction : null}
      {showInclude ? (
        <IncludeInInvoiceSheet
          reimbursementId={reimbursementId}
          eligibleInvoices={eligibleInvoices}
        />
      ) : null}
      {showExclude ? (
        <form action={excludeReimbursementFromInvoiceAction} style={{ display: "inline" }}>
          <input name="reimbursementId" type="hidden" value={reimbursementId} />
          <Button type="submit" variant="outline" size="sm" icon={<FileMinus2 size={13} />}>
            Remover da NF
          </Button>
        </form>
      ) : null}
    </>
  );
}

function IncludeInInvoiceSheet({
  reimbursementId,
  eligibleInvoices,
}: {
  reimbursementId: string;
  eligibleInvoices: OpenInvoiceOption[];
}) {
  return (
    <ActionSheet
      title="Incluir reembolso em NF"
      description="Selecione a NF do colaborador para somar este reembolso na composição."
      width={520}
      trigger={
        <Button type="button" variant="outline" size="sm" icon={<FilePlus2 size={13} />}>
          Incluir em NF
        </Button>
      }
    >
      <form
        action={includeReimbursementInInvoiceAction}
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        <input name="reimbursementId" type="hidden" value={reimbursementId} />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {eligibleInvoices.map((invoice) => (
            <label
              key={invoice.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                border: "1px solid var(--border)",
                borderRadius: 8,
                cursor: "pointer",
                background: "var(--surface-0)",
              }}
            >
              <input name="invoiceRequestId" required type="radio" value={invoice.id} />
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span className="fg-cell-strong">
                  {formatCompetence(invoice.competence)} ·{" "}
                  {invoiceRequestStatusLabels[invoice.status]}
                </span>
                <span className="fg-cell-sub fg-tabular">
                  Vencimento {formatDate(invoice.dueDate)} · Esperado {formatMoney(invoice.expectedAmount)}
                </span>
              </div>
            </label>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button type="submit" variant="primary" icon={<FilePlus2 size={13} />}>
            Incluir na NF
          </Button>
        </div>
      </form>
    </ActionSheet>
  );
}
