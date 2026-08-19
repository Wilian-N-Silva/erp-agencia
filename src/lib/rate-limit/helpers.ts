import type { RateLimitInput, RateLimitResult } from "./postgres";
import {
  serverActionSuccess,
  type ServerActionResult,
} from "@/lib/server-action-result";

export const RATE_LIMIT_ERROR_MESSAGE =
  "Muitas tentativas. Aguarde um momento e tente novamente.";

export class RateLimitExceededError extends Error {
  readonly code = "RATE_LIMIT_EXCEEDED";
  readonly result: RateLimitResult;
  readonly status = 429;
  private securityEventReported = false;
  private securityEventReporter?: () => Promise<void>;

  constructor(result: RateLimitResult) {
    super(RATE_LIMIT_ERROR_MESSAGE);
    this.name = "RateLimitExceededError";
    this.result = result;
  }

  attachSecurityEventReporter(reporter: () => Promise<void>) {
    this.securityEventReporter = reporter;
  }

  async reportSecurityEvent() {
    if (this.securityEventReported || !this.securityEventReporter) return;

    this.securityEventReported = true;
    await this.securityEventReporter();
  }
}

export type RateLimitConsumer = (
  input: RateLimitInput,
) => Promise<RateLimitResult>;

export type RateLimitActionError = {
  code: "RATE_LIMIT_EXCEEDED";
  error: typeof RATE_LIMIT_ERROR_MESSAGE;
  retryAfterSeconds: number;
};

export async function enforceRateLimitWithConsumer(
  input: RateLimitInput,
  consume: RateLimitConsumer,
) {
  const result = await consume(input);

  if (!result.allowed) {
    throw new RateLimitExceededError(result);
  }

  return result;
}

export function toRateLimitActionError(
  error: unknown,
): RateLimitActionError | null {
  if (!(error instanceof RateLimitExceededError)) return null;

  return {
    code: error.code,
    error: RATE_LIMIT_ERROR_MESSAGE,
    retryAfterSeconds: error.result.retryAfterSeconds,
  } as const;
}

export function withRateLimitActionResult<
  Arguments extends unknown[],
  Result,
>(operation: (...args: Arguments) => Promise<Result>) {
  return async (...args: Arguments): Promise<ServerActionResult<Result>> => {
    try {
      return serverActionSuccess(await operation(...args));
    } catch (error) {
      const actionError = toRateLimitActionError(error);

      if (actionError) {
        await reportRateLimitSecurityEvent(error);
        return {
          code: "RATE_LIMITED",
          message: actionError.error,
          ok: false,
          retryAfterSeconds: actionError.retryAfterSeconds,
        };
      }

      throw error;
    }
  };
}

export async function reportRateLimitSecurityEvent(error: unknown) {
  if (!(error instanceof RateLimitExceededError)) return;

  await error.reportSecurityEvent();
}

export function toRateLimitResponse(error: unknown) {
  if (!(error instanceof RateLimitExceededError)) return null;

  return Response.json(
    {
      error: {
        code: error.code,
        message: RATE_LIMIT_ERROR_MESSAGE,
      },
    },
    {
      status: error.status,
      headers: {
        "retry-after": String(error.result.retryAfterSeconds),
      },
    },
  );
}
