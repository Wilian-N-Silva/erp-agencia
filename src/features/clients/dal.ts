import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { canReadAuditLogs } from "@/lib/audit";
import { db } from "@/lib/db";
import { auditLogs, clients, employees, users } from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCanAny } from "@/lib/rbac";

import {
  applyClientFilters,
  getClientListScope,
  toClientListItem,
  type ClientFilters,
  type ClientListItem,
} from "./rules";

export type ClientOwnerOption = {
  id: string;
  name: string;
};

export type ClientDetail = ClientListItem & {
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ClientAuditLogItem = {
  id: string;
  action: string;
  actorName: string | null;
  actorEmail: string | null;
  metadata: unknown;
  createdAt: Date;
};

export async function listClients(
  context: AccessContext,
  filters: ClientFilters = {},
): Promise<ClientListItem[]> {
  assertCanAny(["clients.read", "clients.read_limited", "clients.configure"], context);
  const organizationId = requireOrganizationId(context);
  const scope = getClientListScope(context);

  if (scope === "none" || (scope === "owned" && !context.employeeId)) {
    return [];
  }

  const whereClause =
    scope === "owned"
      ? and(
          eq(clients.organizationId, organizationId),
          eq(clients.internalOwnerEmployeeId, context.employeeId as string),
          isNull(clients.deletedAt),
        )
      : and(eq(clients.organizationId, organizationId), isNull(clients.deletedAt));

  const rows = await db
    .select({
      id: clients.id,
      name: clients.name,
      code: clients.code,
      status: clients.status,
      monthlyFee: clients.monthlyFee,
      billingDay: clients.billingDay,
      internalOwnerEmployeeId: clients.internalOwnerEmployeeId,
      internalOwnerName: employees.fullName,
      billingMethod: clients.billingMethod,
      startDate: clients.startDate,
      cancellationDate: clients.cancellationDate,
    })
    .from(clients)
    .leftJoin(employees, eq(clients.internalOwnerEmployeeId, employees.id))
    .where(whereClause)
    .orderBy(asc(clients.name));

  return applyClientFilters(
    rows.map((row) => toClientListItem(row, context)),
    filters,
  );
}

export async function getClientDetail(
  context: AccessContext,
  id: string,
): Promise<ClientDetail | null> {
  assertCanAny(["clients.read", "clients.read_limited", "clients.configure"], context);
  const organizationId = requireOrganizationId(context);
  const scope = getClientListScope(context);

  if (scope === "none" || (scope === "owned" && !context.employeeId)) {
    return null;
  }

  const whereClause =
    scope === "owned"
      ? and(
          eq(clients.id, id),
          eq(clients.organizationId, organizationId),
          eq(clients.internalOwnerEmployeeId, context.employeeId as string),
          isNull(clients.deletedAt),
        )
      : and(eq(clients.id, id), eq(clients.organizationId, organizationId), isNull(clients.deletedAt));

  const [row] = await db
    .select({
      id: clients.id,
      name: clients.name,
      code: clients.code,
      status: clients.status,
      monthlyFee: clients.monthlyFee,
      billingDay: clients.billingDay,
      internalOwnerEmployeeId: clients.internalOwnerEmployeeId,
      internalOwnerName: employees.fullName,
      billingMethod: clients.billingMethod,
      notes: clients.notes,
      startDate: clients.startDate,
      cancellationDate: clients.cancellationDate,
      createdAt: clients.createdAt,
      updatedAt: clients.updatedAt,
    })
    .from(clients)
    .leftJoin(employees, eq(clients.internalOwnerEmployeeId, employees.id))
    .where(whereClause)
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    ...toClientListItem(row, context),
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listClientOwnerOptions(
  context: AccessContext,
): Promise<ClientOwnerOption[]> {
  assertCanAny(["clients.write", "clients.configure"], context);
  const organizationId = requireOrganizationId(context);

  const rows = await db
    .select({
      id: employees.id,
      name: employees.fullName,
    })
    .from(employees)
    .where(and(eq(employees.organizationId, organizationId), isNull(employees.deletedAt)))
    .orderBy(asc(employees.fullName));

  return rows;
}

export async function listClientAuditLogs(
  context: AccessContext,
  clientId: string,
  options: { limit?: number } = {},
): Promise<ClientAuditLogItem[]> {
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
        eq(auditLogs.entityType, "client"),
        eq(auditLogs.entityId, clientId),
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
