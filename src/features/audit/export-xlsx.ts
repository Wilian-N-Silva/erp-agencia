import ExcelJS from "exceljs";

import { auditActionLabels, auditEntityLabels, type AuditFilters } from "./rules";
import type { AuditLogListItem } from "./dal";

const headers = [
  "ID",
  "Data",
  "Acao",
  "Entidade",
  "ID da entidade",
  "Ator",
  "Email do ator",
  "Payload",
] as const;

export async function buildAuditXlsx(
  logs: readonly AuditLogListItem[],
  filters: AuditFilters,
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Sistema Interno FG";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Auditoria");
  sheet.addRow(["Filtros", describeFilters(filters)]);
  sheet.addRow([]);
  sheet.addRow([...headers]);
  sheet.getRow(3).font = { bold: true };

  for (const log of logs) {
    sheet.addRow([
      log.id,
      formatDateTime(log.createdAt),
      auditActionLabels[log.action as keyof typeof auditActionLabels] ?? log.action,
      auditEntityLabels[log.entityType] ?? log.entityType,
      log.entityId ?? "",
      log.actorName ?? "Sistema",
      log.actorEmail ?? "",
      log.hasBefore || log.hasAfter || log.hasMetadata ? "Sim" : "Nao",
    ]);
  }

  sheet.columns.forEach((column) => {
    let max = 12;
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

function describeFilters(filters: AuditFilters) {
  return Object.entries(filters)
    .filter(([, value]) => value && value !== "all")
    .map(([key, value]) => `${key}=${value}`)
    .join(", ");
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}
