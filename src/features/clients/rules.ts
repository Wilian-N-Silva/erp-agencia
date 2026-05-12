import type { AccessContext } from "@/lib/dal";
import { can, canAny } from "@/lib/rbac";

export const clientStatusLabels = {
  active: "Ativo",
  paused: "Pausado",
  cancelled: "Cancelado",
} as const;

export type ClientStatus = keyof typeof clientStatusLabels;
export type ClientListScope = "all" | "owned" | "none";

export type ClientRecord = {
  id: string;
  name: string;
  code: string;
  status: ClientStatus;
  monthlyFee: string;
  billingDay: number;
  internalOwnerEmployeeId: string | null;
  internalOwnerName: string | null;
  billingMethod: string | null;
  startDate: string | null;
  cancellationDate: string | null;
};

export type ClientListItem = Omit<ClientRecord, "monthlyFee"> & {
  monthlyFee: string | null;
  valueHidden: boolean;
};

export type ClientFilters = {
  query?: string;
  status?: ClientStatus | "all";
};

const readClientPermissions = [
  "clients.read",
  "clients.read_limited",
  "clients.configure",
] as const;

export function canReadClients(context: AccessContext) {
  return canAny(readClientPermissions, context);
}

export function canWriteClients(context: AccessContext) {
  return canAny(["clients.write", "clients.configure"], context);
}

export function canReadClientFinancialValues(context: AccessContext) {
  return can("finance.read", context);
}

export function generateClientCode(sequence: number) {
  return `CLI-${String(sequence).padStart(5, "0")}`;
}

export function normalizeClientFilters(input: {
  q?: string | string[];
  query?: string | string[];
  status?: string | string[];
}): ClientFilters {
  const status = firstValue(input.status);
  const query = firstValue(input.q) ?? firstValue(input.query);

  return {
    query: normalizeSearchQuery(query),
    status: isClientStatusFilter(status) ? status : "all",
  };
}

export function applyClientFilters<T extends ClientListItem>(
  clients: readonly T[],
  filters: ClientFilters,
) {
  const query = filters.query?.toLowerCase();

  return clients.filter(
    (client) =>
      (!filters.status || filters.status === "all" || client.status === filters.status) &&
      (!query ||
        [
          client.name,
          client.code,
          client.internalOwnerName ?? "",
          client.billingMethod ?? "",
        ].some((value) => value.toLowerCase().includes(query))),
  );
}

export function getClientListScope(context: AccessContext): ClientListScope {
  if (canAny(["clients.read", "clients.configure"], context)) {
    return "all";
  }

  if (!can("clients.read_limited", context)) {
    return "none";
  }

  return context.roles.includes("leadership") ? "owned" : "all";
}

export function toClientListItem(
  record: ClientRecord,
  context: AccessContext,
): ClientListItem {
  const canReadValues = canReadClientFinancialValues(context);

  return {
    ...record,
    monthlyFee: canReadValues ? record.monthlyFee : null,
    valueHidden: !canReadValues,
  };
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeSearchQuery(value: string | undefined) {
  const normalized = value?.trim();

  return normalized || undefined;
}

function isClientStatusFilter(value: string | undefined): value is ClientStatus | "all" {
  return Boolean(value && (value === "all" || Object.keys(clientStatusLabels).includes(value)));
}
