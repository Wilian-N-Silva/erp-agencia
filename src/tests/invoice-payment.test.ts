import { expect, it } from "vitest";
import { deriveInvoicePayment } from "@/features/portal/invoice-payment-rules";
const input = { status: "approved" as const, paidAt: null, financialExpenseId: "payable", payableAmount: "100.00", payableStatus: "planned", paidAmount: "0.00", lastPaymentAt: new Date("2026-09-30T12:00:00Z") };
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
