import { getDb } from "@/lib/db";
import { getRequiredEnv } from "@/lib/env";

import { loadRateLimitConfig } from "./config";
import { enforceRateLimitWithConsumer } from "./helpers";
import { createPostgresRateLimiter, type RateLimitInput } from "./postgres";

let defaultLimiter: ReturnType<typeof createPostgresRateLimiter> | undefined;

function getDefaultLimiter() {
  defaultLimiter ??= createPostgresRateLimiter({
    config: loadRateLimitConfig(),
    database: getDb(),
    hashSecret: getRequiredEnv("RATE_LIMIT_HASH_SECRET"),
  });

  return defaultLimiter;
}

export function consumeRateLimit(input: RateLimitInput) {
  return getDefaultLimiter().consume(input);
}

/**
 * Enforces a shared limit for a server-derived subject. Callers must build the
 * authenticated subject from AccessContext, never from client-owned IDs.
 */
export function enforceRateLimit(input: RateLimitInput) {
  return enforceRateLimitWithConsumer(input, consumeRateLimit);
}

export function cleanupExpiredRateLimits() {
  return getDefaultLimiter().cleanup();
}

export * from "./config";
export * from "./helpers";
export * from "./identity";
export * from "./postgres";
