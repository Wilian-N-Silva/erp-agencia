import type { AccessContext } from "@/lib/dal";
import { can, canAny } from "@/lib/rbac";

import { addDaysToDateKey, toDateKey } from "@/features/finance/rules";

export const accessRecordStatusLabels = {
  pending: "Pendente",
  active: "Ativo",
  suspended: "Suspenso",
  removed: "Removido",
  in_review: "Em revisao",
} as const;

export const accessReviewStateLabels = {
  none: "Sem revisao",
  missing: "Sem data",
  ok: "Em dia",
  due_soon: "Proxima revisao",
  overdue: "Revisao vencida",
} as const;

export type AccessRecordStatus = keyof typeof accessRecordStatusLabels;
export type AccessReviewState = keyof typeof accessReviewStateLabels;
export type AccessRecordScope = "all" | "team" | "own" | "none";

export type AccessRecordTarget = {
  critical: boolean;
  employeeId: string;
  employeeStatus?: string | null;
  managerEmployeeId?: string | null;
  reviewDueDate?: string | Date | null;
  status: AccessRecordStatus;
};

export type AccessRecordFilters = {
  critical?: "all" | "critical" | "standard";
  query?: string;
  status?: AccessRecordStatus | "all";
};

export function canReadAccessRecord(context: AccessContext, target: AccessRecordTarget) {
  if (canAny(["access_records.read", "access_records.write", "access_records.configure"], context)) {
    return true;
  }

  if (
    can("access_records.read_team", context) &&
    context.employeeId &&
    target.managerEmployeeId === context.employeeId
  ) {
    return true;
  }

  return Boolean(
    can("access_records.read_own", context) &&
      context.employeeId &&
      target.employeeId === context.employeeId,
  );
}

export function canWriteAccessRecords(context: AccessContext) {
  return canAny(["access_records.write", "access_records.configure"], context);
}

export function getAccessRecordScope(context: AccessContext): AccessRecordScope {
  if (canAny(["access_records.read", "access_records.write", "access_records.configure"], context)) {
    return "all";
  }

  if (can("access_records.read_team", context)) {
    return context.employeeId ? "team" : "none";
  }

  if (can("access_records.read_own", context)) {
    return context.employeeId ? "own" : "none";
  }

  return "none";
}

export function getAccessReviewState(
  target: Pick<AccessRecordTarget, "critical" | "reviewDueDate" | "status">,
  asOf: string | Date = new Date(),
  reviewWindowDays = 14,
): AccessReviewState {
  if (!target.critical || target.status === "removed" || target.status === "suspended") {
    return "none";
  }

  if (!target.reviewDueDate) {
    return "missing";
  }

  const dueDate = toDateKey(target.reviewDueDate);
  const asOfKey = toDateKey(asOf);

  if (dueDate < asOfKey) {
    return "overdue";
  }

  if (dueDate <= addDaysToDateKey(asOfKey, reviewWindowDays)) {
    return "due_soon";
  }

  return "ok";
}

export function isAccessReviewAlert(target: AccessRecordTarget, asOf: string | Date = new Date()) {
  return ["missing", "overdue", "due_soon"].includes(getAccessReviewState(target, asOf));
}

export function isTerminatedEmployeeAccessAlert(target: AccessRecordTarget) {
  return target.status === "active" && target.employeeStatus === "terminated";
}

export function normalizeAccessRecordFilters(input: {
  critical?: string | string[];
  q?: string | string[];
  query?: string | string[];
  status?: string | string[];
}): AccessRecordFilters {
  const critical = firstValue(input.critical);
  const query = firstValue(input.q) ?? firstValue(input.query);
  const status = firstValue(input.status);

  return {
    critical: critical === "critical" || critical === "standard" ? critical : "all",
    query: normalizeSearchQuery(query),
    status: isAccessRecordStatusFilter(status) ? status : "all",
  };
}

export function applyAccessRecordFilters<
  T extends {
    accessLevel: string;
    accountIdentifier: string | null;
    critical: boolean;
    employeeName: string;
    platform: string;
    status: AccessRecordStatus;
  },
>(items: readonly T[], filters: AccessRecordFilters) {
  const query = filters.query?.toLowerCase();

  return items.filter(
    (item) =>
      (!filters.status || filters.status === "all" || item.status === filters.status) &&
      (!filters.critical ||
        filters.critical === "all" ||
        (filters.critical === "critical" ? item.critical : !item.critical)) &&
      (!query ||
        [
          item.platform,
          item.employeeName,
          item.accountIdentifier ?? "",
          item.accessLevel,
        ].some((value) => value.toLowerCase().includes(query))),
  );
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeSearchQuery(value: string | undefined) {
  const normalized = value?.trim();

  return normalized || undefined;
}

function isAccessRecordStatusFilter(value: string | undefined): value is AccessRecordStatus | "all" {
  return Boolean(value && (value === "all" || Object.keys(accessRecordStatusLabels).includes(value)));
}
