import { and, asc, desc, eq, ilike, inArray, isNull, or, type SQL } from "drizzle-orm";

import { canReadAuditLogs } from "@/lib/audit";
import { bindTenantContext, db } from "@/lib/db";
import {
  auditLogs,
  clients,
  employees,
  files,
  graphicJobs,
  graphicProjects,
  graphicSupplierQuoteAttachments,
  graphicSupplierQuotes,
  suppliers,
  users,
} from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCan, assertCanAny } from "@/lib/rbac";

import {
  getGraphicJobNextAction,
  type GraphicJobFilters,
  type GraphicJobFinancialStatus,
  type GraphicJobOperationalStatus,
  type GraphicSupplierQuoteStatus,
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

export type GraphicSupplierQuoteAttachmentItem = {
  id: string;
  originalName: string;
};

export type GraphicSupplierQuoteItem = {
  id: string;
  jobId: string;
  supplierId: string;
  supplierName: string;
  description: string;
  quotedAmount: string;
  quotedAt: Date;
  estimatedDeliveryAt: Date | null;
  conditions: string | null;
  status: GraphicSupplierQuoteStatus;
  reviewerUserId: string | null;
  reviewerName: string | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  attachments: GraphicSupplierQuoteAttachmentItem[];
};

export type GraphicSupplierQuoteAuditItem = GraphicJobAuditItem & {
  quoteId: string;
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
  assertCanAny(["graphics.read", "graphics.write", "graphics.supplier_quote_write", "graphics.supplier_quote_approve"], context);
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
  assertCanAny(["graphics.read", "graphics.write", "graphics.supplier_quote_write", "graphics.supplier_quote_approve"], context);
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

async function listGraphicSupplierQuotes(
  context: AccessContext,
  jobId: string,
): Promise<GraphicSupplierQuoteItem[]> {
  assertCanAny(
    ["graphics.read", "graphics.write", "graphics.supplier_quote_write", "graphics.supplier_quote_approve"],
    context,
  );
  const organizationId = requireOrganizationId(context);
  const rows = await db
    .select({
      id: graphicSupplierQuotes.id,
      jobId: graphicSupplierQuotes.jobId,
      supplierId: graphicSupplierQuotes.supplierId,
      supplierName: suppliers.name,
      description: graphicSupplierQuotes.description,
      quotedAmount: graphicSupplierQuotes.quotedAmount,
      quotedAt: graphicSupplierQuotes.quotedAt,
      estimatedDeliveryAt: graphicSupplierQuotes.estimatedDeliveryAt,
      conditions: graphicSupplierQuotes.conditions,
      status: graphicSupplierQuotes.status,
      reviewerUserId: graphicSupplierQuotes.reviewerUserId,
      reviewerName: users.name,
      reviewedAt: graphicSupplierQuotes.reviewedAt,
      rejectionReason: graphicSupplierQuotes.rejectionReason,
      createdAt: graphicSupplierQuotes.createdAt,
      updatedAt: graphicSupplierQuotes.updatedAt,
    })
    .from(graphicSupplierQuotes)
    .innerJoin(suppliers, and(
      eq(suppliers.id, graphicSupplierQuotes.supplierId),
      eq(suppliers.organizationId, organizationId),
    ))
    .leftJoin(users, and(
      eq(users.id, graphicSupplierQuotes.reviewerUserId),
      eq(users.organizationId, organizationId),
    ))
    .innerJoin(graphicJobs, and(
      eq(graphicJobs.id, graphicSupplierQuotes.jobId),
      eq(graphicJobs.organizationId, organizationId),
      isNull(graphicJobs.deletedAt),
    ))
    .where(and(
      eq(graphicSupplierQuotes.organizationId, organizationId),
      eq(graphicSupplierQuotes.jobId, jobId),
    ))
    .orderBy(desc(graphicSupplierQuotes.quotedAt), desc(graphicSupplierQuotes.createdAt));

  if (!rows.length) return [];
  const attachmentRows = await db
    .select({
      id: graphicSupplierQuoteAttachments.id,
      quoteId: graphicSupplierQuoteAttachments.quoteId,
      originalName: files.originalName,
    })
    .from(graphicSupplierQuoteAttachments)
    .innerJoin(files, and(
      eq(files.id, graphicSupplierQuoteAttachments.fileId),
      eq(files.organizationId, organizationId),
      isNull(files.deletedAt),
    ))
    .where(and(
      eq(graphicSupplierQuoteAttachments.organizationId, organizationId),
      inArray(graphicSupplierQuoteAttachments.quoteId, rows.map(({ id }) => id)),
    ));

  return rows.map((row) => ({
    ...row,
    attachments: attachmentRows
      .filter(({ quoteId }) => quoteId === row.id)
      .map(({ id, originalName }) => ({ id, originalName })),
  }));
}

async function listGraphicSupplierOptions(context: AccessContext) {
  assertCan("graphics.supplier_quote_write", context);
  const organizationId = requireOrganizationId(context);
  return db.select({ id: suppliers.id, name: suppliers.name })
    .from(suppliers)
    .where(and(eq(suppliers.organizationId, organizationId), eq(suppliers.isActive, true)))
    .orderBy(asc(suppliers.name));
}

async function listGraphicSupplierQuoteAuditLogs(
  context: AccessContext,
  quoteIds: string[],
): Promise<GraphicSupplierQuoteAuditItem[]> {
  assertCanAny(
    ["graphics.read", "graphics.write", "graphics.supplier_quote_write", "graphics.supplier_quote_approve"],
    context,
  );
  if (!canReadAuditLogs(context) || !quoteIds.length) return [];
  const organizationId = requireOrganizationId(context);
  const rows = await db
    .select({
      id: auditLogs.id,
      quoteId: auditLogs.entityId,
      action: auditLogs.action,
      actorName: users.name,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorUserId))
    .where(and(
      eq(auditLogs.organizationId, organizationId),
      eq(auditLogs.entityType, "graphic_supplier_quote"),
      inArray(auditLogs.entityId, quoteIds),
    ))
    .orderBy(desc(auditLogs.createdAt));
  return rows.flatMap((row) => row.quoteId ? [{ ...row, quoteId: row.quoteId }] : []);
}

async function fetchGraphicSupplierQuoteAttachment(
  context: AccessContext,
  jobId: string,
  quoteId: string,
  attachmentId: string,
) {
  assertCanAny(
    ["graphics.read", "graphics.write", "graphics.supplier_quote_write", "graphics.supplier_quote_approve"],
    context,
  );
  const organizationId = requireOrganizationId(context);
  const [row] = await db.select({
    attachmentId: graphicSupplierQuoteAttachments.id,
    fileId: files.id,
    originalName: files.originalName,
    mimeType: files.mimeType,
    bucket: files.bucket,
    storageKey: files.storageKey,
    storageProvider: files.storageProvider,
  }).from(graphicSupplierQuoteAttachments)
    .innerJoin(graphicSupplierQuotes, and(
      eq(graphicSupplierQuotes.id, graphicSupplierQuoteAttachments.quoteId),
      eq(graphicSupplierQuotes.organizationId, organizationId),
    ))
    .innerJoin(graphicJobs, and(
      eq(graphicJobs.id, graphicSupplierQuotes.jobId),
      eq(graphicJobs.organizationId, organizationId),
      isNull(graphicJobs.deletedAt),
    ))
    .innerJoin(files, and(
      eq(files.id, graphicSupplierQuoteAttachments.fileId),
      eq(files.organizationId, organizationId),
      isNull(files.deletedAt),
    ))
    .where(and(
      eq(graphicSupplierQuoteAttachments.id, attachmentId),
      eq(graphicSupplierQuoteAttachments.organizationId, organizationId),
      eq(graphicSupplierQuotes.id, quoteId),
      eq(graphicSupplierQuotes.jobId, jobId),
    )).limit(1);
  if (!row) throw new AccessDeniedError();
  return row;
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
export const getGraphicSupplierQuotes = bindTenantContext(listGraphicSupplierQuotes);
export const getGraphicSupplierOptions = bindTenantContext(listGraphicSupplierOptions);
export const getGraphicSupplierQuoteAuditLogs = bindTenantContext(listGraphicSupplierQuoteAuditLogs);
export const getGraphicSupplierQuoteAttachment = bindTenantContext(fetchGraphicSupplierQuoteAttachment);
