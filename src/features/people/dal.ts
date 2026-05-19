import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { canReadAuditLogs } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  areas,
  auditLogs,
  compensationHistory,
  employeeBenefits,
  employees,
  positions,
  users,
} from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCanAny } from "@/lib/rbac";

import {
  applyPeopleFilters,
  canReadCompensationForTarget,
  canReadEmployeeRecord,
  canReadEmployeeSensitiveProfile,
  getPeopleListScope,
  isBenefitActive,
  toEmployeeListItem,
  type EmployeeListItem,
  type EmployeeStatus,
  type EmploymentType,
  type PeopleFilters,
} from "./rules";

export type PeopleOption = {
  id: string;
  name: string;
};

export type EmployeeDetail = EmployeeListItem & {
  userId: string | null;
  personalEmail: string | null;
  phone: string | null;
  cpf: string | null;
  rg: string | null;
  birthDate: string | null;
  address: string | null;
  pix: string | null;
  emergencyContact: string | null;
  workModel: string | null;
  location: string | null;
  endDate: string | null;
  internalNotes: string | null;
  sensitiveProfileHidden: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type CompensationHistoryItem = {
  id: string;
  previousAmount: string | null;
  newAmount: string | null;
  differenceAmount: string | null;
  effectiveDate: string;
  reason: string;
  approvedByName: string | null;
  createdByName: string | null;
  createdAt: Date;
  compensationHidden: boolean;
};

export type EmployeeBenefitItem = {
  id: string;
  benefitType: string;
  name: string;
  amount: string | null;
  recurring: boolean;
  startDate: string;
  endDate: string | null;
  status: string;
  notes: string | null;
  activeForComposition: boolean;
  compensationHidden: boolean;
};

export type EmployeeAuditLogItem = {
  id: string;
  action: string;
  actorName: string | null;
  actorEmail: string | null;
  metadata: unknown;
  createdAt: Date;
};

export async function listEmployees(
  context: AccessContext,
  filters: PeopleFilters = {},
): Promise<EmployeeListItem[]> {
  assertCanAny(["people.read", "people.read_team", "people.read_own", "people.configure"], context);
  const organizationId = requireOrganizationId(context);
  const scope = getPeopleListScope(context);

  if (scope === "none") {
    return [];
  }

  const rows = await db
    .select({
      id: employees.id,
      userId: employees.userId,
      registrationNumber: employees.registrationNumber,
      fullName: employees.fullName,
      socialName: employees.socialName,
      corporateEmail: employees.corporateEmail,
      positionId: employees.positionId,
      positionName: positions.name,
      areaId: employees.areaId,
      areaName: areas.name,
      managerEmployeeId: employees.managerEmployeeId,
      employmentType: employees.employmentType,
      startDate: employees.startDate,
      status: employees.status,
      currentCompensation: employees.currentCompensation,
      recurringCostAllowance: employees.recurringCostAllowance,
      recurringTransport: employees.recurringTransport,
    })
    .from(employees)
    .innerJoin(positions, eq(employees.positionId, positions.id))
    .innerJoin(areas, eq(employees.areaId, areas.id))
    .where(and(eq(employees.organizationId, organizationId), isNull(employees.deletedAt)))
    .orderBy(asc(employees.fullName));
  const scopedRows = rows.filter((row) => {
    if (scope === "all") {
      return true;
    }

    if (scope === "team") {
      return row.managerEmployeeId === context.employeeId;
    }

    return row.id === context.employeeId;
  });

  return applyPeopleFilters(
    scopedRows.map((row) =>
      toEmployeeListItem(
        {
          ...row,
          employeeId: row.id,
          employmentType: row.employmentType as EmploymentType,
          status: row.status as EmployeeStatus,
        },
        context,
      ),
    ),
    filters,
  );
}

export async function getEmployeeDetail(
  context: AccessContext,
  id: string,
): Promise<EmployeeDetail | null> {
  assertCanAny(["people.read", "people.read_team", "people.read_own", "people.configure"], context);
  const organizationId = requireOrganizationId(context);
  const [row] = await db
    .select({
      id: employees.id,
      userId: employees.userId,
      registrationNumber: employees.registrationNumber,
      fullName: employees.fullName,
      socialName: employees.socialName,
      corporateEmail: employees.corporateEmail,
      personalEmail: employees.personalEmail,
      phone: employees.phone,
      cpf: employees.cpf,
      rg: employees.rg,
      birthDate: employees.birthDate,
      address: employees.address,
      pix: employees.pix,
      emergencyContact: employees.emergencyContact,
      positionId: employees.positionId,
      positionName: positions.name,
      areaId: employees.areaId,
      areaName: areas.name,
      managerEmployeeId: employees.managerEmployeeId,
      employmentType: employees.employmentType,
      startDate: employees.startDate,
      endDate: employees.endDate,
      status: employees.status,
      workModel: employees.workModel,
      location: employees.location,
      currentCompensation: employees.currentCompensation,
      recurringCostAllowance: employees.recurringCostAllowance,
      recurringTransport: employees.recurringTransport,
      internalNotes: employees.internalNotes,
      createdAt: employees.createdAt,
      updatedAt: employees.updatedAt,
    })
    .from(employees)
    .innerJoin(positions, eq(employees.positionId, positions.id))
    .innerJoin(areas, eq(employees.areaId, areas.id))
    .where(
      and(
        eq(employees.id, id),
        eq(employees.organizationId, organizationId),
        isNull(employees.deletedAt),
      ),
    )
    .limit(1);

  if (!row || !canReadEmployeeRecord(context, { employeeId: row.id, managerEmployeeId: row.managerEmployeeId })) {
    return null;
  }

  const listItem = toEmployeeListItem(
    {
      ...row,
      employeeId: row.id,
      employmentType: row.employmentType as EmploymentType,
      status: row.status as EmployeeStatus,
    },
    context,
  );
  const sensitiveProfileHidden = !canReadEmployeeSensitiveProfile(context) && context.employeeId !== row.id;

  return {
    ...listItem,
    userId: row.userId,
    personalEmail: sensitiveProfileHidden ? null : row.personalEmail,
    phone: sensitiveProfileHidden ? null : row.phone,
    cpf: sensitiveProfileHidden ? null : row.cpf,
    rg: sensitiveProfileHidden ? null : row.rg,
    birthDate: sensitiveProfileHidden ? null : row.birthDate,
    address: sensitiveProfileHidden ? null : row.address,
    pix: sensitiveProfileHidden ? null : row.pix,
    emergencyContact: sensitiveProfileHidden ? null : row.emergencyContact,
    workModel: row.workModel,
    location: row.location,
    endDate: row.endDate,
    internalNotes: sensitiveProfileHidden ? null : row.internalNotes,
    sensitiveProfileHidden,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listCompensationHistory(
  context: AccessContext,
  employeeId: string,
): Promise<CompensationHistoryItem[]> {
  const employee = await getEmployeeDetail(context, employeeId);

  if (!employee) {
    return [];
  }

  const canReadCompensation = canReadCompensationForTarget(context, {
    employeeId,
    managerEmployeeId: employee.managerEmployeeId,
  });

  if (!canReadCompensation) {
    return [];
  }

  const organizationId = requireOrganizationId(context);
  const rows = await db
    .select({
      id: compensationHistory.id,
      previousAmount: compensationHistory.previousAmount,
      newAmount: compensationHistory.newAmount,
      differenceAmount: compensationHistory.differenceAmount,
      effectiveDate: compensationHistory.effectiveDate,
      reason: compensationHistory.reason,
      approvedByName: users.name,
      createdByName: users.name,
      createdAt: compensationHistory.createdAt,
    })
    .from(compensationHistory)
    .leftJoin(users, eq(compensationHistory.approvedByUserId, users.id))
    .where(
      and(
        eq(compensationHistory.organizationId, organizationId),
        eq(compensationHistory.employeeId, employeeId),
      ),
    )
    .orderBy(desc(compensationHistory.effectiveDate), desc(compensationHistory.createdAt));

  return rows.map((row) => ({
    ...row,
    compensationHidden: false,
  }));
}

export async function listEmployeeBenefits(
  context: AccessContext,
  employeeId: string,
): Promise<EmployeeBenefitItem[]> {
  const employee = await getEmployeeDetail(context, employeeId);

  if (!employee) {
    return [];
  }

  const canReadCompensation = canReadCompensationForTarget(context, {
    employeeId,
    managerEmployeeId: employee.managerEmployeeId,
  });

  if (!canReadCompensation) {
    return [];
  }

  const organizationId = requireOrganizationId(context);
  const rows = await db
    .select({
      id: employeeBenefits.id,
      benefitType: employeeBenefits.benefitType,
      name: employeeBenefits.name,
      amount: employeeBenefits.amount,
      recurring: employeeBenefits.recurring,
      startDate: employeeBenefits.startDate,
      endDate: employeeBenefits.endDate,
      status: employeeBenefits.status,
      notes: employeeBenefits.notes,
    })
    .from(employeeBenefits)
    .where(
      and(
        eq(employeeBenefits.organizationId, organizationId),
        eq(employeeBenefits.employeeId, employeeId),
        isNull(employeeBenefits.deletedAt),
      ),
    )
    .orderBy(desc(employeeBenefits.startDate), asc(employeeBenefits.name));

  return rows.map((row) => ({
    ...row,
    activeForComposition: isBenefitActive(row),
    compensationHidden: false,
  }));
}

export async function listPeopleOptions(context: AccessContext): Promise<{
  areas: PeopleOption[];
  managers: PeopleOption[];
  positions: PeopleOption[];
}> {
  assertCanAny(["people.write", "people.configure"], context);
  const organizationId = requireOrganizationId(context);
  const [areaRows, positionRows, managerRows] = await Promise.all([
    db
      .select({ id: areas.id, name: areas.name })
      .from(areas)
      .where(eq(areas.organizationId, organizationId))
      .orderBy(asc(areas.name)),
    db
      .select({ id: positions.id, name: positions.name })
      .from(positions)
      .where(eq(positions.organizationId, organizationId))
      .orderBy(asc(positions.name)),
    db
      .select({ id: employees.id, name: employees.fullName })
      .from(employees)
      .where(and(eq(employees.organizationId, organizationId), isNull(employees.deletedAt)))
      .orderBy(asc(employees.fullName)),
  ]);

  return {
    areas: areaRows,
    managers: managerRows,
    positions: positionRows,
  };
}

export async function listPeopleFilterOptions(context: AccessContext): Promise<{
  areas: PeopleOption[];
  positions: PeopleOption[];
}> {
  assertCanAny(["people.read", "people.read_team", "people.read_own", "people.configure"], context);
  const organizationId = requireOrganizationId(context);
  const [areaRows, positionRows] = await Promise.all([
    db
      .select({ id: areas.id, name: areas.name })
      .from(areas)
      .where(eq(areas.organizationId, organizationId))
      .orderBy(asc(areas.name)),
    db
      .select({ id: positions.id, name: positions.name })
      .from(positions)
      .where(eq(positions.organizationId, organizationId))
      .orderBy(asc(positions.name)),
  ]);

  return {
    areas: areaRows,
    positions: positionRows,
  };
}

export async function listEmployeeAuditLogs(
  context: AccessContext,
  employeeId: string,
  options: { limit?: number } = {},
): Promise<EmployeeAuditLogItem[]> {
  if (!canReadAuditLogs(context)) {
    return [];
  }

  const organizationId = requireOrganizationId(context);

  return db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      actorName: users.name,
      actorEmail: users.email,
      metadata: auditLogs.metadata,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorUserId, users.id))
    .where(
      and(
        eq(auditLogs.organizationId, organizationId),
        eq(auditLogs.entityType, "employee"),
        eq(auditLogs.entityId, employeeId),
      ),
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(options.limit ?? 10);
}

function requireOrganizationId(context: AccessContext) {
  if (!context.organizationId) {
    throw new AccessDeniedError();
  }

  return context.organizationId;
}
