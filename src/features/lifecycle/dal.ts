import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  areas,
  employees,
  lifecycleChecklistItems,
  lifecycleChecklists,
  positions,
  users,
} from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCanAny } from "@/lib/rbac";

import {
  getLifecycleChecklistProgress,
  getLifecycleChecklistState,
  type LifecycleChecklistItemStatus,
  type LifecycleChecklistState,
  type LifecycleChecklistStatus,
  type LifecycleType,
} from "./rules";

export type LifecycleChecklistItem = {
  id: string;
  key: string;
  title: string;
  required: boolean;
  status: LifecycleChecklistItemStatus;
  responsibleUserId: string | null;
  responsibleUserName: string | null;
  dueDate: string | null;
  completedAt: Date | null;
  completedByUserId: string | null;
  notes: string | null;
  sortOrder: number;
};

export type LifecycleChecklistListItem = {
  id: string;
  employeeId: string;
  employeeRegistrationNumber: string;
  employeeName: string;
  employeeCorporateEmail: string | null;
  employeeStatus: string;
  employeeEmploymentType: string;
  employeePositionName: string;
  employeeAreaName: string;
  employeeStartDate: string;
  employeeEndDate: string | null;
  type: LifecycleType;
  status: LifecycleChecklistStatus;
  dueDate: string | null;
  completedAt: Date | null;
  completedByUserId: string | null;
  createdByUserId: string;
  notes: string | null;
  items: LifecycleChecklistItem[];
  state: LifecycleChecklistState;
  progress: ReturnType<typeof getLifecycleChecklistProgress>;
  createdAt: Date;
  updatedAt: Date;
};

export type LifecycleEmployeeOption = {
  id: string;
  employmentType: string;
  name: string;
  registrationNumber: string;
  status: string;
};

export async function listLifecycleChecklists(
  context: AccessContext,
  type?: LifecycleType,
): Promise<LifecycleChecklistListItem[]> {
  assertCanAny(["lifecycle.read", "lifecycle.write"], context);
  const organizationId = requireOrganizationId(context);
  const rows = await db
    .select({
      id: lifecycleChecklists.id,
      employeeId: lifecycleChecklists.employeeId,
      employeeRegistrationNumber: employees.registrationNumber,
      employeeName: employees.fullName,
      employeeCorporateEmail: employees.corporateEmail,
      employeeStatus: employees.status,
      employeeEmploymentType: employees.employmentType,
      employeePositionName: positions.name,
      employeeAreaName: areas.name,
      employeeStartDate: employees.startDate,
      employeeEndDate: employees.endDate,
      type: lifecycleChecklists.type,
      status: lifecycleChecklists.status,
      dueDate: lifecycleChecklists.dueDate,
      completedAt: lifecycleChecklists.completedAt,
      completedByUserId: lifecycleChecklists.completedByUserId,
      createdByUserId: lifecycleChecklists.createdByUserId,
      notes: lifecycleChecklists.notes,
      createdAt: lifecycleChecklists.createdAt,
      updatedAt: lifecycleChecklists.updatedAt,
    })
    .from(lifecycleChecklists)
    .innerJoin(employees, eq(lifecycleChecklists.employeeId, employees.id))
    .innerJoin(positions, eq(employees.positionId, positions.id))
    .innerJoin(areas, eq(employees.areaId, areas.id))
    .where(
      and(
        eq(lifecycleChecklists.organizationId, organizationId),
        isNull(lifecycleChecklists.deletedAt),
        ...(type ? [eq(lifecycleChecklists.type, type)] : []),
      ),
    )
    .orderBy(desc(lifecycleChecklists.createdAt));
  const itemsByChecklist = await loadLifecycleChecklistItems(rows.map((row) => row.id));

  return rows.map((row) => {
    const items = itemsByChecklist.get(row.id) ?? [];
    const status = row.status as LifecycleChecklistStatus;

    return {
      ...row,
      items,
      progress: getLifecycleChecklistProgress({
        items,
        status,
      }),
      state: getLifecycleChecklistState({
        dueDate: row.dueDate,
        status,
      }),
      status,
      type: row.type as LifecycleType,
    };
  });
}

export async function listLifecycleDashboardItems(
  context: AccessContext,
  options: { limit?: number } = {},
) {
  const checklists = await listLifecycleChecklists(context);

  return checklists
    .filter((checklist) => checklist.status === "open")
    .sort((left, right) => {
      if (left.state === "overdue" && right.state !== "overdue") {
        return -1;
      }

      if (right.state === "overdue" && left.state !== "overdue") {
        return 1;
      }

      return (left.dueDate ?? "9999-12-31").localeCompare(right.dueDate ?? "9999-12-31");
    })
    .slice(0, options.limit);
}

export async function listLifecycleEmployeeOptions(
  context: AccessContext,
): Promise<LifecycleEmployeeOption[]> {
  assertCanAny(["lifecycle.write"], context);
  const organizationId = requireOrganizationId(context);

  return db
    .select({
      id: employees.id,
      employmentType: employees.employmentType,
      name: employees.fullName,
      registrationNumber: employees.registrationNumber,
      status: employees.status,
    })
    .from(employees)
    .where(and(eq(employees.organizationId, organizationId), isNull(employees.deletedAt)))
    .orderBy(asc(employees.fullName));
}

async function loadLifecycleChecklistItems(checklistIds: readonly string[]) {
  const itemsByChecklist = new Map<string, LifecycleChecklistItem[]>();

  if (checklistIds.length === 0) {
    return itemsByChecklist;
  }

  const rows = await db
    .select({
      id: lifecycleChecklistItems.id,
      checklistId: lifecycleChecklistItems.checklistId,
      key: lifecycleChecklistItems.key,
      title: lifecycleChecklistItems.title,
      required: lifecycleChecklistItems.required,
      status: lifecycleChecklistItems.status,
      responsibleUserId: lifecycleChecklistItems.responsibleUserId,
      responsibleUserName: users.name,
      dueDate: lifecycleChecklistItems.dueDate,
      completedAt: lifecycleChecklistItems.completedAt,
      completedByUserId: lifecycleChecklistItems.completedByUserId,
      notes: lifecycleChecklistItems.notes,
      sortOrder: lifecycleChecklistItems.sortOrder,
    })
    .from(lifecycleChecklistItems)
    .leftJoin(users, eq(lifecycleChecklistItems.responsibleUserId, users.id))
    .where(inArray(lifecycleChecklistItems.checklistId, [...checklistIds]))
    .orderBy(asc(lifecycleChecklistItems.sortOrder));

  for (const row of rows) {
    const items = itemsByChecklist.get(row.checklistId) ?? [];

    items.push({
      ...row,
      status: row.status as LifecycleChecklistItemStatus,
    });
    itemsByChecklist.set(row.checklistId, items);
  }

  return itemsByChecklist;
}

function requireOrganizationId(context: AccessContext) {
  if (!context.organizationId) {
    throw new AccessDeniedError();
  }

  return context.organizationId;
}
