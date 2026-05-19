import type { AccessContext, EmployeeScopeTarget } from "@/lib/dal";
import { canReadEmployeeTarget } from "@/lib/dal";
import { can, canAny } from "@/lib/rbac";

import { centsToMoney, moneyToCents, toDateKey } from "@/features/finance/rules";

export const employeeStatusLabels = {
  active: "Ativo",
  on_vacation: "Em ferias",
  away: "Afastado",
  notice: "Em aviso",
  terminated: "Desligado",
  paused: "Pausado",
  occasional_freelancer: "Freelancer eventual",
} as const;

export const employmentTypeLabels = {
  clt: "CLT",
  pj: "PJ",
  intern: "Estagio",
  freelancer: "Freelancer",
  partner: "Socio",
  temporary: "Temporario",
  other: "Outro",
} as const;

export type EmployeeStatus = keyof typeof employeeStatusLabels;
export type EmploymentType = keyof typeof employmentTypeLabels;
export type PeopleListScope = "all" | "team" | "own" | "none";

export type EmployeeListRecord = EmployeeScopeTarget & {
  id: string;
  registrationNumber: string;
  fullName: string;
  socialName: string | null;
  corporateEmail: string | null;
  areaId: string;
  positionName: string;
  positionId: string;
  areaName: string;
  employmentType: EmploymentType;
  status: EmployeeStatus;
  startDate: string | Date;
  currentCompensation: string;
  recurringCostAllowance: string | null;
  recurringTransport: string | null;
};

export type EmployeeListItem = Omit<
  EmployeeListRecord,
  "currentCompensation" | "recurringCostAllowance" | "recurringTransport"
> & {
  currentCompensation: string | null;
  recurringCostAllowance: string | null;
  recurringTransport: string | null;
  compensationHidden: boolean;
  tenureMonths: number;
};

export type PeopleFilters = {
  areaId?: string;
  positionId?: string;
  query?: string;
  status?: EmployeeStatus | "all";
};

export function canReadPeople(context: AccessContext) {
  return canAny(["people.read", "people.read_team", "people.read_own", "people.configure"], context);
}

export function canWritePeople(context: AccessContext) {
  return canAny(["people.write", "people.configure"], context);
}

export function canReadEmployeeSensitiveProfile(context: AccessContext) {
  return canAny(["people.write", "people.configure"], context) || context.roles.includes("director");
}

export function canReadCompensationForTarget(
  context: AccessContext,
  target: EmployeeScopeTarget,
) {
  if (canAny(["compensation.read", "compensation.write"], context)) {
    return true;
  }

  return can("compensation.read_own", context) && context.employeeId === target.employeeId;
}

export function canWriteCompensation(context: AccessContext) {
  return can("compensation.write", context);
}

export function getPeopleListScope(context: AccessContext): PeopleListScope {
  if (canAny(["people.read", "people.configure"], context)) {
    return "all";
  }

  if (can("people.read_team", context)) {
    return context.employeeId ? "team" : "none";
  }

  if (can("people.read_own", context)) {
    return context.employeeId ? "own" : "none";
  }

  return "none";
}

export function canReadEmployeeRecord(
  context: AccessContext,
  target: EmployeeScopeTarget,
) {
  return canAny(["people.read", "people.configure"], context) || canReadEmployeeTarget(context, target);
}

export function generateRegistrationNumber(sequence: number) {
  return `FG-${String(sequence).padStart(5, "0")}`;
}

export function getNextRegistrationNumber(existingRegistrationNumbers: readonly string[]) {
  const maxSequence = existingRegistrationNumbers.reduce((max, registrationNumber) => {
    const match = /^FG-(\d{5})$/.exec(registrationNumber);

    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);

  return generateRegistrationNumber(maxSequence + 1);
}

export function getTenureMonths(startDate: string | Date, asOf: string | Date = new Date()) {
  const startKey = toDateKey(startDate);
  const asOfKey = toDateKey(asOf);
  const [startYear, startMonth, startDay] = startKey.split("-").map(Number);
  const [asOfYear, asOfMonth, asOfDay] = asOfKey.split("-").map(Number);
  const monthDelta = (asOfYear - startYear) * 12 + (asOfMonth - startMonth);

  return Math.max(monthDelta - (asOfDay < startDay ? 1 : 0), 0);
}

export function getCompensationDifference(previousAmount: string, newAmount: string) {
  return centsToMoney(moneyToCents(newAmount) - moneyToCents(previousAmount));
}

export function isBenefitActive(benefit: {
  recurring: boolean;
  status: string;
  endDate?: string | Date | null;
}, asOf: string | Date = new Date()) {
  return (
    benefit.recurring &&
    benefit.status === "active" &&
    (!benefit.endDate || toDateKey(benefit.endDate) >= toDateKey(asOf))
  );
}

export function toEmployeeListItem(
  record: EmployeeListRecord,
  context: AccessContext,
  asOf: string | Date = new Date(),
): EmployeeListItem {
  const canReadCompensation = canReadCompensationForTarget(context, {
    employeeId: record.id,
    managerEmployeeId: record.managerEmployeeId,
  });

  return {
    ...record,
    currentCompensation: canReadCompensation ? record.currentCompensation : null,
    recurringCostAllowance: canReadCompensation ? record.recurringCostAllowance : null,
    recurringTransport: canReadCompensation ? record.recurringTransport : null,
    compensationHidden: !canReadCompensation,
    tenureMonths: getTenureMonths(record.startDate, asOf),
  };
}

export function normalizePeopleFilters(input: {
  areaId?: string | string[];
  positionId?: string | string[];
  q?: string | string[];
  query?: string | string[];
  status?: string | string[];
}): PeopleFilters {
  const areaId = firstValue(input.areaId);
  const positionId = firstValue(input.positionId);
  const query = firstValue(input.q) ?? firstValue(input.query);
  const status = firstValue(input.status);

  return {
    areaId: isUuid(areaId) ? areaId : undefined,
    positionId: isUuid(positionId) ? positionId : undefined,
    query: normalizeSearchQuery(query),
    status: isEmployeeStatusFilter(status) ? status : "all",
  };
}

export function applyPeopleFilters<T extends EmployeeListItem>(
  employees: readonly T[],
  filters: PeopleFilters,
) {
  const query = filters.query?.toLowerCase();

  return employees.filter(
    (employee) =>
      (!filters.areaId || employee.areaId === filters.areaId) &&
      (!filters.positionId || employee.positionId === filters.positionId) &&
      (!filters.status || filters.status === "all" || employee.status === filters.status) &&
      (!query ||
        [
          employee.fullName,
          employee.socialName ?? "",
          employee.registrationNumber,
          employee.corporateEmail ?? "",
          employee.positionName,
          employee.areaName,
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

function isEmployeeStatusFilter(value: string | undefined): value is EmployeeStatus | "all" {
  return Boolean(value && (value === "all" || Object.keys(employeeStatusLabels).includes(value)));
}

function isUuid(value: string | undefined) {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      ),
  );
}
