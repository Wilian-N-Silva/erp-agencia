import ExcelJS from "exceljs";

import type { FinanceDashboard } from "./dal";
import {
  financialEntryStatusLabels,
  financialExpenseStatusLabels,
  formatCompetence,
  formatDate,
  formatMoney,
} from "./rules";

const headers = [
  "Tipo",
  "Descricao",
  "Contraparte",
  "Categoria",
  "Competencia",
  "Vencimento",
  "Status",
  "Valor",
  "Recorrente",
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
      "Entrada",
      entry.description,
      entry.clientName ?? "",
      "",
      formatCompetence(entry.competence),
      formatDate(entry.dueDate),
      financialEntryStatusLabels[entry.status],
      formatMoney(entry.amount),
      entry.recurring ? "Sim" : "Nao",
    ]);
  }

  for (const expense of dashboard.expenses) {
    sheet.addRow([
      "Saida",
      expense.description,
      expense.supplier,
      expense.category,
      formatCompetence(expense.competence),
      formatDate(expense.dueDate),
      financialExpenseStatusLabels[expense.status],
      formatMoney(expense.amount),
      expense.recurring ? "Sim" : "Nao",
    ]);
  }

  for (const provision of dashboard.provisions) {
    sheet.addRow([
      "Provisao",
      provision.name,
      "",
      provision.category,
      "",
      provision.expectedDay ? `Dia ${provision.expectedDay}` : "",
      provision.status,
      formatMoney(provision.estimatedMonthlyAmount),
      provision.recurring ? "Sim" : "Nao",
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
