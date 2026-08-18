import { and, asc, eq, isNull } from "drizzle-orm";

import { bindTenantContext, db } from "@/lib/db";
import { employees, equipment } from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCanAny } from "@/lib/rbac";

import {
  applyEquipmentFilters,
  canReadEquipment,
  getEquipmentScope,
  isEquipmentReturnAlert,
  type EquipmentFilters,
  type EquipmentStatus,
} from "./rules";

export type EquipmentListItem = {
  id: string;
  assetNumber: string;
  type: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  status: EquipmentStatus;
  currentEmployeeId: string | null;
  currentEmployeeName: string | null;
  currentEmployeeManagerId: string | null;
  currentEmployeeStatus: string | null;
  notes: string | null;
  returnAlert: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type EquipmentEmployeeOption = {
  id: string;
  name: string;
};

async function listEquipment(
  context: AccessContext,
  filters: EquipmentFilters = {},
  options: { limit?: number; ownOnly?: boolean } = {},
): Promise<EquipmentListItem[]> {
  assertCanAny(
    ["equipment.read", "equipment.write", "equipment.configure", "equipment.read_team", "equipment.read_own"],
    context,
  );
  const organizationId = requireOrganizationId(context);
  const scope = options.ownOnly ? "own" : getEquipmentScope(context);

  if (scope === "none") {
    return [];
  }

  const rows = await db
    .select({
      id: equipment.id,
      assetNumber: equipment.assetNumber,
      type: equipment.type,
      brand: equipment.brand,
      model: equipment.model,
      serialNumber: equipment.serialNumber,
      status: equipment.status,
      currentEmployeeId: equipment.currentEmployeeId,
      currentEmployeeName: employees.fullName,
      currentEmployeeManagerId: employees.managerEmployeeId,
      currentEmployeeStatus: employees.status,
      notes: equipment.notes,
      createdAt: equipment.createdAt,
      updatedAt: equipment.updatedAt,
    })
    .from(equipment)
    .leftJoin(employees, eq(equipment.currentEmployeeId, employees.id))
    .where(and(eq(equipment.organizationId, organizationId), isNull(equipment.deletedAt)))
    .orderBy(asc(equipment.assetNumber));

  const scopedRows = rows.filter((row) => {
    const target = {
      currentEmployeeId: row.currentEmployeeId,
      currentEmployeeManagerId: row.currentEmployeeManagerId,
      currentEmployeeStatus: row.currentEmployeeStatus,
      status: row.status as EquipmentStatus,
    };

    if (scope === "all") {
      return true;
    }

    return canReadEquipment(context, target);
  });

  return applyEquipmentFilters(
    scopedRows.map((row) => ({
      ...row,
      status: row.status as EquipmentStatus,
      returnAlert: isEquipmentReturnAlert({
        currentEmployeeId: row.currentEmployeeId,
        currentEmployeeManagerId: row.currentEmployeeManagerId,
        currentEmployeeStatus: row.currentEmployeeStatus,
        status: row.status as EquipmentStatus,
      }),
    })),
    filters,
  ).slice(0, options.limit);
}

async function listEquipmentEmployeeOptions(
  context: AccessContext,
): Promise<EquipmentEmployeeOption[]> {
  assertCanAny(["equipment.write", "equipment.configure"], context);
  const organizationId = requireOrganizationId(context);

  return db
    .select({
      id: employees.id,
      name: employees.fullName,
    })
    .from(employees)
    .where(and(eq(employees.organizationId, organizationId), isNull(employees.deletedAt)))
    .orderBy(asc(employees.fullName));
}

async function listEquipmentReturnAlerts(
  context: AccessContext,
  options: { limit?: number } = {},
) {
  const items = await listEquipment(context);

  return items.filter((item) => item.returnAlert).slice(0, options.limit);
}

function requireOrganizationId(context: AccessContext) {
  if (!context.organizationId) {
    throw new AccessDeniedError();
  }

  return context.organizationId;
}

export {
  tenantListEquipment as listEquipment,
  tenantListEquipmentEmployeeOptions as listEquipmentEmployeeOptions,
  tenantListEquipmentReturnAlerts as listEquipmentReturnAlerts,
};

const tenantListEquipment = bindTenantContext(listEquipment);
const tenantListEquipmentEmployeeOptions = bindTenantContext(listEquipmentEmployeeOptions);
const tenantListEquipmentReturnAlerts = bindTenantContext(listEquipmentReturnAlerts);
