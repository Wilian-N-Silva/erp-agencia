import { centsToMoney, moneyToCents } from "@/features/finance/rules";
import type { InvoiceRequestStatus } from "./rules";

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
