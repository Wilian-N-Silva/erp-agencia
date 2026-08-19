import type { AccessContext } from "@/lib/dal";
import { auditActions, type AuditAction } from "@/lib/audit";
import { can, canAny } from "@/lib/rbac";

export const auditActionLabels: Record<AuditAction, string> = {
  "auth.login": "Login",
  "auth.logout": "Logout",
  "auth.denied": "Acesso negado",
  approve: "Aprovacao",
  create: "Criacao",
  delete: "Exclusao",
  export: "Exportacao",
  permission_change: "Permissao",
  rate_limit_exceeded: "Limite de tentativas excedido",
  reject: "Recusa",
  sensitive_read: "Leitura sensivel",
  status_change: "Status",
  update: "Edicao",
};

export const auditEntityLabels: Record<string, string> = {
  access_record: "Acesso",
  alert: "Alerta",
  audit_log: "Auditoria",
  client: "Cliente",
  employee: "Colaborador",
  equipment: "Equipamento",
  file: "Arquivo",
  financial_entry: "Entrada financeira",
  financial_expense: "Saida financeira",
  financial_report: "Relatorio financeiro",
  invoice_request: "NF PJ",
  lifecycle_checklist: "Checklist",
  lifecycle_checklist_item: "Item de checklist",
  permission: "Permissao",
  provision: "Provisao",
  reimbursement_request: "Reembolso",
  role: "Perfil",
  saas_subscription: "Assinatura",
  time_off_request: "Ferias/pausa",
  user: "Usuario",
};

export type AuditFilters = {
  action?: AuditAction | "all";
  actorUserId?: string;
  dateFrom?: string;
  dateTo?: string;
  entityId?: string;
  entityType?: string;
  query?: string;
};

const financeAuditEntities = [
  "client",
  "financial_entry",
  "financial_expense",
  "financial_report",
  "invoice_request",
  "provision",
  "reimbursement_request",
];

const peopleAuditEntities = [
  "employee",
  "file",
  "invoice_request",
  "lifecycle_checklist",
  "lifecycle_checklist_item",
  "reimbursement_request",
  "time_off_request",
];

const governanceAuditEntities = [
  "access_record",
  "alert",
  "equipment",
  "lifecycle_checklist",
  "lifecycle_checklist_item",
  "saas_subscription",
];

export function canReadAuditReport(context: AccessContext) {
  return canAny(["audit.read", "audit.read_limited"], context);
}

export function canReadAuditPayloads(context: AccessContext) {
  return can("audit.read", context);
}

export function canExportAuditReport(context: AccessContext) {
  return can("audit.read", context);
}

export function getVisibleAuditEntityTypes(context: AccessContext) {
  if (can("audit.read", context)) {
    return null;
  }

  if (!can("audit.read_limited", context)) {
    return [];
  }

  const entityTypes = new Set<string>();

  if (canAny(["finance.read", "finance.write", "finance.export", "clients.read", "clients.write"], context)) {
    financeAuditEntities.forEach((entityType) => entityTypes.add(entityType));
  }

  if (
    canAny(
      [
        "people.read",
        "people.write",
        "compensation.read",
        "documents.read_sensitive",
        "documents.write",
        "timeoff.read",
        "timeoff.write",
        "invoices.read",
        "invoices.write",
        "reimbursements.read",
        "reimbursements.approve_finance",
        "lifecycle.read",
        "lifecycle.write",
      ],
      context,
    )
  ) {
    peopleAuditEntities.forEach((entityType) => entityTypes.add(entityType));
  }

  if (
    canAny(
      [
        "equipment.read",
        "equipment.write",
        "access_records.read",
        "access_records.write",
        "saas.read",
        "saas.write",
        "alerts.read",
        "alerts.write",
      ],
      context,
    )
  ) {
    governanceAuditEntities.forEach((entityType) => entityTypes.add(entityType));
  }

  return [...entityTypes].sort();
}

export function normalizeAuditFilters(input: {
  action?: string | string[];
  actorUserId?: string | string[];
  dateFrom?: string | string[];
  dateTo?: string | string[];
  entityId?: string | string[];
  entityType?: string | string[];
  q?: string | string[];
  query?: string | string[];
}): AuditFilters {
  const action = firstValue(input.action);

  return {
    action: isAuditActionFilter(action) ? action : "all",
    actorUserId: normalizeId(firstValue(input.actorUserId)),
    dateFrom: normalizeDate(firstValue(input.dateFrom)),
    dateTo: normalizeDate(firstValue(input.dateTo)),
    entityId: normalizeSearchValue(firstValue(input.entityId)),
    entityType: normalizeEntityType(firstValue(input.entityType)),
    query: normalizeSearchValue(firstValue(input.q) ?? firstValue(input.query)),
  };
}

export function applyAuditTextFilter<
  T extends {
    action: string;
    actorEmail: string | null;
    actorName: string | null;
    entityId: string | null;
    entityType: string;
  },
>(logs: readonly T[], query?: string) {
  const normalizedQuery = query?.toLowerCase();

  if (!normalizedQuery) {
    return [...logs];
  }

  return logs.filter((log) =>
    [
      log.action,
      auditActionLabels[log.action as AuditAction] ?? "",
      log.actorEmail ?? "",
      log.actorName ?? "",
      log.entityId ?? "",
      log.entityType,
      auditEntityLabels[log.entityType] ?? "",
    ].some((value) => value.toLowerCase().includes(normalizedQuery)),
  );
}

export function isAuditActionFilter(value: string | undefined): value is AuditAction | "all" {
  return Boolean(value && (value === "all" || (auditActions as readonly string[]).includes(value)));
}

export function toAuditDateBoundary(value: string, boundary: "end" | "start") {
  return new Date(`${value}T${boundary === "start" ? "00:00:00.000" : "23:59:59.999"}Z`);
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeDate(value: string | undefined) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

function normalizeEntityType(value: string | undefined) {
  const normalized = normalizeSearchValue(value);

  return normalized?.replace(/[^\w.-]/g, "");
}

function normalizeId(value: string | undefined) {
  const normalized = normalizeSearchValue(value);

  return normalized?.slice(0, 200);
}

function normalizeSearchValue(value: string | undefined) {
  const normalized = value?.trim();

  return normalized || undefined;
}
