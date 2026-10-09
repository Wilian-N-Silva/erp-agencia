import { expect, it } from "vitest";
import { computeFinanceDashboard, type FinanceEntryRecord, type FinanceExpenseRecord } from "@/features/finance/rules";

it("ages the remaining balance of partial titles, excluding settled, cancelled and not yet overdue titles", () => {
  const receivable: FinanceEntryRecord = { amount: "100.00", competence: "2026-10", dueDate: "2026-10-08", receivedAmount: "40.00", status: "planned" };
  const payable: FinanceExpenseRecord = { amount: "200.00", competence: "2026-10", dueDate: "2026-10-08", paidAmount: "50.00", status: "planned" };
  const totals = computeFinanceDashboard({
    entries: [receivable, { ...receivable, receivedAmount: "100.00" }, { ...receivable, status: "cancelled" }, { ...receivable, dueDate: "2026-10-09" }, { ...receivable, competence: "2026-09" }],
    expenses: [payable, { ...payable, paidAmount: "200.00" }, { ...payable, status: "cancelled" }, { ...payable, dueDate: "2026-10-09" }, { ...payable, competence: "2026-09" }],
    provisions: [], asOf: "2026-10-09", competence: "2026-10",
  }).totals;
  expect(totals.incomeOverdue).toBe("60.00");
  expect(totals.expensesOverdue).toBe("150.00");
});

it("restores overdue outstanding after reversal updates the settlement", () => {
  const base: FinanceEntryRecord = { amount: "100.00", competence: "2026-10", dueDate: "2026-10-08", receivedAmount: "100.00", status: "received" };
  const total = (entry: FinanceEntryRecord) => computeFinanceDashboard({ entries: [entry], expenses: [], provisions: [], asOf: "2026-10-09" }).totals.incomeOverdue;
  expect(total(base)).toBe("0.00");
  expect(total({ ...base, receivedAmount: "0.00", status: "planned" })).toBe("100.00");
});
