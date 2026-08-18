import { and, asc, desc, eq, gte, inArray, lte, type SQL } from "drizzle-orm";

import { bindTenantContext, db } from "@/lib/db";
import { auditLogs, users } from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError } from "@/lib/rbac";

import {
  applyAuditTextFilter,
  canReadAuditPayloads,
  canReadAuditReport,
  getVisibleAuditEntityTypes,
  toAuditDateBoundary,
  type AuditFilters,
} from "./rules";

export type AuditActorOption = {
  id: string;
  label: string;
};

export type AuditLogListItem = {
  id: string;
  action: string;
  actorEmail: string | null;
  actorName: string | null;
  entityId: string | null;
  entityType: string;
  hasAfter: boolean;
  hasBefore: boolean;
  hasMetadata: boolean;
  payloadsVisible: boolean;
  createdAt: Date;
};

export type AuditLogDetail = AuditLogListItem & {
  after: unknown;
  before: unknown;
  ipAddress: string | null;
  metadata: unknown;
  userAgent: string | null;
};

async function listAuditLogs(
  context: AccessContext,
  filters: AuditFilters = {},
  options: { limit?: number } = {},
): Promise<AuditLogListItem[]> {
  assertCanReadAudit(context);
  const organizationId = requireOrganizationId(context);
  const payloadsVisible = canReadAuditPayloads(context);
  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      actorEmail: users.email,
      actorName: users.name,
      before: auditLogs.before,
      after: auditLogs.after,
      entityId: auditLogs.entityId,
      entityType: auditLogs.entityType,
      metadata: auditLogs.metadata,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorUserId, users.id))
    .where(buildAuditWhereClause(context, organizationId, filters))
    .orderBy(desc(auditLogs.createdAt))
    .limit(Math.min((options.limit ?? 200) * 3, 600));

  return applyAuditTextFilter(
    rows.map((row) => ({
      id: row.id,
      action: row.action,
      actorEmail: row.actorEmail,
      actorName: row.actorName,
      entityId: row.entityId,
      entityType: row.entityType,
      hasAfter: Boolean(row.after),
      hasBefore: Boolean(row.before),
      hasMetadata: Boolean(row.metadata),
      payloadsVisible,
      createdAt: row.createdAt,
    })),
    filters.query,
  ).slice(0, options.limit ?? 200);
}

async function getAuditLogDetail(
  context: AccessContext,
  id: string,
): Promise<AuditLogDetail | null> {
  assertCanReadAudit(context);
  const organizationId = requireOrganizationId(context);
  const [row] = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      actorEmail: users.email,
      actorName: users.name,
      before: auditLogs.before,
      after: auditLogs.after,
      entityId: auditLogs.entityId,
      entityType: auditLogs.entityType,
      ipAddress: auditLogs.ipAddress,
      metadata: auditLogs.metadata,
      userAgent: auditLogs.userAgent,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorUserId, users.id))
    .where(and(eq(auditLogs.id, id), buildAuditWhereClause(context, organizationId, {})))
    .limit(1);

  if (!row) {
    return null;
  }

  const payloadsVisible = canReadAuditPayloads(context);

  return {
    id: row.id,
    action: row.action,
    actorEmail: row.actorEmail,
    actorName: row.actorName,
    after: payloadsVisible ? row.after : null,
    before: payloadsVisible ? row.before : null,
    entityId: row.entityId,
    entityType: row.entityType,
    hasAfter: Boolean(row.after),
    hasBefore: Boolean(row.before),
    hasMetadata: Boolean(row.metadata),
    ipAddress: payloadsVisible ? row.ipAddress : null,
    metadata: payloadsVisible ? row.metadata : null,
    payloadsVisible,
    userAgent: payloadsVisible ? row.userAgent : null,
    createdAt: row.createdAt,
  };
}

async function listAuditActorOptions(
  context: AccessContext,
): Promise<AuditActorOption[]> {
  assertCanReadAudit(context);
  const organizationId = requireOrganizationId(context);
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
    })
    .from(auditLogs)
    .innerJoin(users, eq(auditLogs.actorUserId, users.id))
    .where(buildAuditWhereClause(context, organizationId, {}))
    .orderBy(asc(users.name), asc(users.email))
    .limit(500);
  const actorsById = new Map<string, AuditActorOption>();

  for (const row of rows) {
    actorsById.set(row.id, {
      id: row.id,
      label: `${row.name} (${row.email})`,
    });
  }

  return [...actorsById.values()];
}

function buildAuditWhereClause(
  context: AccessContext,
  organizationId: string,
  filters: AuditFilters,
) {
  const conditions: SQL[] = [eq(auditLogs.organizationId, organizationId)];
  const visibleEntityTypes = getVisibleAuditEntityTypes(context);

  if (visibleEntityTypes && visibleEntityTypes.length === 0) {
    conditions.push(eq(auditLogs.entityType, "__none__"));
  } else if (filters.entityType) {
    conditions.push(
      visibleEntityTypes && !visibleEntityTypes.includes(filters.entityType)
        ? eq(auditLogs.entityType, "__none__")
        : eq(auditLogs.entityType, filters.entityType),
    );
  } else if (visibleEntityTypes) {
    conditions.push(inArray(auditLogs.entityType, visibleEntityTypes));
  }

  if (filters.action && filters.action !== "all") {
    conditions.push(eq(auditLogs.action, filters.action));
  }

  if (filters.actorUserId) {
    conditions.push(eq(auditLogs.actorUserId, filters.actorUserId));
  }

  if (filters.entityId) {
    conditions.push(eq(auditLogs.entityId, filters.entityId));
  }

  if (filters.dateFrom) {
    conditions.push(gte(auditLogs.createdAt, toAuditDateBoundary(filters.dateFrom, "start")));
  }

  if (filters.dateTo) {
    conditions.push(lte(auditLogs.createdAt, toAuditDateBoundary(filters.dateTo, "end")));
  }

  return and(...conditions);
}

function assertCanReadAudit(context: AccessContext) {
  if (!canReadAuditReport(context)) {
    throw new AccessDeniedError();
  }
}

function requireOrganizationId(context: AccessContext) {
  if (!context.organizationId) {
    throw new AccessDeniedError();
  }

  return context.organizationId;
}

export {
  tenantListAuditLogs as listAuditLogs,
  tenantGetAuditLogDetail as getAuditLogDetail,
  tenantListAuditActorOptions as listAuditActorOptions,
};

const tenantListAuditLogs = bindTenantContext(listAuditLogs);
const tenantGetAuditLogDetail = bindTenantContext(getAuditLogDetail);
const tenantListAuditActorOptions = bindTenantContext(listAuditActorOptions);
