import { and, eq, isNull, ne } from "drizzle-orm";

import { db } from "@/lib/db";
import { graphicJobs, graphicSupplierQuotes } from "@/lib/db/schema";
import { AccessDeniedError } from "@/lib/rbac";

import {
  assertGraphicJobTransition,
  getGraphicJobStatusAfterQuoteRejection,
} from "./rules";

type QuoteDecisionInput = {
  decision: "approved" | "cancelled" | "rejected";
  jobId: string;
  organizationId: string;
  quoteId: string;
  rejectionReason?: string;
  reviewerUserId?: string;
};

export async function transitionPendingGraphicSupplierQuote(
  input: QuoteDecisionInput,
) {
  // Every quote decision for a job takes the same lock first. This both
  // serializes decisions and avoids lock-order inversions between quote rows.
  const [beforeJob] = await db
    .select()
    .from(graphicJobs)
    .where(and(
      eq(graphicJobs.id, input.jobId),
      eq(graphicJobs.organizationId, input.organizationId),
      eq(graphicJobs.operationalStatus, "supplier_approval_pending"),
      isNull(graphicJobs.deletedAt),
    ))
    .for("update")
    .limit(1);
  if (!beforeJob) throw new AccessDeniedError();

  const [beforeQuote] = await db
    .select()
    .from(graphicSupplierQuotes)
    .where(and(
      eq(graphicSupplierQuotes.id, input.quoteId),
      eq(graphicSupplierQuotes.jobId, input.jobId),
      eq(graphicSupplierQuotes.organizationId, input.organizationId),
      eq(graphicSupplierQuotes.status, "pending"),
    ))
    .limit(1);
  if (!beforeQuote) throw new AccessDeniedError();

  const nextJobStatus = input.decision === "approved"
    ? "os_pending"
    : getGraphicJobStatusAfterQuoteRejection(
        await getOtherQuoteStatuses(input.quoteId, input.jobId, input.organizationId),
      );
  if (nextJobStatus !== beforeJob.operationalStatus) {
    assertGraphicJobTransition({ from: beforeJob.operationalStatus, to: nextJobStatus });
  }

  const now = new Date();
  const [afterQuote] = await db
    .update(graphicSupplierQuotes)
    .set(input.decision === "cancelled" ? {
      status: "cancelled",
      updatedAt: now,
    } : {
      status: input.decision,
      reviewerUserId: input.reviewerUserId,
      reviewedAt: now,
      rejectionReason: input.decision === "rejected" ? input.rejectionReason : null,
      updatedAt: now,
    })
    .where(and(
      eq(graphicSupplierQuotes.id, input.quoteId),
      eq(graphicSupplierQuotes.organizationId, input.organizationId),
      eq(graphicSupplierQuotes.jobId, input.jobId),
      eq(graphicSupplierQuotes.status, "pending"),
    ))
    .returning();
  if (!afterQuote) throw new Error("Supplier quote state changed before decision.");

  let afterJob = beforeJob;
  if (nextJobStatus !== beforeJob.operationalStatus) {
    [afterJob] = await db
      .update(graphicJobs)
      .set({ operationalStatus: nextJobStatus, updatedAt: now })
      .where(and(
        eq(graphicJobs.id, beforeJob.id),
        eq(graphicJobs.organizationId, input.organizationId),
        eq(graphicJobs.operationalStatus, "supplier_approval_pending"),
        isNull(graphicJobs.deletedAt),
      ))
      .returning();
    if (!afterJob) throw new Error("Graphic job state changed before quote decision.");
  }

  return { afterJob, afterQuote, beforeJob, beforeQuote, now };
}

async function getOtherQuoteStatuses(
  quoteId: string,
  jobId: string,
  organizationId: string,
) {
  const rows = await db
    .select({ status: graphicSupplierQuotes.status })
    .from(graphicSupplierQuotes)
    .where(and(
      eq(graphicSupplierQuotes.organizationId, organizationId),
      eq(graphicSupplierQuotes.jobId, jobId),
      ne(graphicSupplierQuotes.id, quoteId),
    ));
  return rows.map(({ status }) => status);
}
