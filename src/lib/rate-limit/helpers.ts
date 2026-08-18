import type { RateLimitInput, RateLimitResult } from "./postgres";

export const RATE_LIMIT_ERROR_MESSAGE =
  "Muitas tentativas. Aguarde um momento e tente novamente.";

export class RateLimitExceededError extends Error {
  readonly code = "RATE_LIMIT_EXCEEDED";
  readonly result: RateLimitResult;
  readonly status = 429;

  constructor(result: RateLimitResult) {
    super(RATE_LIMIT_ERROR_MESSAGE);
    this.name = "RateLimitExceededError";
    this.result = result;
  }
}

export type RateLimitConsumer = (
  input: RateLimitInput,
) => Promise<RateLimitResult>;

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

export function toRateLimitActionError(error: unknown) {
  if (!(error instanceof RateLimitExceededError)) return null;

  return {
    code: error.code,
    error: RATE_LIMIT_ERROR_MESSAGE,
    retryAfterSeconds: error.result.retryAfterSeconds,
  } as const;
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
