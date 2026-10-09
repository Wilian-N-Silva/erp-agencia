import ExcelJS from "exceljs";

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

const headers = [
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

export async function buildFinanceXlsx(dashboard: FinanceDashboard): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Sistema Interno FG";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(`Financeiro ${dashboard.competence}`);
  sheet.addRow([...headers]);
  sheet.getRow(1).font = { bold: true };

  for (const entry of dashboard.entries) {
    sheet.addRow([
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
    ]);
  }

  for (const expense of dashboard.expenses) {
    sheet.addRow([
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
    ]);
  }

  for (const provision of dashboard.provisions) {
    sheet.addRow([
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
    ]);
  }

  sheet.columns.forEach((column) => {
    let max = 10;
    column.eachCell?.((cell) => {
      const text = String(cell.value ?? "");
      if (text.length > max) {
        max = text.length;
      }
    });
    column.width = Math.min(max + 2, 60);
  });

  const buffer = await workbook.xlsx.writeBuffer();

  return new Uint8Array(buffer as ArrayBuffer);
}
