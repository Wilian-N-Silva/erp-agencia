import type { AccessContext, EmployeeScopeTarget } from "@/lib/dal";
import { canReadEmployeeTarget } from "@/lib/dal";
import { can, canAny } from "@/lib/rbac";

import { toDateKey } from "@/features/finance/rules";

export const timeOffStatusLabels = {
  requested: "Solicitada",
  approved: "Aprovada",
  rejected: "Recusada",
  cancelled: "Cancelada",
} as const;

export const timeOffTypeLabels = {
  vacation: "Ferias",
  planned_pause: "Pausa programada",
  absence: "Ausencia programada",
} as const;

export type TimeOffStatus = keyof typeof timeOffStatusLabels;
export type TimeOffType = keyof typeof timeOffTypeLabels;
export type TimeOffScope = "all" | "team" | "own" | "none";

export type TimeOffTarget = EmployeeScopeTarget & {
  status: TimeOffStatus;
};

export function getTimeOffScope(context: AccessContext): TimeOffScope {
  if (canAny(["timeoff.read", "timeoff.write"], context)) {
    return "all";
  }

  if (can("timeoff.read_team", context)) {
    return context.employeeId ? "team" : "none";
  }

  if (can("timeoff.read_own", context)) {
    return context.employeeId ? "own" : "none";
  }

  return "none";
}

export function canReadTimeOff(context: AccessContext, target: TimeOffTarget) {
  if (getTimeOffScope(context) === "all") {
    return true;
  }

  return canReadEmployeeTarget(context, target);
}

export function canCreateOwnTimeOff(context: AccessContext) {
  return can("timeoff.read_own", context) && Boolean(context.employeeId);
}

export function canApproveTimeOff(context: AccessContext, target: TimeOffTarget) {
  if (target.status !== "requested") {
    return false;
  }

  if (can("timeoff.write", context)) {
    return true;
  }

  return (
    can("timeoff.read_team", context) &&
    Boolean(context.employeeId && target.managerEmployeeId === context.employeeId)
  );
}

export function calculateCalendarDays(startDate: string | Date, endDate: string | Date) {
  const start = new Date(`${toDateKey(startDate)}T00:00:00.000Z`);
  const end = new Date(`${toDateKey(endDate)}T00:00:00.000Z`);
  const diff = end.getTime() - start.getTime();

  if (diff < 0) {
    throw new Error("End date must be after start date.");
  }

  return Math.floor(diff / 86_400_000) + 1;
}

export function calculateBusinessDays(startDate: string | Date, endDate: string | Date) {
  const start = new Date(`${toDateKey(startDate)}T00:00:00.000Z`);
  const totalDays = calculateCalendarDays(startDate, endDate);
  let businessDays = 0;

  for (let index = 0; index < totalDays; index += 1) {
    const current = new Date(start);

    current.setUTCDate(start.getUTCDate() + index);

    const day = current.getUTCDay();

    if (day !== 0 && day !== 6) {
      businessDays += 1;
    }
  }

  return businessDays;
}

export function getTimeOffDisplayType(employmentType: string, requestedType: TimeOffType) {
  if (employmentType === "clt") {
    return requestedType === "vacation" ? "Ferias" : timeOffTypeLabels[requestedType];
  }

  return requestedType === "vacation" ? "Pausa programada" : timeOffTypeLabels[requestedType];
}

export const vacationBalanceStatusLabels = {
  active: "Em vigencia",
  closed: "Encerrado",
} as const;

export type VacationBalanceStatus = keyof typeof vacationBalanceStatusLabels;

export type VacationPeriod = {
  periodStart: string;
  periodEnd: string;
  concessionDeadline: string;
};

export type VacationBalanceTarget = EmployeeScopeTarget & {
  status: VacationBalanceStatus;
};

export type ApprovedVacationRequest = {
  startDate: string;
  endDate: string;
  status: TimeOffStatus;
  type: string;
};

export const DEFAULT_CLT_DAYS_PER_PERIOD = 30;
export const MAX_SOLD_DAYS_FRACTION = 1 / 3;
export const VACATION_EXPIRY_WARNING_DAYS = 60;

export function computeVacationPeriod(
  employmentStartDate: string | Date,
  tenureYear: number,
): VacationPeriod {
  if (tenureYear < 1) {
    throw new Error("tenureYear must be 1 or greater.");
  }

  const start = new Date(`${toDateKey(employmentStartDate)}T00:00:00.000Z`);
  const periodStart = new Date(start);

  periodStart.setUTCFullYear(start.getUTCFullYear() + (tenureYear - 1));

  const periodEnd = new Date(periodStart);

  periodEnd.setUTCFullYear(periodStart.getUTCFullYear() + 1);
  periodEnd.setUTCDate(periodEnd.getUTCDate() - 1);

  const concessionDeadline = new Date(periodEnd);

  concessionDeadline.setUTCFullYear(periodEnd.getUTCFullYear() + 1);

  return {
    periodStart: periodStart.toISOString().slice(0, 10),
    periodEnd: periodEnd.toISOString().slice(0, 10),
    concessionDeadline: concessionDeadline.toISOString().slice(0, 10),
  };
}

export function calculatePeriodTakenDays(
  period: Pick<VacationPeriod, "periodStart" | "concessionDeadline">,
  requests: readonly { startDate: string; endDate: string; status: TimeOffStatus; type: string }[],
) {
  const periodStart = toDateKey(period.periodStart);
  const concessionDeadline = toDateKey(period.concessionDeadline);

  return requests.reduce((total, request) => {
    if (request.status !== "approved" || request.type !== "vacation") {
      return total;
    }

    const requestStart = toDateKey(request.startDate);

    if (requestStart < periodStart || requestStart > concessionDeadline) {
      return total;
    }

    return total + calculateBusinessDays(request.startDate, request.endDate);
  }, 0);
}

export function calculateAvailableBalance(input: {
  daysAcquired: number;
  daysSold: number;
  daysTaken: number;
}) {
  return Math.max(input.daysAcquired - input.daysSold - input.daysTaken, 0);
}

export function getMaxSellableDays(daysAcquired: number) {
  return Math.floor(daysAcquired * MAX_SOLD_DAYS_FRACTION);
}

export function validateSoldDays(input: { daysAcquired: number; daysSold: number; daysTaken: number }) {
  if (input.daysSold < 0) {
    return "Dias vendidos nao podem ser negativos.";
  }

  const max = getMaxSellableDays(input.daysAcquired);

  if (input.daysSold > max) {
    return `Limite de dias vendidos e ${max} (1/3 de ${input.daysAcquired}).`;
  }

  if (input.daysSold + input.daysTaken > input.daysAcquired) {
    return "Dias vendidos somados aos tirados excedem o saldo adquirido.";
  }

  return null;
}

export function daysBetween(from: string | Date, to: string | Date) {
  const start = new Date(`${toDateKey(from)}T00:00:00.000Z`);
  const end = new Date(`${toDateKey(to)}T00:00:00.000Z`);

  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

export function isVacationExpiring(input: {
  concessionDeadline: string;
  today: string | Date;
  thresholdDays?: number;
}) {
  const threshold = input.thresholdDays ?? VACATION_EXPIRY_WARNING_DAYS;
  const remaining = daysBetween(input.today, input.concessionDeadline);

  return remaining >= 0 && remaining <= threshold;
}

export function isVacationExpired(input: {
  concessionDeadline: string;
  availableBalance: number;
  today: string | Date;
}) {
  return input.availableBalance > 0 && daysBetween(input.today, input.concessionDeadline) < 0;
}

export function getVacationBalanceScope(context: AccessContext): TimeOffScope {
  return getTimeOffScope(context);
}

export function canReadVacationBalance(context: AccessContext, target: VacationBalanceTarget) {
  if (getVacationBalanceScope(context) === "all") {
    return true;
  }

  return canReadEmployeeTarget(context, target);
}

export function canManageVacationBalance(context: AccessContext) {
  return can("timeoff.write", context);
}
