import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError } from "@/lib/rbac";

import type { RateLimitAction } from "./config";
import {
  enforceRateLimitWithConsumer,
  RateLimitExceededError,
  type RateLimitConsumer,
} from "./helpers";
import type { RateLimitInput, RateLimitResult } from "./postgres";

type AuthenticatedRateLimitContext = Pick<
  AccessContext,
  "organizationId" | "userId"
>;

export type RateLimitSecurityEventReporter = (input: {
  action: RateLimitAction;
  context: AuthenticatedRateLimitContext;
  result: RateLimitResult;
}) => Promise<void>;

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

export async function enforceAuthenticatedRateLimitWithConsumer(
  action: RateLimitAction,
  context: AuthenticatedRateLimitContext,
  consume: RateLimitConsumer,
  reportSecurityEvent?: RateLimitSecurityEventReporter,
) {
  try {
    return await enforceRateLimitWithConsumer(
      buildAuthenticatedRateLimitInput(action, context),
      consume,
    );
  } catch (error) {
    if (
      error instanceof RateLimitExceededError &&
      error.result.shouldEmitSecurityEvent &&
      reportSecurityEvent
    ) {
      error.attachSecurityEventReporter(() =>
        reportSecurityEvent({ action, context, result: error.result }),
      );
    }

    throw error;
  }
}
