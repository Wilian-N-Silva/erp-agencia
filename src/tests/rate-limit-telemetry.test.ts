import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  writeAuditLog: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));

import { writeRateLimitSecurityEvent } from "@/lib/rate-limit/telemetry";

describe("rate-limit security telemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.writeAuditLog.mockResolvedValue(undefined);
  });

  it("writes a safe aggregated event without the raw bucket identity", async () => {
    const context = {
      organizationId: "10000000-0000-4000-8000-000000000001",
      userId: "user-1",
    };

    await writeRateLimitSecurityEvent({
      action: "upload",
      context,
      result: {
        allowed: false,
        limit: 20,
        remaining: 0,
        resetAt: new Date("2026-08-18T12:10:00.000Z"),
        retryAfterSeconds: 37,
        shouldEmitSecurityEvent: true,
      },
    });

    expect(mocks.writeAuditLog).toHaveBeenCalledWith(context, {
      action: "rate_limit_exceeded",
      entityType: "rate_limit",
      metadata: {
        aggregation: "first_blocked_attempt_per_window",
        limit: 20,
        rateLimitAction: "upload",
        resetAt: "2026-08-18T12:10:00.000Z",
      },
    });
    expect(JSON.stringify(mocks.writeAuditLog.mock.calls)).not.toContain("keyHash");
  });
});
