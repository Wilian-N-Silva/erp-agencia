import type { AccessContext } from "@/lib/dal";
import { can, canAny } from "@/lib/rbac";

import { addDaysToDateKey, toDateKey } from "@/features/finance/rules";

export const saasSubscriptionStatusLabels = {
  active: "Ativa",
  trial: "Em teste",
  suspended: "Suspensa",
  cancelled: "Cancelada",
  renewing: "Em renovacao",
  cancel_scheduled: "A cancelar",
} as const;

export const saasUserStatusLabels = {
  active: "Ativo",
  inactive: "Inativo",
} as const;

export type SaasSubscriptionStatus = keyof typeof saasSubscriptionStatusLabels;
export type SaasUserStatus = keyof typeof saasUserStatusLabels;
export type SaasScope = "all" | "linked" | "none";

export type SaasSubscriptionTarget = {
  linkedEmployeeIds: readonly string[];
  linkedManagerEmployeeIds: readonly (string | null)[];
  renewalDate?: string | Date | null;
  status: SaasSubscriptionStatus;
};

export type SaasSubscriptionFilters = {
  query?: string;
  status?: SaasSubscriptionStatus | "all";
};

export function canReadSaasSubscription(context: AccessContext, target: SaasSubscriptionTarget) {
  if (canAny(["saas.read", "saas.write", "saas.configure"], context)) {
    return true;
  }

  if (!can("saas.read_linked", context) || !context.employeeId) {
    return false;
  }

  return (
    target.linkedEmployeeIds.includes(context.employeeId) ||
    (context.roles.includes("leadership") &&
      target.linkedManagerEmployeeIds.includes(context.employeeId))
  );
}

export function canWriteSaasSubscriptions(context: AccessContext) {
  return canAny(["saas.write", "saas.configure"], context);
}

export function canReadSaasCost(context: AccessContext) {
  return can("finance.read", context);
}

export function getSaasScope(context: AccessContext): SaasScope {
  if (canAny(["saas.read", "saas.write", "saas.configure"], context)) {
    return "all";
  }

  return can("saas.read_linked", context) && context.employeeId ? "linked" : "none";
}

export function getSaasRenewalState(
  target: Pick<SaasSubscriptionTarget, "renewalDate" | "status">,
  asOf: string | Date = new Date(),
  renewalWindowDays = 30,
) {
  if (!target.renewalDate || target.status === "cancelled" || target.status === "suspended") {
    return "none" as const;
  }

  const renewalDate = toDateKey(target.renewalDate);
  const asOfKey = toDateKey(asOf);

  if (renewalDate < asOfKey) {
    return "overdue" as const;
  }

  if (renewalDate <= addDaysToDateKey(asOfKey, renewalWindowDays)) {
    return "due_soon" as const;
  }

  return "ok" as const;
}

export function isSaasRenewalAlert(
  target: Pick<SaasSubscriptionTarget, "renewalDate" | "status">,
  asOf: string | Date = new Date(),
) {
  return ["overdue", "due_soon"].includes(getSaasRenewalState(target, asOf));
}

export function normalizeSaasSubscriptionFilters(input: {
  q?: string | string[];
  query?: string | string[];
  status?: string | string[];
}): SaasSubscriptionFilters {
  const query = firstValue(input.q) ?? firstValue(input.query);
  const status = firstValue(input.status);

  return {
    query: normalizeSearchQuery(query),
    status: isSaasStatusFilter(status) ? status : "all",
  };
}

export function applySaasSubscriptionFilters<
  T extends {
    category: string;
    name: string;
    provider: string | null;
    status: SaasSubscriptionStatus;
  },
>(items: readonly T[], filters: SaasSubscriptionFilters) {
  const query = filters.query?.toLowerCase();

  return items.filter(
    (item) =>
      (!filters.status || filters.status === "all" || item.status === filters.status) &&
      (!query ||
        [item.name, item.category, item.provider ?? ""].some((value) =>
          value.toLowerCase().includes(query),
        )),
  );
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeSearchQuery(value: string | undefined) {
  const normalized = value?.trim();

  return normalized || undefined;
}

function isSaasStatusFilter(value: string | undefined): value is SaasSubscriptionStatus | "all" {
  return Boolean(value && (value === "all" || Object.keys(saasSubscriptionStatusLabels).includes(value)));
}
