import { describe, expect, it } from "vitest";
import { summarizeGraphicFinance, type GraphicFinancialTitle } from "@/features/graphics/finance-summary-rules";

const title = (amount: string, settled = "0.00"): GraphicFinancialTitle => ({ amount, settled, allocated: settled, dueDate: "2026-10-01", cancelled: false, archived: false });
const base = { contracted: "1000.00", receivables: [title("300.00", "300.00"), title("700.00")], payables: [title("600.00", "200.00")], pendingMovements: 0, today: "2026-09-21" };
describe("GRF-010 financial summary", () => {
  it("separates contracted margin, actual cash and remaining obligations", () => {
    expect(summarizeGraphicFinance(base)).toMatchObject({ contracted: "1000.00", receivableOpen: "700.00", received: "300.00", payableOpen: "400.00", paid: "200.00", contractedMargin: "400.00", cashResult: "100.00", reliable: true, status: "partial" });
  });
  it("does not present missing costs as zero-cost profit or incomplete sales as liquidated", () => {
    expect(summarizeGraphicFinance({ ...base, payables: [] })).toMatchObject({ reliable: false, contractedMargin: null, cashResult: null });
    expect(summarizeGraphicFinance({ ...base, contracted: null, receivables: [], payables: [title("600.00", "600.00")] }).status).not.toBe("settled");
  });
  it("excludes inactive obligations and flags unproven historic settlements", () => {
    const result = summarizeGraphicFinance({ ...base, receivables: [title("300.00", "300.00"), { ...title("700.00"), cancelled: true }], payables: [{ ...title("600.00", "200.00"), allocated: "0.00" }] });
    expect(result).toMatchObject({ receivableTotal: "300.00", receivableOpen: "0.00", paid: "0.00", reliable: false, contractedMargin: null });
    expect(result.warnings).toHaveLength(3);
  });
  it("withholds margin for pending reconciliation and prioritizes overdue balances", () => {
    expect(summarizeGraphicFinance({ ...base, pendingMovements: 1 })).toMatchObject({ contractedMargin: null, reliable: false });
    expect(summarizeGraphicFinance({ ...base, today: "2026-10-02" })).toMatchObject({ overdueReceivables: "700.00", overduePayables: "400.00", status: "overdue" });
    expect(summarizeGraphicFinance({ ...base, receivables: [title("1000.00", "1000.00")], payables: [title("600.00", "600.00")] })).toMatchObject({ status: "settled", cashResult: "400.00" });
  });
  it("retains cent precision and exposes a negative contracted margin", () => {
    expect(summarizeGraphicFinance({ ...base, contracted: "0.30", receivables: [title("0.10"), title("0.20")], payables: [title("0.40")] })).toMatchObject({ contractedMargin: "-0.10", receivableTotal: "0.30" });
  });
});
