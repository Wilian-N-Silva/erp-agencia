import type { AccessContext } from "@/lib/dal";
import { can, canAny } from "@/lib/rbac";

export const alertKindLabels = {
  client_payment: "Cobranca de cliente",
  financial_expense: "Conta a pagar",
  invoice_pending: "NF PJ",
  reimbursement_pending: "Reembolso",
  timeoff_pending: "Ferias/pausa",
  vacation_expiring: "Saldo de ferias",
  lifecycle_pending: "Checklist",
  equipment_return: "Equipamento",
  access_review: "Acesso",
  saas_renewal: "Assinatura",
  saas_license: "Licenca SaaS",
  birthday: "Aniversario",
} as const;

export const alertSeverityLabels = {
  low: "Baixa",
  medium: "Media",
  high: "Alta",
  critical: "Critica",
} as const;

export const alertStatusLabels = {
  open: "Aberto",
  resolved: "Resolvido",
  dismissed: "Dispensado",
} as const;

export type AlertKind = keyof typeof alertKindLabels;
export type AlertSeverity = keyof typeof alertSeverityLabels;
export type AlertStatus = keyof typeof alertStatusLabels;

export type AlertCandidate = {
  kind: AlertKind;
  title: string;
  description: string;
  severity: AlertSeverity;
  entityType: string;
  entityId: string;
  dueDate: string | null;
};

export type AlertFilters = {
  severity?: AlertSeverity | "all";
  status?: AlertStatus | "all";
  query?: string;
};

const severityRank: Record<AlertSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function canReadAlerts(context: AccessContext) {
  return canAny(["alerts.read", "alerts.write"], context);
}

export function canWriteAlerts(context: AccessContext) {
  return can("alerts.write", context);
}

export function getAlertKey(alert: Pick<AlertCandidate, "entityId" | "entityType" | "title">) {
  return `${alert.entityType}:${alert.entityId}:${alert.title}`;
}

export function dedupeAlertCandidates(candidates: readonly AlertCandidate[]) {
  const byKey = new Map<string, AlertCandidate>();

  for (const candidate of candidates) {
    byKey.set(getAlertKey(candidate), candidate);
  }

  return [...byKey.values()];
}

export function sortAlertCandidates<T extends Pick<AlertCandidate, "dueDate" | "severity" | "title">>(
  alerts: readonly T[],
) {
  return [...alerts].sort((left, right) => {
    const severityDelta = severityRank[left.severity] - severityRank[right.severity];

    if (severityDelta !== 0) {
      return severityDelta;
    }

    const leftDueDate = left.dueDate ?? "9999-12-31";
    const rightDueDate = right.dueDate ?? "9999-12-31";

    if (leftDueDate !== rightDueDate) {
      return leftDueDate.localeCompare(rightDueDate);
    }

    return left.title.localeCompare(right.title);
  });
}

export function normalizeAlertFilters(input: {
  q?: string | string[];
  query?: string | string[];
  severity?: string | string[];
  status?: string | string[];
}): AlertFilters {
  const query = firstValue(input.q) ?? firstValue(input.query);
  const severity = firstValue(input.severity);
  const status = firstValue(input.status);

  return {
    query: normalizeSearchQuery(query),
    severity: isAlertSeverityFilter(severity) ? severity : "all",
    status: isAlertStatusFilter(status) ? status : "open",
  };
}

export function applyAlertFilters<
  T extends {
    description: string | null;
    severity: AlertSeverity;
    status?: AlertStatus;
    title: string;
  },
>(alerts: readonly T[], filters: AlertFilters) {
  const query = filters.query?.toLowerCase();

  return alerts.filter(
    (alert) =>
      (!filters.severity || filters.severity === "all" || alert.severity === filters.severity) &&
      (!filters.status || !alert.status || filters.status === "all" || alert.status === filters.status) &&
      (!query ||
        [alert.title, alert.description ?? ""].some((value) =>
          value.toLowerCase().includes(query),
        )),
  );
}

export function mapReminderSeverity(severity: "low" | "medium" | "high"): AlertSeverity {
  return severity;
}

export const BIRTHDAY_ALERT_WINDOW_DAYS = 7;

export type BirthdayMatch = {
  daysUntil: number;
  occursOn: string;
};

export function getUpcomingBirthdayMatch(
  birthDate: string | null | undefined,
  asOf: string,
  windowDays = BIRTHDAY_ALERT_WINDOW_DAYS,
): BirthdayMatch | null {
  if (!birthDate || birthDate.length < 10) {
    return null;
  }

  const month = birthDate.slice(5, 7);
  const day = birthDate.slice(8, 10);

  if (!/^\d{2}$/.test(month) || !/^\d{2}$/.test(day)) {
    return null;
  }

  const asOfDate = new Date(`${asOf}T00:00:00.000Z`);

  for (let offset = 0; offset <= windowDays; offset += 1) {
    const candidate = new Date(asOfDate);
    candidate.setUTCDate(candidate.getUTCDate() + offset);

    const candidateMonth = String(candidate.getUTCMonth() + 1).padStart(2, "0");
    const candidateDay = String(candidate.getUTCDate()).padStart(2, "0");

    if (candidateMonth === month && candidateDay === day) {
      return {
        daysUntil: offset,
        occursOn: candidate.toISOString().slice(0, 10),
      };
    }
  }

  return null;
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeSearchQuery(value: string | undefined) {
  const normalized = value?.trim();

  return normalized || undefined;
}

function isAlertSeverityFilter(value: string | undefined): value is AlertSeverity | "all" {
  return Boolean(value && (value === "all" || Object.keys(alertSeverityLabels).includes(value)));
}

function isAlertStatusFilter(value: string | undefined): value is AlertStatus | "all" {
  return Boolean(value && (value === "all" || Object.keys(alertStatusLabels).includes(value)));
}
