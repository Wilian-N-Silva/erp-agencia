import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

import {
  RATE_LIMIT_ERROR_MESSAGE,
  RateLimitExceededError,
  hashRateLimitIdentity,
  loadRateLimitConfig,
  rateLimitSubjectSchema,
  toRateLimitActionError,
  toRateLimitResponse,
  type RateLimitInput,
  type RateLimitResult,
} from "@/lib/rate-limit";
import { enforceRateLimitWithConsumer } from "@/lib/rate-limit/helpers";

const authenticatedInput: RateLimitInput = {
  action: "common_mutation",
  subject: {
    type: "authenticated",
    organizationId: "00000000-0000-4000-8000-000000000001",
    userId: "user-1",
  },
};

const allowedResult: RateLimitResult = {
  allowed: true,
  limit: 2,
  remaining: 1,
  resetAt: new Date("2026-08-18T12:01:00.000Z"),
  retryAfterSeconds: 0,
};

const blockedResult: RateLimitResult = {
  ...allowedResult,
  allowed: false,
  remaining: 0,
  retryAfterSeconds: 37,
};

describe("rate-limit configuration", () => {
  it("centralizes the documented defaults", () => {
    const config = loadRateLimitConfig({});

    expect(config.invitation).toEqual({ limit: 10, windowMs: 10 * 60 * 1000 });
    expect(config.upload).toEqual({ limit: 20, windowMs: 10 * 60 * 1000 });
    expect(config.export).toEqual({ limit: 5, windowMs: 5 * 60 * 1000 });
    expect(config.reconciliation).toEqual({
      limit: 30,
      windowMs: 5 * 60 * 1000,
    });
    expect(config.common_mutation).toEqual({ limit: 120, windowMs: 60 * 1000 });
    expect(config.graphics_import).toEqual({
      limit: 3,
      windowMs: 60 * 60 * 1000,
    });
  });

  it("accepts bounded environment overrides and rejects invalid values", () => {
    expect(
      loadRateLimitConfig({
        RATE_LIMIT_EXPORT_LIMIT: "7",
        RATE_LIMIT_EXPORT_WINDOW_SECONDS: "90",
      }).export,
    ).toEqual({ limit: 7, windowMs: 90_000 });

    expect(() => loadRateLimitConfig({ RATE_LIMIT_EXPORT_LIMIT: "0" })).toThrow(
      ZodError,
    );
    expect(() =>
      loadRateLimitConfig({ RATE_LIMIT_CLEANUP_PROBABILITY: "1.1" }),
    ).toThrow(ZodError);
  });
});

describe("rate-limit identity", () => {
  it("uses scoped deterministic HMAC hashes without exposing identity values", () => {
    const secret = "a-secure-rate-limit-secret-value";
    const first = hashRateLimitIdentity(
      authenticatedInput.action,
      authenticatedInput.subject,
      secret,
    );
    const second = hashRateLimitIdentity(
      authenticatedInput.action,
      authenticatedInput.subject,
      secret,
    );
    const otherAction = hashRateLimitIdentity(
      "export",
      authenticatedInput.subject,
      secret,
    );
    const ipHash = hashRateLimitIdentity(
      "invitation",
      { type: "ip", ipAddress: "203.0.113.42" },
      secret,
    );
    const expandedIpv6Hash = hashRateLimitIdentity(
      "invitation",
      {
        type: "ip",
        ipAddress: "2001:0db8:0000:0000:0000:0000:0000:0001",
      },
      secret,
    );
    const compressedIpv6Hash = hashRateLimitIdentity(
      "invitation",
      { type: "ip", ipAddress: "2001:db8::1" },
      secret,
    );

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toBe(otherAction);
    expect(ipHash).not.toContain("203.0.113.42");
    expect(expandedIpv6Hash).toBe(compressedIpv6Hash);
  });

  it("strictly validates authenticated and IP subjects", () => {
    expect(() =>
      rateLimitSubjectSchema.parse({
        ...authenticatedInput.subject,
        organizationId: "not-a-uuid",
      }),
    ).toThrow(ZodError);
    expect(() =>
      rateLimitSubjectSchema.parse({
        type: "ip",
        ipAddress: "not-an-ip",
      }),
    ).toThrow(ZodError);
    expect(() =>
      rateLimitSubjectSchema.parse({
        ...authenticatedInput.subject,
        organizationIdFromClient: "tampered",
      }),
    ).toThrow(ZodError);
  });
});

describe("Action and route helpers", () => {
  it("returns allowed results and throws a consistent blocked error", async () => {
    const allowedConsumer = vi.fn().mockResolvedValue(allowedResult);
    const blockedConsumer = vi.fn().mockResolvedValue(blockedResult);

    await expect(
      enforceRateLimitWithConsumer(authenticatedInput, allowedConsumer),
    ).resolves.toEqual(allowedResult);
    await expect(
      enforceRateLimitWithConsumer(authenticatedInput, blockedConsumer),
    ).rejects.toBeInstanceOf(RateLimitExceededError);
  });

  it("maps blocked errors to safe Action and HTTP 429 responses", async () => {
    const error = new RateLimitExceededError(blockedResult);
    const actionError = toRateLimitActionError(error);
    const response = toRateLimitResponse(error);

    expect(actionError).toEqual({
      code: "RATE_LIMIT_EXCEEDED",
      error: RATE_LIMIT_ERROR_MESSAGE,
      retryAfterSeconds: 37,
    });
    expect(response?.status).toBe(429);
    expect(response?.headers.get("retry-after")).toBe("37");
    await expect(response?.json()).resolves.toEqual({
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: RATE_LIMIT_ERROR_MESSAGE,
      },
    });
    expect(toRateLimitActionError(new Error("other"))).toBeNull();
    expect(toRateLimitResponse(new Error("other"))).toBeNull();
  });
});
