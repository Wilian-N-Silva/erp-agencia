import { createDatabase, type Database } from "@/lib/db";
import type { AccessContext } from "@/lib/dal";
import { getRequiredEnv } from "@/lib/env";

import { enforceAuthenticatedRateLimitWithConsumer } from "./authenticated";
import { loadRateLimitConfig } from "./config";
import { enforceRateLimitWithConsumer } from "./helpers";
import { createPostgresRateLimiter, type RateLimitInput } from "./postgres";
import { writeRateLimitSecurityEvent } from "./telemetry";

let defaultLimiter: ReturnType<typeof createPostgresRateLimiter> | undefined;
let defaultLimiterDatabase: Database | undefined;

function getDefaultLimiterDatabase() {
  defaultLimiterDatabase ??= createDatabase(undefined, {
    allowExitOnIdle: true,
    max: 2,
  });

  return defaultLimiterDatabase;
}

function getDefaultLimiter() {
  defaultLimiter ??= createPostgresRateLimiter({
    config: loadRateLimitConfig(),
    // Rate-limit consumption must commit independently from the tenant
    // transaction so failed business mutations still count as attempts.
    database: getDefaultLimiterDatabase(),
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

export function enforceAuthenticatedRateLimit(
  action: RateLimitInput["action"],
  context: Pick<AccessContext, "organizationId" | "userId">,
) {
  return enforceAuthenticatedRateLimitWithConsumer(
    action,
    context,
    consumeRateLimit,
    writeRateLimitSecurityEvent,
  );
}

export function cleanupExpiredRateLimits() {
  return getDefaultLimiter().cleanup();
}

export * from "./config";
export * from "./authenticated";
export * from "./helpers";
export * from "./identity";
export * from "./postgres";
export * from "./telemetry";
