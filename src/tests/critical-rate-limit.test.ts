import { describe, expect, it, vi } from "vitest";

import { createAccessContext } from "@/tests/helpers/access-context";
import {
  RATE_LIMIT_ERROR_MESSAGE,
  RateLimitExceededError,
  buildAuthenticatedRateLimitInput,
  enforceAuthenticatedRateLimitWithConsumer,
  reportRateLimitSecurityEvent,
  toRateLimitResponse,
  type RateLimitAction,
  type RateLimitConsumer,
  type RateLimitResult,
} from "@/lib/rate-limit";
import { AccessDeniedError } from "@/lib/rbac";

const context = createAccessContext({
  organizationId: "10000000-0000-4000-8000-000000000001",
  roles: ["finance"],
  userId: "user-1",
});

const blockedResult: RateLimitResult = {
  allowed: false,
  limit: 1,
  remaining: 0,
  resetAt: new Date("2026-08-18T12:00:30.000Z"),
  retryAfterSeconds: 30,
  shouldEmitSecurityEvent: true,
};

const criticalActions: RateLimitAction[] = [
  "invitation",
  "upload",
  "export",
  "reconciliation",
  "graphics_import",
  "financial_transaction",
];

describe("critical authenticated rate limits", () => {
  it.each(criticalActions)(
    "derives the %s bucket exclusively from the authenticated context",
    (action) => {
      expect(buildAuthenticatedRateLimitInput(action, context)).toEqual({
        action,
        subject: {
          type: "authenticated",
          organizationId: context.organizationId,
          userId: context.userId,
        },
      });
    },
  );

  it("denies authenticated limiting when tenant context is absent", () => {
    const contextWithoutOrganization = createAccessContext({
      roles: ["finance"],
      userId: "user-1",
    });

    expect(() =>
      buildAuthenticatedRateLimitInput("export", contextWithoutOrganization),
    ).toThrow(AccessDeniedError);
  });

  it.each(criticalActions)(
    "blocks %s with the safe Action error and HTTP 429 equivalent",
    async (action) => {
      const consume: RateLimitConsumer = vi.fn().mockResolvedValue(blockedResult);

      let thrown: unknown;
      try {
        await enforceAuthenticatedRateLimitWithConsumer(
          action,
          context,
          consume,
        );
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(RateLimitExceededError);
      expect((thrown as Error).message).toBe(RATE_LIMIT_ERROR_MESSAGE);
      expect(consume).toHaveBeenCalledWith(
        buildAuthenticatedRateLimitInput(action, context),
      );

      const response = toRateLimitResponse(thrown);
      expect(response?.status).toBe(429);
      expect(response?.headers.get("retry-after")).toBe("30");
      await expect(response?.json()).resolves.toEqual({
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: RATE_LIMIT_ERROR_MESSAGE,
        },
      });
    },
  );

  it("reports one aggregated security event without repeating blocked-event spam", async () => {
    const repeatedBlockedResult = {
      ...blockedResult,
      shouldEmitSecurityEvent: false,
    };
    const consume = vi
      .fn()
      .mockResolvedValueOnce(blockedResult)
      .mockResolvedValueOnce(repeatedBlockedResult);
    const reportSecurityEvent = vi.fn().mockResolvedValue(undefined);

    const firstError = await enforceAuthenticatedRateLimitWithConsumer(
      "upload",
      context,
      consume,
      reportSecurityEvent,
    ).catch((error: unknown) => error);
    const repeatedError = await enforceAuthenticatedRateLimitWithConsumer(
      "upload",
      context,
      consume,
      reportSecurityEvent,
    ).catch((error: unknown) => error);

    expect(firstError).toBeInstanceOf(RateLimitExceededError);
    expect(repeatedError).toBeInstanceOf(RateLimitExceededError);
    expect(reportSecurityEvent).not.toHaveBeenCalled();

    await reportRateLimitSecurityEvent(firstError);
    await reportRateLimitSecurityEvent(firstError);
    await reportRateLimitSecurityEvent(repeatedError);
    expect(reportSecurityEvent).toHaveBeenCalledOnce();
    expect(reportSecurityEvent).toHaveBeenCalledWith({
      action: "upload",
      context,
      result: blockedResult,
    });
  });
});
