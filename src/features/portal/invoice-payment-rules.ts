import { centsToMoney, moneyToCents } from "@/features/finance/rules";
import type { InvoiceRequestStatus, ReimbursementStatus } from "./rules";

export function deriveInvoicePayment(input: {
  status: InvoiceRequestStatus; paidAt: Date | null; financialExpenseId: string | null;
  payableAmount: string | null; payableStatus: string | null; paidAmount: string; lastPaymentAt: Date | null;
}) {
  if (!input.financialExpenseId) return {
    status: input.status, paidAt: input.paidAt,
    payment: { state: "legacy" as const, paid: null, remaining: null },
  };
  const available = input.payableAmount !== null && input.payableStatus !== "cancelled";
  const amount = moneyToCents(input.payableAmount);
  const paid = moneyToCents(input.paidAmount);
  const settled = available && amount > 0 && paid >= amount;
  const status: InvoiceRequestStatus = ["approved", "paid"].includes(input.status) ? settled ? "paid" : "approved" : input.status;
  return { status, paidAt: settled ? input.lastPaymentAt : null, payment: {
    state: !available ? "unavailable" as const : settled ? "settled" as const : paid > 0 ? "partial" as const : "open" as const,
    paid: centsToMoney(paid), remaining: available ? centsToMoney(Math.max(0,amount-paid)) : null,
  } };
}

export const invoicePaymentLabels = {
  legacy: "Histórico sem vínculo financeiro — requer conferência",
  unavailable: "Conta a pagar indisponível ou cancelada — verificar no Financeiro",
  settled: "Pago e conciliado", partial: "Pagamento parcial", open: "Aguardando pagamento",
};

export function deriveReimbursementInvoicePayment(
  status: ReimbursementStatus,
  paidAt: Date | null,
  linkedInvoiceId: string | null,
  invoice: ReturnType<typeof deriveInvoicePayment> | undefined,
) {
  if (!linkedInvoiceId) return { status, paidAt, invoicePaymentLabel: null };
  if (!invoice || invoice.payment.state === "unavailable") return {
    status: status === "paid" ? "included_in_invoice" as const : status,
    paidAt: null,
    invoicePaymentLabel: "NF ou conta a pagar indisponível — verificar no Financeiro",
  };
  if (invoice.payment.state === "legacy") return {
    status, paidAt, invoicePaymentLabel: "NF sem vínculo financeiro — requer conferência",
  };
  const paid = invoice.status === "paid" && invoice.payment.state === "settled";
  return {
    status: ["paid", "included_in_invoice"].includes(status)
      ? paid ? "paid" as const : "included_in_invoice" as const
      : status,
    paidAt: paid ? invoice.paidAt : null,
    invoicePaymentLabel: paid ? "Pago pela quitação da NF"
      : invoice.payment.state === "partial" ? "NF parcialmente paga — aguardando quitação"
      : "Pagamento acompanha a quitação da NF",
  };
}

export function deriveDirectReimbursementPayment(status: ReimbursementStatus, paidAt: Date | null,
  financialExpenseId: string | null, payment: ReturnType<typeof deriveInvoicePayment> | undefined) {
  if (!financialExpenseId) return { status, paidAt, invoicePaymentLabel: status === "paid" ? "Pagamento histórico sem vínculo financeiro — requer conferência" : null };
  const settled = payment?.payment.state === "settled";
  return {
    status: settled ? "paid" as const : "finance_approved" as const,
    paidAt: settled ? payment.paidAt : null,
    invoicePaymentLabel: !payment || payment.payment.state === "unavailable" ? "Conta a pagar avulsa indisponível — verificar no Financeiro"
      : settled ? "Pago pela conciliação da conta a pagar avulsa"
      : payment.payment.state === "partial" ? "Conta a pagar avulsa parcialmente paga"
      : "Pagamento acompanha a conta a pagar avulsa",
  };
}
