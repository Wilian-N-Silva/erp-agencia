import type { FinanceDashboard } from "./dal";
import {
  financialEntryStatusLabels,
  financialExpenseStatusLabels,
  formatCompetence,
  formatDate,
  formatMoney,
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
      financialEntryStatusLabels[entry.status],
      formatMoney(entry.amount),
      entry.recurring ? "Sim" : "Nao",
    ]),
    ...dashboard.expenses.map((expense) => [
      "Conta a pagar",
      expense.description,
      expense.supplier,
      expense.category,
      formatCompetence(expense.competence),
      formatDate(expense.dueDate),
      formatDate(expense.settlementDate),
      financialExpenseStatusLabels[expense.status],
      formatMoney(expense.amount),
      expense.recurring ? "Sim" : "Nao",
    ]),
    ...dashboard.provisions.map((provision) => [
      "Provisao",
      provision.name,
      "",
      provision.category,
      "",
      provision.expectedDay ? `Dia ${provision.expectedDay}` : "",
      "",
      provision.status,
      formatMoney(provision.estimatedMonthlyAmount),
      provision.recurring ? "Sim" : "Nao",
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
