import { describe, expect, it } from "vitest";
import { assertTitleCorrectionAllowed } from "@/features/finance/title-guards";

const title = { cancelled: false, amount: "100.00", settledAmount: "0.00", generated: false, economicFieldsChanged: false, counterpartyChanged: false };
describe("financial title corrections", () => {
  it("allows an unpaid manual title to be corrected or cancelled", () => {
    expect(() => assertTitleCorrectionAllowed({ ...title, cancellation: true })).not.toThrow();
    expect(() => assertTitleCorrectionAllowed({ ...title, nextAmount: "80.00", economicFieldsChanged: true })).not.toThrow();
  });
  it.each(["0.01", "50.00", "100.00"])("preserves settlement of %s on cancellation", settledAmount => {
    expect(() => assertTitleCorrectionAllowed({ ...title, settledAmount, cancellation: true })).toThrow("Estorne");
  });
  it("does not detach settled titles from their counterparty", () => {
    expect(() => assertTitleCorrectionAllowed({ ...title, settledAmount: "10.00", counterpartyChanged: true })).toThrow("contraparte");
  });
  it("does not reduce the amount below settlement", () => {
    expect(() => assertTitleCorrectionAllowed({ ...title, settledAmount: "50.00", nextAmount: "49.99" })).toThrow("menor");
    expect(() => assertTitleCorrectionAllowed({ ...title, settledAmount: "50.00", nextAmount: "50.00" })).not.toThrow();
  });
  it("protects origin facts while permitting documentary changes", () => {
    expect(() => assertTitleCorrectionAllowed({ ...title, generated: true, economicFieldsChanged: true })).toThrow("origem");
    expect(() => assertTitleCorrectionAllowed({ ...title, generated: true, cancellation: true })).toThrow("origem");
    expect(() => assertTitleCorrectionAllowed({ ...title, generated: true })).not.toThrow();
  });
  it("does not reopen a cancelled obligation", () => {
    expect(() => assertTitleCorrectionAllowed({ ...title, cancelled: true })).toThrow("cancelado");
  });
});
