import type { FinanceDashboard } from "./dal";
import {
  financialEntryStatusLabels,
  financialExpenseStatusLabels,
  formatCompetence,
  formatDate,
  formatMoney,
  provisionExpectedAmount,
  deriveFinancialObligation,
  moneyToCents,
} from "./rules";

const csvHeaders = [
  "Tipo",
  "Descricao",
  "Contraparte",
  "Categoria",
  "Competencia",
  "Vencimento",
  "Liquidacao",
  "Status",
  "Valor",
  "Recorrente",
  "Conciliado",
  "Historico reservado",
  "Saldo aberto",
] as const;

export function buildFinanceCsv(dashboard: FinanceDashboard) {
  const rows = [
    csvHeaders,
    ...dashboard.entries.map((entry) => [
      "Conta a receber",
      entry.description,
      entry.clientName ?? "",
      "",
      formatCompetence(entry.competence),
      formatDate(entry.dueDate),
      formatDate(entry.settlementDate),
      moneyToCents(entry.legacySettledAmount) > 0 ? "Historico a conferir" : financialEntryStatusLabels[entry.status],
      formatMoney(entry.amount),
      entry.recurring ? "Sim" : "Nao",
      formatMoney(entry.confirmedAmount),
      formatMoney(entry.legacySettledAmount),
      formatMoney(entry.status === "cancelled" ? "0.00" : deriveFinancialObligation({ amount: entry.amount, settledAmount: entry.receivedAmount, dueDate: entry.dueDate }).outstandingAmount),
    ]),
    ...dashboard.expenses.map((expense) => [
      "Conta a pagar",
      expense.description,
      expense.supplier,
      expense.category,
      formatCompetence(expense.competence),
      formatDate(expense.dueDate),
      formatDate(expense.settlementDate),
      moneyToCents(expense.legacySettledAmount) > 0 ? "Historico a conferir" : financialExpenseStatusLabels[expense.status],
      formatMoney(expense.amount),
      expense.recurring ? "Sim" : "Nao",
      formatMoney(expense.confirmedAmount),
      formatMoney(expense.legacySettledAmount),
      formatMoney(expense.status === "cancelled" ? "0.00" : deriveFinancialObligation({ amount: expense.amount, settledAmount: expense.settledAmount, dueDate: expense.dueDate }).outstandingAmount),
    ]),
    ...dashboard.provisions.map((provision) => [
      "Provisao prevista",
      provision.name,
      "",
      provision.category,
      formatCompetence(dashboard.competence),
      provision.expectedDay ? `Dia ${provision.expectedDay}` : "",
      "",
      provision.status,
      formatMoney(provisionExpectedAmount(provision, dashboard.competence)),
      provision.recurring ? "Sim" : "Nao",
      "", "", "",
    ]),
  ];

  return `\uFEFF${rows.map((row) => row.map(escapeCsvCell).join(";")).join("\r\n")}\r\n`;
}

export function escapeCsvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");

  if (/[;"\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}
