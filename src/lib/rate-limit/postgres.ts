import { sql } from "drizzle-orm";
import { z } from "zod";

import type { Database } from "@/lib/db";

import {
  rateLimitActions,
  type RateLimitAction,
  type RateLimitConfig,
} from "./config";
import {
  hashRateLimitIdentity,
  rateLimitSubjectSchema,
  type RateLimitSubject,
} from "./identity";

const consumeInputSchema = z
  .object({
    action: z.enum(rateLimitActions),
    subject: rateLimitSubjectSchema,
  })
  .strict();

const cleanupInputSchema = z
  .object({
    batchSize: z.number().int().positive().max(10_000),
  })
  .strict();

export type RateLimitInput = {
  action: RateLimitAction;
  subject: RateLimitSubject;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfterSeconds: number;
};

type RateLimitDatabase = Pick<Database, "execute">;

type PostgresRateLimiterOptions = {
  config: RateLimitConfig;
  database: RateLimitDatabase;
  hashSecret: string;
  now?: () => Date;
  random?: () => number;
};

export function createPostgresRateLimiter({
  config,
  database,
  hashSecret,
  now = () => new Date(),
  random = Math.random,
}: PostgresRateLimiterOptions) {
  if (hashSecret.trim().length < 32) {
    throw new Error(
      "RATE_LIMIT_HASH_SECRET must contain at least 32 characters.",
    );
  }

  async function consume(input: RateLimitInput): Promise<RateLimitResult> {
    const parsedInput = consumeInputSchema.parse(input);
    const rule = config[parsedInput.action];
    const currentTime = now();
    const windowStart = new Date(
      Math.floor(currentTime.getTime() / rule.windowMs) * rule.windowMs,
    );
    const resetAt = new Date(windowStart.getTime() + rule.windowMs);
    const keyHash = hashRateLimitIdentity(
      parsedInput.action,
      parsedInput.subject,
      hashSecret,
    );

    const result = await database.execute(sql<{ count: number }>`
      insert into rate_limit_buckets (
        key_hash, action, window_start, count, expires_at
      ) values (
        ${keyHash}, ${parsedInput.action}, ${windowStart}, 1, ${resetAt}
      )
      on conflict (key_hash, action, window_start)
      do update set
        count = rate_limit_buckets.count + 1,
        expires_at = excluded.expires_at
      where rate_limit_buckets.count < ${rule.limit}
      returning count
    `);

    if (random() < config.cleanup.probability) {
      await cleanup({ batchSize: config.cleanup.batchSize });
    }

    const count = Number(result.rows[0]?.count ?? rule.limit);
    const allowed = result.rows.length === 1;

    return {
      allowed,
      limit: rule.limit,
      remaining: allowed ? Math.max(rule.limit - count, 0) : 0,
      resetAt,
      retryAfterSeconds: allowed
        ? 0
        : Math.max(
            1,
            Math.ceil((resetAt.getTime() - currentTime.getTime()) / 1000),
          ),
    };
  }

  async function cleanup(
    input: { batchSize: number } = { batchSize: config.cleanup.batchSize },
  ) {
    const { batchSize } = cleanupInputSchema.parse(input);
    const result = await database.execute(sql<{ deleted: number }>`
      with expired as (
        select ctid
        from rate_limit_buckets
        where expires_at <= ${now()}
        order by expires_at
        limit ${batchSize}
        for update skip locked
      )
      delete from rate_limit_buckets as buckets
      using expired
      where buckets.ctid = expired.ctid
      returning 1 as deleted
    `);

    return result.rows.length;
  }

  return { cleanup, consume };
}

export type PostgresRateLimiter = ReturnType<typeof createPostgresRateLimiter>;
