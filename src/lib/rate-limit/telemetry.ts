import { writeAuditLog } from "@/lib/audit";
import type { AccessContext } from "@/lib/dal";

import type { RateLimitAction } from "./config";
import type { RateLimitResult } from "./postgres";

export async function writeRateLimitSecurityEvent(input: {
  action: RateLimitAction;
  context: Pick<AccessContext, "organizationId" | "userId">;
  result: RateLimitResult;
}) {
  await writeAuditLog(input.context as AccessContext, {
    action: "rate_limit_exceeded",
    entityType: "rate_limit",
    metadata: {
      aggregation: "first_blocked_attempt_per_window",
      limit: input.result.limit,
      rateLimitAction: input.action,
      resetAt: input.result.resetAt.toISOString(),
    },
  });
}
