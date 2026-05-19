import type { AccessContext } from "@/lib/dal";
import { can, canAny } from "@/lib/rbac";

export const equipmentStatusLabels = {
  available: "Disponivel",
  in_use: "Em uso",
  reserved: "Reservado",
  maintenance: "Manutencao",
  lost: "Perdido",
  damaged: "Danificado",
  retired: "Descartado",
  pending_return: "Pendente de devolucao",
} as const;

export type EquipmentStatus = keyof typeof equipmentStatusLabels;
export type EquipmentScope = "all" | "team" | "own" | "none";

export type EquipmentTarget = {
  currentEmployeeId: string | null;
  currentEmployeeManagerId?: string | null;
  currentEmployeeStatus?: string | null;
  status: EquipmentStatus;
};

export type EquipmentListItemBase = EquipmentTarget & {
  assetNumber: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  type: string;
};

export type EquipmentFilters = {
  query?: string;
  status?: EquipmentStatus | "all";
};

export function canReadEquipment(context: AccessContext, target: EquipmentTarget) {
  if (canAny(["equipment.read", "equipment.write", "equipment.configure"], context)) {
    return true;
  }

  if (
    can("equipment.read_team", context) &&
    context.employeeId &&
    target.currentEmployeeManagerId === context.employeeId
  ) {
    return true;
  }

  return Boolean(
    can("equipment.read_own", context) &&
      context.employeeId &&
      target.currentEmployeeId === context.employeeId,
  );
}

export function canWriteEquipment(context: AccessContext) {
  return canAny(["equipment.write", "equipment.configure"], context);
}

export function getEquipmentScope(context: AccessContext): EquipmentScope {
  if (canAny(["equipment.read", "equipment.write", "equipment.configure"], context)) {
    return "all";
  }

  if (can("equipment.read_team", context)) {
    return context.employeeId ? "team" : "none";
  }

  if (can("equipment.read_own", context)) {
    return context.employeeId ? "own" : "none";
  }

  return "none";
}

export function generateEquipmentAssetNumber(sequence: number) {
  return `EQ-${String(sequence).padStart(5, "0")}`;
}

export function getNextEquipmentAssetNumber(existingAssetNumbers: readonly string[]) {
  const maxSequence = existingAssetNumbers.reduce((max, assetNumber) => {
    const match = /^EQ-(\d{5})$/.exec(assetNumber);

    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);

  return generateEquipmentAssetNumber(maxSequence + 1);
}

export function equipmentStatusRequiresEmployee(status: EquipmentStatus) {
  return status === "in_use" || status === "pending_return";
}

export function canAssignEquipmentStatus(status: EquipmentStatus) {
  return status !== "retired";
}

export function canReturnEquipment(target: EquipmentTarget) {
  return Boolean(
    target.currentEmployeeId &&
      (target.status === "in_use" || target.status === "pending_return"),
  );
}

export function isEquipmentReturnAlert(target: EquipmentTarget) {
  return (
    target.status === "pending_return" ||
    Boolean(target.currentEmployeeId && target.currentEmployeeStatus === "terminated")
  );
}

export function normalizeEquipmentFilters(input: {
  q?: string | string[];
  query?: string | string[];
  status?: string | string[];
}): EquipmentFilters {
  const query = firstValue(input.q) ?? firstValue(input.query);
  const status = firstValue(input.status);

  return {
    query: normalizeSearchQuery(query),
    status: isEquipmentStatusFilter(status) ? status : "all",
  };
}

export function applyEquipmentFilters<T extends EquipmentListItemBase>(
  items: readonly T[],
  filters: EquipmentFilters,
) {
  const query = filters.query?.toLowerCase();

  return items.filter(
    (item) =>
      (!filters.status || filters.status === "all" || item.status === filters.status) &&
      (!query ||
        [
          item.assetNumber,
          item.type,
          item.brand ?? "",
          item.model ?? "",
          item.serialNumber ?? "",
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

function isEquipmentStatusFilter(value: string | undefined): value is EquipmentStatus | "all" {
  return Boolean(value && (value === "all" || Object.keys(equipmentStatusLabels).includes(value)));
}
