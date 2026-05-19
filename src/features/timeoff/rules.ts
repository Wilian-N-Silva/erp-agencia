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
