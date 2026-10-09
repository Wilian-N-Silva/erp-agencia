import { expect, it } from "vitest";
import { deriveInvoicePayment, deriveReimbursementInvoicePayment } from "@/features/portal/invoice-payment-rules";
const input = { status: "approved" as const, paidAt: null, financialExpenseId: "payable", payableAmount: "100.00", payableStatus: "planned", paidAmount: "0.00", lastPaymentAt: new Date("2026-09-30T12:00:00Z") };
it("reimbursement follows full invoice settlement without inventing an allocation of partial payments", () => {
  const partial = deriveInvoicePayment({ ...input, paidAmount: "40.00" });
  expect(deriveReimbursementInvoicePayment("included_in_invoice", null, "nf", partial)).toMatchObject({ status: "included_in_invoice", paidAt: null, invoicePaymentLabel: "NF parcialmente paga — aguardando quitação" });
  const settled = deriveInvoicePayment({ ...input, paidAmount: "100.00" });
  expect(deriveReimbursementInvoicePayment("included_in_invoice", null, "nf", settled)).toMatchObject({ status: "paid", paidAt: input.lastPaymentAt });
  expect(deriveReimbursementInvoicePayment("paid", input.lastPaymentAt, "nf", partial)).toMatchObject({ status: "included_in_invoice", paidAt: null });
});
it("preserves direct and legacy history but does not report an unavailable linked invoice as paid", () => {
  expect(deriveReimbursementInvoicePayment("paid", input.lastPaymentAt, null, undefined)).toEqual({ status: "paid", paidAt: input.lastPaymentAt, invoicePaymentLabel: null });
  expect(deriveReimbursementInvoicePayment("paid", input.lastPaymentAt, "nf", undefined).status).toBe("included_in_invoice");
  const legacy = deriveInvoicePayment({ ...input, financialExpenseId: null });
  expect(deriveReimbursementInvoicePayment("paid", input.lastPaymentAt, "nf", legacy)).toMatchObject({ status: "paid", paidAt: input.lastPaymentAt });
});
it("derives open, partial and full payment and reopens when allocations are reversed", () => {
  expect(deriveInvoicePayment(input).payment.state).toBe("open");
  expect(deriveInvoicePayment({ ...input, paidAmount: "40.00" })).toMatchObject({ status: "approved", paidAt: null, payment: { state: "partial", remaining: "60.00" } });
  expect(deriveInvoicePayment({ ...input, paidAmount: "100.00" })).toMatchObject({ status: "paid", paidAt: input.lastPaymentAt, payment: { state: "settled", remaining: "0.00" } });
  expect(deriveInvoicePayment({ ...input, status: "paid", paidAmount: "0.00" })).toMatchObject({ status: "approved", paidAt: null });
});
it("preserves unlinked history and does not claim settlement of unavailable obligations", () => {
  expect(deriveInvoicePayment({ ...input, financialExpenseId: null, status: "paid", paidAt: input.lastPaymentAt })).toMatchObject({ status: "paid", payment: { state: "legacy", paid: null } });
  expect(deriveInvoicePayment({ ...input, payableStatus: "cancelled", paidAmount: "100.00" })).toMatchObject({ status: "approved", payment: { state: "unavailable" } });
  expect(deriveInvoicePayment({ ...input, payableAmount: null })).toMatchObject({ payment: { state: "unavailable" } });
});
import { deriveDirectReimbursementPayment } from "@/features/portal/invoice-payment-rules";

it("derives direct reimbursement payment from its payable and preserves explicit historical warnings", () => {
  expect(deriveDirectReimbursementPayment("paid", input.lastPaymentAt, null, undefined)).toMatchObject({ status: "paid", invoicePaymentLabel: expect.stringContaining("histórico") });
  expect(deriveDirectReimbursementPayment("finance_approved", null, "payable", deriveInvoicePayment({ ...input, paidAmount: "40.00" }))).toMatchObject({ status: "finance_approved", paidAt: null, invoicePaymentLabel: expect.stringContaining("parcialmente") });
  expect(deriveDirectReimbursementPayment("finance_approved", null, "payable", deriveInvoicePayment({ ...input, paidAmount: "100.00" }))).toMatchObject({ status: "paid", paidAt: input.lastPaymentAt });
  expect(deriveDirectReimbursementPayment("paid", input.lastPaymentAt, "payable", deriveInvoicePayment({ ...input, paidAmount: "0.00" }))).toMatchObject({ status: "finance_approved", paidAt: null });
  expect(deriveDirectReimbursementPayment("paid", input.lastPaymentAt, "payable", undefined)).toMatchObject({ status: "finance_approved", paidAt: null, invoicePaymentLabel: expect.stringContaining("indisponível") });
});
