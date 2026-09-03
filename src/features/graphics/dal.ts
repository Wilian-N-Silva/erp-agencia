import { and, asc, desc, eq, ilike, isNull, or, type SQL } from "drizzle-orm";

import { canReadAuditLogs } from "@/lib/audit";
import { bindTenantContext, db } from "@/lib/db";
import {
  auditLogs,
  clients,
  employees,
  graphicJobs,
  graphicProjects,
  users,
} from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCanAny } from "@/lib/rbac";

import {
  getGraphicJobNextAction,
  type GraphicJobFilters,
  type GraphicJobFinancialStatus,
  type GraphicJobOperationalStatus,
} from "./rules";

export type GraphicJobListItem = {
  id: string;
  internalCode: string;
  title: string;
  clientId: string;
  clientName: string;
  responsibleEmployeeId: string;
  responsibleName: string;
  projectId: string | null;
  projectName: string | null;
  requestedAt: Date;
  desiredDeliveryAt: Date | null;
  operationalStatus: GraphicJobOperationalStatus;
  financialStatus: GraphicJobFinancialStatus;
  nextAction: string;
};

export type GraphicJobDetail = GraphicJobListItem & {
  description: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type GraphicJobOption = { id: string; name: string };

export type GraphicJobFormOptions = {
  clients: GraphicJobOption[];
  employees: GraphicJobOption[];
  projects: GraphicJobOption[];
};

export type GraphicJobAuditItem = {
  id: string;
  action: string;
  actorName: string | null;
  createdAt: Date;
};

const listSelection = {
  id: graphicJobs.id,
  internalCode: graphicJobs.internalCode,
  title: graphicJobs.title,
  clientId: graphicJobs.clientId,
  clientName: clients.name,
  responsibleEmployeeId: graphicJobs.responsibleEmployeeId,
  responsibleName: employees.fullName,
  projectId: graphicJobs.projectId,
  projectName: graphicProjects.name,
  requestedAt: graphicJobs.requestedAt,
  desiredDeliveryAt: graphicJobs.desiredDeliveryAt,
  operationalStatus: graphicJobs.operationalStatus,
  financialStatus: graphicJobs.financialStatus,
};

async function listGraphicJobs(
  context: AccessContext,
  filters: GraphicJobFilters = {},
): Promise<GraphicJobListItem[]> {
  assertCanAny(["graphics.read", "graphics.write"], context);
  const organizationId = requireOrganizationId(context);
  const conditions: SQL[] = [
    eq(graphicJobs.organizationId, organizationId),
    isNull(graphicJobs.deletedAt),
  ];

  if (filters.status) conditions.push(eq(graphicJobs.operationalStatus, filters.status));
  if (filters.clientId) conditions.push(eq(graphicJobs.clientId, filters.clientId));
  if (filters.projectId) conditions.push(eq(graphicJobs.projectId, filters.projectId));
  if (filters.responsibleEmployeeId) {
    conditions.push(eq(graphicJobs.responsibleEmployeeId, filters.responsibleEmployeeId));
  }
  if (filters.search) {
    const pattern = `%${filters.search}%`;
    conditions.push(
      or(
        ilike(graphicJobs.internalCode, pattern),
        ilike(graphicJobs.title, pattern),
        ilike(clients.name, pattern),
      )!,
    );
  }

  const rows = await db
    .select(listSelection)
    .from(graphicJobs)
    .innerJoin(
      clients,
      and(
        eq(clients.id, graphicJobs.clientId),
        eq(clients.organizationId, organizationId),
      ),
    )
    .innerJoin(
      employees,
      and(
        eq(employees.id, graphicJobs.responsibleEmployeeId),
        eq(employees.organizationId, organizationId),
      ),
    )
    .leftJoin(
      graphicProjects,
      and(
        eq(graphicProjects.id, graphicJobs.projectId),
        eq(graphicProjects.organizationId, organizationId),
      ),
    )
    .where(and(...conditions))
    .orderBy(desc(graphicJobs.requestedAt), asc(graphicJobs.internalCode));

  return rows.map(toListItem);
}

async function getGraphicJobDetail(
  context: AccessContext,
  id: string,
): Promise<GraphicJobDetail | null> {
  assertCanAny(["graphics.read", "graphics.write"], context);
  const organizationId = requireOrganizationId(context);
  const [row] = await db
    .select({
      ...listSelection,
      description: graphicJobs.description,
      notes: graphicJobs.notes,
      createdAt: graphicJobs.createdAt,
      updatedAt: graphicJobs.updatedAt,
    })
    .from(graphicJobs)
    .innerJoin(clients, and(eq(clients.id, graphicJobs.clientId), eq(clients.organizationId, organizationId)))
    .innerJoin(employees, and(eq(employees.id, graphicJobs.responsibleEmployeeId), eq(employees.organizationId, organizationId)))
    .leftJoin(graphicProjects, and(eq(graphicProjects.id, graphicJobs.projectId), eq(graphicProjects.organizationId, organizationId)))
    .where(
      and(
        eq(graphicJobs.id, id),
        eq(graphicJobs.organizationId, organizationId),
        isNull(graphicJobs.deletedAt),
      ),
    )
    .limit(1);

  return row ? { ...toListItem(row), description: row.description, notes: row.notes, createdAt: row.createdAt, updatedAt: row.updatedAt } : null;
}

async function listGraphicJobFormOptions(
  context: AccessContext,
): Promise<GraphicJobFormOptions> {
  assertCanAny(["graphics.read", "graphics.write"], context);
  const organizationId = requireOrganizationId(context);
  const [clientRows, employeeRows, projectRows] = await Promise.all([
    db.select({ id: clients.id, name: clients.name }).from(clients).where(and(eq(clients.organizationId, organizationId), isNull(clients.deletedAt))).orderBy(asc(clients.name)),
    db.select({ id: employees.id, name: employees.fullName }).from(employees).where(and(eq(employees.organizationId, organizationId), isNull(employees.deletedAt))).orderBy(asc(employees.fullName)),
    db.select({ id: graphicProjects.id, name: graphicProjects.name }).from(graphicProjects).where(and(eq(graphicProjects.organizationId, organizationId), isNull(graphicProjects.deletedAt))).orderBy(asc(graphicProjects.name)),
  ]);

  return { clients: clientRows, employees: employeeRows, projects: projectRows };
}

async function listGraphicJobAuditLogs(
  context: AccessContext,
  jobId: string,
): Promise<GraphicJobAuditItem[]> {
  if (!canReadAuditLogs(context)) return [];
  const organizationId = requireOrganizationId(context);

  return db
    .select({ id: auditLogs.id, action: auditLogs.action, actorName: users.name, createdAt: auditLogs.createdAt })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorUserId))
    .where(and(eq(auditLogs.organizationId, organizationId), eq(auditLogs.entityType, "graphic_job"), eq(auditLogs.entityId, jobId)))
    .orderBy(desc(auditLogs.createdAt))
    .limit(20);
}

function toListItem(row: typeof listSelection extends never ? never : {
  id: string;
  internalCode: string;
  title: string;
  clientId: string;
  clientName: string;
  responsibleEmployeeId: string;
  responsibleName: string;
  projectId: string | null;
  projectName: string | null;
  requestedAt: Date;
  desiredDeliveryAt: Date | null;
  operationalStatus: GraphicJobOperationalStatus;
  financialStatus: GraphicJobFinancialStatus;
}): GraphicJobListItem {
  return { ...row, nextAction: getGraphicJobNextAction(row.operationalStatus) };
}

function requireOrganizationId(context: AccessContext) {
  if (!context.organizationId) throw new AccessDeniedError();
  return context.organizationId;
}

export const getGraphicJobs = bindTenantContext(listGraphicJobs);
export const getGraphicJob = bindTenantContext(getGraphicJobDetail);
export const getGraphicJobFormOptions = bindTenantContext(listGraphicJobFormOptions);
export const getGraphicJobAuditLogs = bindTenantContext(listGraphicJobAuditLogs);
