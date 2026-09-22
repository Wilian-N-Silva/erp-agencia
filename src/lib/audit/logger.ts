import { withTenantDb } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";

import { toAuditJson, toAuditSnapshot } from "./sanitize";
import type { AuditLogInput } from "./types";

export function createAuditLogValues(
  context: AccessContext,
  input: AuditLogInput,
) {
  if (!context.organizationId) {
    throw new Error("Audit organization context is required.");
  }

  return {
    organizationId: context.organizationId,
    actorUserId: context.userId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
    before: input.before === undefined ? null : toAuditSnapshot(input.before),
    after: input.after === undefined ? null : toAuditSnapshot(input.after),
    metadata: input.metadata === undefined ? null : toAuditJson(input.metadata),
  };
}

export async function writeAuditLog(
  context: AccessContext,
  input: AuditLogInput,
) {
  return withTenantDb(context, async (tenantDb) => {
    const [log] = await tenantDb
      .insert(auditLogs)
      .values(createAuditLogValues(context, input))
      .returning();

    return log;
  });
}

export async function auditSensitiveRead(
  context: AccessContext,
  input: Omit<AuditLogInput, "action">,
) {
  return writeAuditLog(context, {
    ...input,
    action: "sensitive_read",
  });
}
