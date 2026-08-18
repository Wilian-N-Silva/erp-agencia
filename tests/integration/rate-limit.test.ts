import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createDatabase, type Database } from "@/lib/db";
import {
  createPostgresRateLimiter,
  loadRateLimitConfig,
  type RateLimitConfig,
  type RateLimitInput,
} from "@/lib/rate-limit";

const runtimeUrl = process.env.DATABASE_TEST_URL;
const adminUrl = process.env.DATABASE_TEST_ADMIN_URL;

if (!runtimeUrl || !adminUrl) {
  throw new Error(
    "DATABASE_TEST_URL and DATABASE_TEST_ADMIN_URL are required for the rate-limit integration suite.",
  );
}

const secret = "sec-005-test-secret-with-at-least-32-characters";
const orgA = "50000000-0000-4000-8000-000000000001";
const orgB = "50000000-0000-4000-8000-000000000002";
const authenticatedSubject = {
  type: "authenticated" as const,
  organizationId: orgA,
  userId: "sec-005-user-a",
};
const baseInput: RateLimitInput = {
  action: "common_mutation",
  subject: authenticatedSubject,
};

let runtimeDb: Database;
let adminDb: Database;
let currentTime: Date;

beforeAll(() => {
  runtimeDb = createDatabase(runtimeUrl, { allowExitOnIdle: true, max: 20 });
  adminDb = createDatabase(adminUrl, { allowExitOnIdle: true, max: 1 });
});

beforeEach(async () => {
  currentTime = new Date("2026-08-18T12:00:30.000Z");
  await adminDb.execute(sql`delete from rate_limit_buckets`);
});

afterAll(async () => {
  if (adminDb) await adminDb.execute(sql`delete from rate_limit_buckets`);
  await Promise.all([runtimeDb?.$client.end(), adminDb?.$client.end()]);
});

describe("PostgreSQL rate limiter", () => {
  it("allows the threshold, blocks threshold + 1, and opens a new window", async () => {
    const limiter = createLimiter(configWithCommonLimit(2));

    await expect(limiter.consume(baseInput)).resolves.toMatchObject({
      allowed: true,
      remaining: 1,
    });
    await expect(limiter.consume(baseInput)).resolves.toMatchObject({
      allowed: true,
      remaining: 0,
    });
    await expect(limiter.consume(baseInput)).resolves.toMatchObject({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 30,
    });

    currentTime = new Date("2026-08-18T12:01:00.000Z");
    await expect(limiter.consume(baseInput)).resolves.toMatchObject({
      allowed: true,
      remaining: 1,
    });

    const buckets = await readBuckets();
    expect(buckets.map(({ count }) => count).sort()).toEqual([1, 2]);
  });

  it("isolates users, organizations, actions, and hashed IP subjects", async () => {
    const limiter = createLimiter(configWithCommonLimit(1));

    expect((await limiter.consume(baseInput)).allowed).toBe(true);
    expect((await limiter.consume(baseInput)).allowed).toBe(false);
    expect(
      (
        await limiter.consume({
          ...baseInput,
          subject: { ...authenticatedSubject, userId: "sec-005-user-b" },
        })
      ).allowed,
    ).toBe(true);
    expect(
      (
        await limiter.consume({
          ...baseInput,
          subject: { ...authenticatedSubject, organizationId: orgB },
        })
      ).allowed,
    ).toBe(true);
    expect(
      (await limiter.consume({ ...baseInput, action: "export" })).allowed,
    ).toBe(true);
    expect(
      (
        await limiter.consume({
          action: "invitation",
          subject: { type: "ip", ipAddress: "203.0.113.42" },
        })
      ).allowed,
    ).toBe(true);

    const buckets = await readBuckets();
    const persisted = JSON.stringify(buckets);

    expect(buckets).toHaveLength(5);
    expect(buckets.every(({ keyHash }) => /^[a-f0-9]{64}$/.test(keyHash))).toBe(
      true,
    );
    expect(persisted).not.toContain("203.0.113.42");
    expect(persisted).not.toContain("sec-005-user-a");
    expect(persisted).not.toContain(orgA);
  });

  it("atomically caps concurrent requests at the configured limit", async () => {
    const limiter = createLimiter(configWithCommonLimit(5));
    const results = await Promise.all(
      Array.from({ length: 20 }, () => limiter.consume(baseInput)),
    );

    expect(results.filter(({ allowed }) => allowed)).toHaveLength(5);
    expect(results.filter(({ allowed }) => !allowed)).toHaveLength(15);

    const buckets = await readBuckets();
    expect(buckets).toHaveLength(1);
    expect(buckets[0]?.count).toBe(5);
  });

  it("deletes expired buckets in bounded batches without removing active ones", async () => {
    const limiter = createLimiter(configWithCommonLimit(2));

    await limiter.consume(baseInput);
    currentTime = new Date("2026-08-18T12:01:01.000Z");
    await limiter.consume(baseInput);

    await expect(limiter.cleanup({ batchSize: 1 })).resolves.toBe(1);

    const buckets = await readBuckets();
    expect(buckets).toHaveLength(1);
    expect(buckets[0]?.expiresAt.getTime()).toBeGreaterThan(
      currentTime.getTime(),
    );
  });
});

function createLimiter(config: RateLimitConfig) {
  return createPostgresRateLimiter({
    config,
    database: runtimeDb,
    hashSecret: secret,
    now: () => currentTime,
    random: () => 1,
  });
}

function configWithCommonLimit(limit: number): RateLimitConfig {
  return {
    ...loadRateLimitConfig({}),
    common_mutation: { limit, windowMs: 60_000 },
    cleanup: { batchSize: 100, probability: 0 },
  };
}

async function readBuckets() {
  const result = await adminDb.execute(sql<{
    action: string;
    count: number;
    expiresAt: Date;
    keyHash: string;
  }>`
    select
      action,
      count,
      expires_at as "expiresAt",
      key_hash as "keyHash"
    from rate_limit_buckets
    order by window_start, key_hash
  `);

  return result.rows as Array<{
    action: string;
    count: number;
    expiresAt: Date;
    keyHash: string;
  }>;
}
