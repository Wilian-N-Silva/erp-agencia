import { and, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { db, withTenantDb } from "@/lib/db";
import { files, graphicJobs, graphicOsVersions, users } from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError } from "@/lib/rbac";
import { canReadGraphicJobs } from "./rules";

export async function getGraphicOsVersions(context: AccessContext, jobId: string) {
  if (!context.organizationId || !canReadGraphicJobs(context)) throw new AccessDeniedError();
  return withTenantDb(context, async () => db.select({
    id: graphicOsVersions.id, version: graphicOsVersions.version,
    externalNumber: graphicOsVersions.externalNumber, issuedAt: graphicOsVersions.issuedAt,
    presentedAmount: graphicOsVersions.presentedAmount, revisionReason: graphicOsVersions.revisionReason,
    createdAt: graphicOsVersions.createdAt, creatorName: users.name,
  }).from(graphicOsVersions)
    .innerJoin(graphicJobs, and(eq(graphicJobs.id, graphicOsVersions.jobId), eq(graphicJobs.organizationId, graphicOsVersions.organizationId)))
    .innerJoin(users, eq(users.id, graphicOsVersions.createdByUserId))
    .where(and(eq(graphicOsVersions.organizationId, context.organizationId!), eq(graphicOsVersions.jobId, jobId), isNull(graphicJobs.deletedAt)))
    .orderBy(desc(graphicOsVersions.version)));
}

export async function findDuplicateOsJobs(context: AccessContext, jobId: string, number: string) {
  if (!context.organizationId || !canReadGraphicJobs(context)) throw new AccessDeniedError();
  return withTenantDb(context, async () => db.selectDistinct({ id: graphicJobs.id, code: graphicJobs.internalCode })
    .from(graphicOsVersions).innerJoin(graphicJobs, eq(graphicJobs.id, graphicOsVersions.jobId))
    .where(and(eq(graphicOsVersions.organizationId, context.organizationId!), ne(graphicOsVersions.jobId, jobId),
      sql`lower(trim(${graphicOsVersions.externalNumber})) = lower(trim(${number}))`))
    .limit(10));
}

export async function getGraphicOsDownload(context: AccessContext, jobId: string, versionId: string) {
  if (!context.organizationId || !canReadGraphicJobs(context)) throw new AccessDeniedError();
  return withTenantDb(context, async () => {
    const [file] = await db.select({ file: files }).from(graphicOsVersions)
      .innerJoin(graphicJobs, and(eq(graphicJobs.id, graphicOsVersions.jobId), eq(graphicJobs.organizationId, graphicOsVersions.organizationId)))
      .innerJoin(files, and(eq(files.id, graphicOsVersions.fileId), eq(files.organizationId, graphicOsVersions.organizationId)))
      .where(and(eq(graphicOsVersions.id, versionId), eq(graphicOsVersions.jobId, jobId),
        eq(graphicOsVersions.organizationId, context.organizationId!), isNull(graphicJobs.deletedAt), isNull(files.deletedAt))).limit(1);
    return file?.file ?? null;
  });
}
