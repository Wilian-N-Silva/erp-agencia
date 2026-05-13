import type { AccessContext, EmployeeScopeTarget } from "@/lib/dal";
import { canReadEmployeeTarget } from "@/lib/dal";
import { can, canAny } from "@/lib/rbac";

import { centsToMoney, formatCompetence, moneyToCents } from "@/features/finance/rules";

export const invoiceRequestStatusLabels = {
  draft: "Rascunho",
  published: "Aguardando envio",
  submitted: "Enviada",
  under_review: "Em conferencia",
  adjustment_requested: "Aguardando ajuste",
  approved: "Aprovada",
  rejected: "Recusada",
  paid: "Paga",
  cancelled: "Cancelada",
} as const;

export const reimbursementStatusLabels = {
  draft: "Rascunho",
  submitted: "Enviado",
  manager_approved: "Aprovado pelo gestor",
  manager_rejected: "Recusado pelo gestor",
  finance_approved: "Aprovado pelo financeiro",
  finance_rejected: "Recusado pelo financeiro",
  included_in_invoice: "Incluido na NF",
  paid: "Pago",
  cancelled: "Cancelado",
} as const;

export const invoiceItemKindLabels = {
  base: "Remuneracao base",
  transport: "Transporte",
  allowance: "Ajuda de custo",
  reimbursement: "Reembolsos aprovados",
  other: "Outros adicionais",
  discount: "Descontos",
} as const;

export const reimbursementCategories = [
  "Transporte por aplicativo",
  "Estacionamento",
  "Combustivel/deslocamento",
  "Alimentacao",
  "Viagem",
  "Hospedagem",
  "Producao/eventos",
  "Materiais",
  "Ferramenta digital pontual",
  "Internet/home office",
  "Outros",
] as const;

export type InvoiceRequestStatus = keyof typeof invoiceRequestStatusLabels;
export type ReimbursementStatus = keyof typeof reimbursementStatusLabels;
export type InvoiceItemKind = keyof typeof invoiceItemKindLabels;
export type ReimbursementScope = "all" | "team" | "own" | "none";

export type InvoiceItemInput = {
  amount: string | null | undefined;
  kind: string;
};

export type InvoiceRequestTarget = EmployeeScopeTarget & {
  status: InvoiceRequestStatus;
};

export type ReimbursementTarget = EmployeeScopeTarget & {
  status: ReimbursementStatus;
};

export function calculateInvoiceExpectedAmount(items: readonly InvoiceItemInput[]) {
  const totalCents = items.reduce((total, item) => {
    const amountCents = moneyToCents(item.amount);

    return total + (item.kind === "discount" ? -amountCents : amountCents);
  }, 0);

  return centsToMoney(Math.max(totalCents, 0));
}

export function hasInvoiceDivergence(expectedAmount: string, issuedAmount: string | null | undefined) {
  return Boolean(issuedAmount && moneyToCents(expectedAmount) !== moneyToCents(issuedAmount));
}

export function canSubmitInvoice(status: InvoiceRequestStatus) {
  return status === "published" || status === "adjustment_requested";
}

export function canReviewInvoice(status: InvoiceRequestStatus) {
  return status === "submitted" || status === "under_review" || status === "adjustment_requested";
}

export function canMarkInvoicePaid(status: InvoiceRequestStatus) {
  return status === "approved";
}

export function buildSuggestedInvoiceDescription(input: {
  areaName: string;
  competence: string;
  positionName: string;
}) {
  return `Prestacao de servicos de ${input.positionName}/${input.areaName} referente a competencia de ${formatCompetence(input.competence)}, incluindo remuneracao contratada, ajuda de custo, transporte e reembolsos aprovados no periodo.`;
}

export function canReadInvoiceRequest(context: AccessContext, target: EmployeeScopeTarget) {
  return canAny(["invoices.read", "invoices.write", "invoices.approve"], context) ||
    (can("invoices.read_own", context) && context.employeeId === target.employeeId);
}

export function canCreateInvoiceRequest(context: AccessContext) {
  return can("invoices.write", context);
}

export function canSubmitInvoiceRequest(context: AccessContext, target: InvoiceRequestTarget) {
  return (
    canSubmitInvoice(target.status) &&
    can("invoices.read_own", context) &&
    context.employeeId === target.employeeId
  );
}

export function canApproveInvoiceRequest(context: AccessContext) {
  return can("invoices.approve", context);
}

export function getReimbursementScope(context: AccessContext): ReimbursementScope {
  if (canAny(["reimbursements.read", "reimbursements.write", "reimbursements.approve_finance"], context)) {
    return "all";
  }

  if (can("reimbursements.approve_team", context)) {
    return context.employeeId ? "team" : "none";
  }

  if (can("reimbursements.read_own", context)) {
    return context.employeeId ? "own" : "none";
  }

  return "none";
}

export function canReadReimbursement(context: AccessContext, target: ReimbursementTarget) {
  if (getReimbursementScope(context) === "all") {
    return true;
  }

  return canReadEmployeeTarget(context, target);
}

export function canSubmitReimbursement(context: AccessContext, target: ReimbursementTarget) {
  return (
    (target.status === "draft" || target.status === "cancelled") &&
    can("reimbursements.read_own", context) &&
    context.employeeId === target.employeeId
  );
}

export function canApproveReimbursementByManager(context: AccessContext, target: ReimbursementTarget) {
  return (
    target.status === "submitted" &&
    can("reimbursements.approve_team", context) &&
    Boolean(context.employeeId && target.managerEmployeeId === context.employeeId)
  );
}

export function canApproveReimbursementByFinance(context: AccessContext, target: ReimbursementTarget) {
  return (
    (target.status === "submitted" || target.status === "manager_approved") &&
    can("reimbursements.approve_finance", context)
  );
}

export function canMarkReimbursementPaid(context: AccessContext, target: ReimbursementTarget) {
  return target.status === "finance_approved" && can("reimbursements.approve_finance", context);
}

export function normalizePortalTab(value: string | undefined) {
  return value === "nfs" || value === "reembolsos" || value === "dados" ? value : "inicio";
}
