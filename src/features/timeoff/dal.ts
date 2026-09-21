import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { bindTenantContext, db } from "@/lib/db";
import { areas, employees, timeOffRequests, vacationBalances } from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCanAny } from "@/lib/rbac";

import {
  calculateAvailableBalance,
  calculatePeriodTakenDays,
  canReadVacationBalance,
  getTimeOffScope,
  getVacationBalanceScope,
  isVacationExpired,
  isVacationExpiring,
  canReadTimeOff,
  type TimeOffStatus,
  type TimeOffType,
  type VacationBalanceStatus,
} from "./rules";

export type TimeOffListItem = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeRegistrationNumber: string;
  areaName: string;
  employmentType: string;
  managerEmployeeId: string | null;
  type: TimeOffType | string;
  startDate: string;
  endDate: string;
  businessDays: number;
  soldDays: number;
  status: TimeOffStatus;
  requestedByUserId: string;
  approvedByUserId: string | null;
  notes: string | null;
  createdAt: Date;
};

async function listTimeOffRequests(
  context: AccessContext,
  options: { ownOnly?: boolean; limit?: number } = {},
): Promise<TimeOffListItem[]> {
  assertCanAny(["timeoff.read", "timeoff.write", "timeoff.read_team", "timeoff.read_own"], context);
  const organizationId = requireOrganizationId(context);
  const scope = options.ownOnly ? "own" : getTimeOffScope(context);

  if (scope === "none") {
    return [];
  }

  const rows = await db
    .select({
      id: timeOffRequests.id,
      employeeId: timeOffRequests.employeeId,
      employeeName: employees.fullName,
      employeeRegistrationNumber: employees.registrationNumber,
      areaName: areas.name,
      employmentType: employees.employmentType,
      managerEmployeeId: employees.managerEmployeeId,
      type: timeOffRequests.type,
      startDate: timeOffRequests.startDate,
      endDate: timeOffRequests.endDate,
      businessDays: timeOffRequests.businessDays,
      soldDays: timeOffRequests.soldDays,
      status: timeOffRequests.status,
      requestedByUserId: timeOffRequests.requestedByUserId,
      approvedByUserId: timeOffRequests.approvedByUserId,
      notes: timeOffRequests.notes,
      createdAt: timeOffRequests.createdAt,
    })
    .from(timeOffRequests)
    .innerJoin(employees, eq(timeOffRequests.employeeId, employees.id))
    .innerJoin(areas, eq(employees.areaId, areas.id))
    .where(eq(timeOffRequests.organizationId, organizationId))
    .orderBy(desc(timeOffRequests.startDate), asc(employees.fullName));

  return rows
    .filter((row) => {
      if (scope === "all") {
        return true;
      }

      if (scope === "own") {
        return row.employeeId === context.employeeId;
      }

      return canReadTimeOff(context, {
        employeeId: row.employeeId,
        managerEmployeeId: row.managerEmployeeId,
        status: row.status as TimeOffStatus,
      });
    })
    .slice(0, options.limit)
    .map((row) => ({
      ...row,
      status: row.status as TimeOffStatus,
    }));
}

export type VacationBalanceListItem = {
  id: string;
  employeeId: string;
  employeeName: string;
  employmentType: string;
  managerEmployeeId: string | null;
  periodStart: string;
  periodEnd: string;
  concessionDeadline: string;
  daysAcquired: number;
  daysSold: number;
  daysTaken: number;
  daysAvailable: number;
  status: VacationBalanceStatus;
  expiring: boolean;
  expired: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type VacationBalanceContext = {
  today: string;
};

async function listVacationBalances(
  context: AccessContext,
  options: { employeeId?: string } = {},
): Promise<VacationBalanceListItem[]> {
  assertCanAny(["timeoff.read", "timeoff.write", "timeoff.read_team", "timeoff.read_own"], context);
  const organizationId = requireOrganizationId(context);
  const scope = getVacationBalanceScope(context);

  if (scope === "none") {
    return [];
  }

  const conditions = [
    eq(vacationBalances.organizationId, organizationId),
    isNull(vacationBalances.deletedAt),
  ];

  if (options.employeeId) {
    conditions.push(eq(vacationBalances.employeeId, options.employeeId));
  }

  const rows = await db
    .select({
      id: vacationBalances.id,
      employeeId: vacationBalances.employeeId,
      employeeName: employees.fullName,
      employmentType: employees.employmentType,
      managerEmployeeId: employees.managerEmployeeId,
      periodStart: vacationBalances.periodStart,
      periodEnd: vacationBalances.periodEnd,
      concessionDeadline: vacationBalances.concessionDeadline,
      daysAcquired: vacationBalances.daysAcquired,
      daysSold: vacationBalances.daysSold,
      status: vacationBalances.status,
      notes: vacationBalances.notes,
      createdAt: vacationBalances.createdAt,
      updatedAt: vacationBalances.updatedAt,
    })
    .from(vacationBalances)
    .innerJoin(employees, eq(vacationBalances.employeeId, employees.id))
    .where(and(...conditions))
    .orderBy(asc(employees.fullName), desc(vacationBalances.periodStart));

  const allowedRows = rows.filter((row) =>
    canReadVacationBalance(context, {
      employeeId: row.employeeId,
      managerEmployeeId: row.managerEmployeeId,
      status: row.status as VacationBalanceStatus,
    }),
  );

  if (allowedRows.length === 0) {
    return [];
  }

  const employeeIds = Array.from(new Set(allowedRows.map((row) => row.employeeId)));
  const requestsByEmployee = await loadVacationRequestsByEmployee(organizationId, employeeIds);
  const ctx: VacationBalanceContext = { today: getTodayIso() };

  return allowedRows.map((row) => buildBalanceItem(row, requestsByEmployee.get(row.employeeId) ?? [], ctx));
}

async function getVacationBalanceForWrite(
  context: AccessContext,
  id: string,
): Promise<VacationBalanceListItem> {
  assertCanAny(["timeoff.write"], context);
  const organizationId = requireOrganizationId(context);

  const [row] = await db
    .select({
      id: vacationBalances.id,
      employeeId: vacationBalances.employeeId,
      employeeName: employees.fullName,
      employmentType: employees.employmentType,
      managerEmployeeId: employees.managerEmployeeId,
      periodStart: vacationBalances.periodStart,
      periodEnd: vacationBalances.periodEnd,
      concessionDeadline: vacationBalances.concessionDeadline,
      daysAcquired: vacationBalances.daysAcquired,
      daysSold: vacationBalances.daysSold,
      status: vacationBalances.status,
      notes: vacationBalances.notes,
      createdAt: vacationBalances.createdAt,
      updatedAt: vacationBalances.updatedAt,
    })
    .from(vacationBalances)
    .innerJoin(employees, eq(vacationBalances.employeeId, employees.id))
    .where(
      and(
        eq(vacationBalances.id, id),
        eq(vacationBalances.organizationId, organizationId),
        isNull(vacationBalances.deletedAt),
      ),
    )
    .limit(1);

  if (!row) {
    throw new AccessDeniedError();
  }

  const requests = await loadVacationRequestsByEmployee(organizationId, [row.employeeId]);

  return buildBalanceItem(row, requests.get(row.employeeId) ?? [], { today: getTodayIso() });
}

async function summarizeEmployeeVacation(
  context: AccessContext,
  employeeId: string,
): Promise<{ current: VacationBalanceListItem | null; history: VacationBalanceListItem[] }> {
  const balances = await listVacationBalances(context, { employeeId });
  const active = balances.find((balance) => balance.status === "active") ?? null;
  const history = balances.filter((balance) => balance !== active);

  return { current: active, history };
}

async function loadVacationRequestsByEmployee(
  organizationId: string,
  employeeIds: readonly string[],
) {
  const map = new Map<string, { startDate: string; endDate: string; status: TimeOffStatus; type: string }[]>();

  if (employeeIds.length === 0) {
    return map;
  }

  const rows = await db
    .select({
      employeeId: timeOffRequests.employeeId,
      startDate: timeOffRequests.startDate,
      endDate: timeOffRequests.endDate,
      status: timeOffRequests.status,
      type: timeOffRequests.type,
    })
    .from(timeOffRequests)
    .where(eq(timeOffRequests.organizationId, organizationId));

  for (const row of rows) {
    if (!employeeIds.includes(row.employeeId)) {
      continue;
    }

    const list = map.get(row.employeeId) ?? [];

    list.push({
      startDate: row.startDate,
      endDate: row.endDate,
      status: row.status as TimeOffStatus,
      type: row.type,
    });
    map.set(row.employeeId, list);
  }

  return map;
}

function buildBalanceItem(
  row: {
    id: string;
    employeeId: string;
    employeeName: string;
    employmentType: string;
    managerEmployeeId: string | null;
    periodStart: string;
    periodEnd: string;
    concessionDeadline: string;
    daysAcquired: number;
    daysSold: number;
    status: string;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
  requests: readonly { startDate: string; endDate: string; status: TimeOffStatus; type: string }[],
  ctx: VacationBalanceContext,
): VacationBalanceListItem {
  const daysTaken = calculatePeriodTakenDays(
    { periodStart: row.periodStart, concessionDeadline: row.concessionDeadline },
    requests,
  );
  const daysAvailable = calculateAvailableBalance({
    daysAcquired: row.daysAcquired,
    daysSold: row.daysSold,
    daysTaken,
  });

  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    employmentType: row.employmentType,
    managerEmployeeId: row.managerEmployeeId,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    concessionDeadline: row.concessionDeadline,
    daysAcquired: row.daysAcquired,
    daysSold: row.daysSold,
    daysTaken,
    daysAvailable,
    status: row.status as VacationBalanceStatus,
    expiring: isVacationExpiring({ concessionDeadline: row.concessionDeadline, today: ctx.today }),
    expired: isVacationExpired({
      concessionDeadline: row.concessionDeadline,
      availableBalance: daysAvailable,
      today: ctx.today,
    }),
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function getTodayIso() {
  return new Date().toISOString().slice(0, 10);
}

function requireOrganizationId(context: AccessContext) {
  if (!context.organizationId) {
    throw new AccessDeniedError();
  }

  return context.organizationId;
}

export {
  tenantListTimeOffRequests as listTimeOffRequests,
  tenantListVacationBalances as listVacationBalances,
  tenantGetVacationBalanceForWrite as getVacationBalanceForWrite,
  tenantSummarizeEmployeeVacation as summarizeEmployeeVacation,
};

const tenantListTimeOffRequests = bindTenantContext(listTimeOffRequests);
const tenantListVacationBalances = bindTenantContext(listVacationBalances);
const tenantGetVacationBalanceForWrite = bindTenantContext(getVacationBalanceForWrite);
const tenantSummarizeEmployeeVacation = bindTenantContext(summarizeEmployeeVacation);
