import { asc, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { accessRecords, employees, users } from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCanAny } from "@/lib/rbac";

import {
  applyAccessRecordFilters,
  canReadAccessRecord,
  getAccessRecordScope,
  getAccessReviewState,
  isAccessReviewAlert,
  isTerminatedEmployeeAccessAlert,
  type AccessRecordFilters,
  type AccessRecordStatus,
  type AccessReviewState,
} from "./rules";

export type AccessRecordListItem = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeStatus: string;
  managerEmployeeId: string | null;
  platform: string;
  accountIdentifier: string | null;
  accessLevel: string;
  critical: boolean;
  status: AccessRecordStatus;
  reviewDueDate: string | null;
  removedAt: Date | null;
  responsibleUserName: string | null;
  notes: string | null;
  reviewState: AccessReviewState;
  alert: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type AccessEmployeeOption = {
  id: string;
  name: string;
};

export async function listAccessRecords(
  context: AccessContext,
  filters: AccessRecordFilters = {},
  options: { limit?: number; ownOnly?: boolean } = {},
): Promise<AccessRecordListItem[]> {
  assertCanAny(
    [
      "access_records.read",
      "access_records.write",
      "access_records.configure",
      "access_records.read_team",
      "access_records.read_own",
    ],
    context,
  );
  const organizationId = requireOrganizationId(context);
  const scope = options.ownOnly ? "own" : getAccessRecordScope(context);

  if (scope === "none") {
    return [];
  }

  const rows = await db
    .select({
      id: accessRecords.id,
      employeeId: accessRecords.employeeId,
      employeeName: employees.fullName,
      employeeStatus: employees.status,
      managerEmployeeId: employees.managerEmployeeId,
      platform: accessRecords.platform,
      accountIdentifier: accessRecords.accountIdentifier,
      accessLevel: accessRecords.accessLevel,
      critical: accessRecords.critical,
      status: accessRecords.status,
      reviewDueDate: accessRecords.reviewDueDate,
      removedAt: accessRecords.removedAt,
      responsibleUserName: users.name,
      notes: accessRecords.notes,
      createdAt: accessRecords.createdAt,
      updatedAt: accessRecords.updatedAt,
    })
    .from(accessRecords)
    .innerJoin(employees, eq(accessRecords.employeeId, employees.id))
    .leftJoin(users, eq(accessRecords.responsibleUserId, users.id))
    .where(eq(accessRecords.organizationId, organizationId))
    .orderBy(desc(accessRecords.critical), asc(accessRecords.platform), asc(employees.fullName));

  const scopedRows = rows.filter((row) => {
    if (scope === "all") {
      return true;
    }

    return canReadAccessRecord(context, {
      critical: row.critical,
      employeeId: row.employeeId,
      employeeStatus: row.employeeStatus,
      managerEmployeeId: row.managerEmployeeId,
      reviewDueDate: row.reviewDueDate,
      status: row.status as AccessRecordStatus,
    });
  });

  return applyAccessRecordFilters(
    scopedRows.map((row) => {
      const status = row.status as AccessRecordStatus;
      const target = {
        critical: row.critical,
        employeeId: row.employeeId,
        employeeStatus: row.employeeStatus,
        managerEmployeeId: row.managerEmployeeId,
        reviewDueDate: row.reviewDueDate,
        status,
      };

      return {
        ...row,
        status,
        reviewState: getAccessReviewState(target),
        alert: isAccessReviewAlert(target) || isTerminatedEmployeeAccessAlert(target),
      };
    }),
    filters,
  ).slice(0, options.limit);
}

export async function listAccessEmployeeOptions(
  context: AccessContext,
): Promise<AccessEmployeeOption[]> {
  assertCanAny(["access_records.write", "access_records.configure"], context);
  const organizationId = requireOrganizationId(context);

  return db
    .select({
      id: employees.id,
      name: employees.fullName,
    })
    .from(employees)
    .where(eq(employees.organizationId, organizationId))
    .orderBy(asc(employees.fullName));
}

export async function listAccessReviewAlerts(
  context: AccessContext,
  options: { limit?: number } = {},
) {
  const items = await listAccessRecords(context);

  return items.filter((item) => item.alert).slice(0, options.limit);
}

function requireOrganizationId(context: AccessContext) {
  if (!context.organizationId) {
    throw new AccessDeniedError();
  }

  return context.organizationId;
}
