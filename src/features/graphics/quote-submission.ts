import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { graphicJobs } from "@/lib/db/schema";
import { AccessDeniedError } from "@/lib/rbac";

export async function lockGraphicJobForQuoteSubmission(
  jobId: string,
  organizationId: string,
) {
  const [job] = await db
    .select({
      id: graphicJobs.id,
      internalCode: graphicJobs.internalCode,
      operationalStatus: graphicJobs.operationalStatus,
      responsibleEmployeeId: graphicJobs.responsibleEmployeeId,
      title: graphicJobs.title,
    })
    .from(graphicJobs)
    .where(and(
      eq(graphicJobs.id, jobId),
      eq(graphicJobs.organizationId, organizationId),
      isNull(graphicJobs.deletedAt),
    ))
    .for("update")
    .limit(1);

  if (!job) throw new AccessDeniedError();
  if (
    job.operationalStatus !== "supplier_sourcing" &&
    job.operationalStatus !== "supplier_approval_pending"
  ) {
    throw new Error(
      "Supplier quotes can only be submitted during supplier sourcing or approval.",
    );
  }

  return job;
}
