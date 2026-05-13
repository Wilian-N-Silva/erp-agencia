import { asc, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { employees, timeOffRequests } from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCanAny } from "@/lib/rbac";

import {
  canReadTimeOff,
  getTimeOffScope,
  type TimeOffStatus,
  type TimeOffType,
} from "./rules";

export type TimeOffListItem = {
  id: string;
  employeeId: string;
  employeeName: string;
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

export async function listTimeOffRequests(
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

function requireOrganizationId(context: AccessContext) {
  if (!context.organizationId) {
    throw new AccessDeniedError();
  }

  return context.organizationId;
}
