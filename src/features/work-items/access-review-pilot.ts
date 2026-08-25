import { and, eq } from "drizzle-orm";

import {
  getAccessReviewState,
  isTerminatedEmployeeAccessAlert,
  type AccessRecordStatus,
} from "@/features/accesses/rules";
import { toDateKey } from "@/features/finance/rules";
import { bindTenantContext, db } from "@/lib/db";
import { accessRecords, employees, users } from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCan } from "@/lib/rbac";

import { generateWorkItem } from "./dal";
import type { GenerateWorkItemInput } from "./rules";

export type AccessReviewWorkItemSource = {
  accessCreatedAt: Date;
  critical: boolean;
  employeeEndDate: string | null;
  employeeId: string;
  employeeName: string;
  employeeStatus: string;
  id: string;
  platform: string;
  responsibleUserId: string | null;
  reviewDueDate: string | null;
  status: AccessRecordStatus;
};

export function buildAccessReviewWorkItemCandidates(
  rows: readonly AccessReviewWorkItemSource[],
  asOf: string | Date = new Date(),
): GenerateWorkItemInput[] {
  const asOfKey = toDateKey(asOf);

  return rows.flatMap((row) => {
    const target = {
      critical: row.critical,
      employeeId: row.employeeId,
      employeeStatus: row.employeeStatus,
      reviewDueDate: row.reviewDueDate,
      status: row.status,
    };
    const candidates: GenerateWorkItemInput[] = [];

    if (isTerminatedEmployeeAccessAlert(target)) {
      candidates.push({
        kind: "access_revocation",
        sourceType: "access_record",
        sourceId: row.id,
        occurrenceKey: `terminated_active:${row.employeeEndDate ?? "end_date_missing"}`,
        title: `${row.employeeName}: acesso ativo apos desligamento`,
        description: `${row.platform} continua ativo para colaborador desligado.`,
        assignedUserId: row.responsibleUserId,
        dueAt: toDueAt(row.reviewDueDate),
        priority: "critical",
      });
    }

    const reviewState = getAccessReviewState(target, asOfKey);

    if (
      reviewState === "missing" ||
      reviewState === "overdue" ||
      reviewState === "due_soon"
    ) {
      candidates.push({
        kind: "access_review",
        sourceType: "access_record",
        sourceId: row.id,
        occurrenceKey: row.reviewDueDate
          ? `review_due:${row.reviewDueDate}`
          : `review_missing:${row.accessCreatedAt.toISOString()}`,
        title: `${row.platform}: revisao de acesso critico`,
        description:
          reviewState === "missing"
            ? "Acesso critico sem data de revisao."
            : "Acesso critico requer revisao.",
        assignedUserId: row.responsibleUserId,
        dueAt: toDueAt(row.reviewDueDate),
        priority:
          reviewState === "overdue" || reviewState === "missing"
            ? "high"
            : "medium",
      });
    }

    return candidates;
  });
}

async function generateAccessReviewWorkItemsOperation(
  context: AccessContext,
  asOf: string | Date = new Date(),
) {
  assertCan("alerts.write", context);

  if (!context.organizationId) {
    throw new AccessDeniedError();
  }

  const rows = await db
    .select({
      accessCreatedAt: accessRecords.createdAt,
      critical: accessRecords.critical,
      employeeEndDate: employees.endDate,
      employeeId: accessRecords.employeeId,
      employeeName: employees.fullName,
      employeeStatus: employees.status,
      id: accessRecords.id,
      platform: accessRecords.platform,
      responsibleUserAccessStatus: users.accessStatus,
      responsibleUserIsActive: users.isActive,
      responsibleUserId: accessRecords.responsibleUserId,
      reviewDueDate: accessRecords.reviewDueDate,
      status: accessRecords.status,
    })
    .from(accessRecords)
    .innerJoin(employees, eq(accessRecords.employeeId, employees.id))
    .leftJoin(
      users,
      and(
        eq(accessRecords.responsibleUserId, users.id),
        eq(users.organizationId, context.organizationId),
      ),
    )
    .where(
      and(
        eq(accessRecords.organizationId, context.organizationId),
        eq(employees.organizationId, context.organizationId),
      ),
    );
  const candidates = buildAccessReviewWorkItemCandidates(
    rows.map((row) => ({
      ...row,
      responsibleUserId:
        row.responsibleUserAccessStatus === "active" &&
        row.responsibleUserIsActive
          ? row.responsibleUserId
          : null,
      status: row.status as AccessRecordStatus,
    })),
    asOf,
  );
  const results = [];

  for (const candidate of candidates) {
    results.push(await generateWorkItem(context, candidate));
  }

  return results;
}

function toDueAt(value: string | null) {
  return value ? new Date(`${value}T23:59:59.999Z`) : null;
}

export const generateAccessReviewWorkItems = bindTenantContext(
  generateAccessReviewWorkItemsOperation,
);
