import {
  auditActionLabels,
  auditEntityLabels,
  type AuditFilters,
} from "./rules";
import type { AuditLogListItem } from "./dal";

const csvHeaders = [
  "ID",
  "Data",
  "Acao",
  "Entidade",
  "ID da entidade",
  "Ator",
  "Email do ator",
  "Payload",
] as const;

export function buildAuditCsv(logs: readonly AuditLogListItem[], filters: AuditFilters) {
  const rows = [
    ["Filtros", describeFilters(filters), "", "", "", "", "", ""],
    csvHeaders,
    ...logs.map((log) => [
      log.id,
      formatDateTime(log.createdAt),
      auditActionLabels[log.action as keyof typeof auditActionLabels] ?? log.action,
      auditEntityLabels[log.entityType] ?? log.entityType,
      log.entityId ?? "",
      log.actorName ?? "Sistema",
      log.actorEmail ?? "",
      log.hasBefore || log.hasAfter || log.hasMetadata ? "Sim" : "Nao",
    ]),
  ];

  return `\uFEFF${rows.map((row) => row.map(escapeCsvCell).join(";")).join("\r\n")}\r\n`;
}

function describeFilters(filters: AuditFilters) {
  return Object.entries(filters)
    .filter(([, value]) => value && value !== "all")
    .map(([key, value]) => `${key}=${value}`)
    .join(", ");
}

function escapeCsvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");

  if (/[;"\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}
