import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError } from "@/lib/rbac";

import type { RateLimitAction } from "./config";
import {
  enforceRateLimitWithConsumer,
  type RateLimitConsumer,
} from "./helpers";
import type { RateLimitInput } from "./postgres";

type AuthenticatedRateLimitContext = Pick<
  AccessContext,
  "organizationId" | "userId"
>;

export function buildAuthenticatedRateLimitInput(
  action: RateLimitAction,
  context: AuthenticatedRateLimitContext,
): RateLimitInput {
  if (!context.organizationId) {
    throw new AccessDeniedError();
  }

  return {
    action,
    subject: {
      type: "authenticated",
      organizationId: context.organizationId,
      userId: context.userId,
    },
  };
}

export function enforceAuthenticatedRateLimitWithConsumer(
  action: RateLimitAction,
  context: AuthenticatedRateLimitContext,
  consume: RateLimitConsumer,
) {
  return enforceRateLimitWithConsumer(
    buildAuthenticatedRateLimitInput(action, context),
    consume,
  );
}
