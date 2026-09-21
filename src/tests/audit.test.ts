import { describe, expect, it } from "vitest";

import {
  canReadAuditLogs,
  createAuditLogValues,
  getRequestAuditMetadata,
  redactedAuditValue,
  shouldRedactKey,
  toAuditSnapshot,
} from "@/lib/audit";
import {
  applyAuditTextFilter,
  auditActionLabels,
  canExportAuditReport,
  canReadAuditPayloads,
  getVisibleAuditEntityTypes,
  normalizeAuditFilters,
} from "@/features/audit/rules";
import { createAccessContext } from "@/tests/helpers/access-context";

describe("audit payloads", () => {
  it("creates sanitized audit log values", () => {
    const context = createAccessContext({
      userId: "user_1",
      organizationId: "00000000-0000-0000-0000-000000000001",
      roles: ["finance"],
    });

    expect(
      createAuditLogValues(context, {
        action: "update",
        entityType: "financial_entry",
        entityId: "entry_1",
        before: { amount: "10.00", accessToken: "secret-token" },
        after: { amount: "20.00" },
        metadata: { source: "test", password: "hidden" },
        ipAddress: "127.0.0.1",
        userAgent: "vitest",
      }),
    ).toMatchObject({
      organizationId: "00000000-0000-0000-0000-000000000001",
      actorUserId: "user_1",
      action: "update",
      entityType: "financial_entry",
      entityId: "entry_1",
      before: {
        amount: "10.00",
        accessToken: redactedAuditValue,
      },
      metadata: {
        source: "test",
        password: redactedAuditValue,
      },
    });
  });

  it("requires organization context", () => {
    const context = createAccessContext({
      userId: "user_1",
      roles: ["employee"],
    });

    expect(() =>
      createAuditLogValues(context, {
        action: "sensitive_read",
        entityType: "employee",
      }),
    ).toThrow("Audit organization context is required.");
  });

  it("converts only object snapshots", () => {
    expect(toAuditSnapshot({ changedAt: new Date("2026-05-12T12:00:00.000Z") }))
      .toEqual({
        changedAt: "2026-05-12T12:00:00.000Z",
      });
    expect(toAuditSnapshot("not-object")).toBeNull();
  });
});

describe("audit request metadata", () => {
  it("extracts client ip and user agent", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.10, 10.0.0.1",
      "user-agent": "vitest",
    });

    expect(getRequestAuditMetadata(headers)).toEqual({
      ipAddress: "203.0.113.10",
      userAgent: "vitest",
    });
  });
});

describe("audit authorization", () => {
  it("allows audit readers", () => {
    const context = createAccessContext({
      userId: "director_1",
      roles: ["director"],
    });

    expect(canReadAuditLogs(context)).toBe(true);
  });

  it("keeps limited audit readers scoped and without payload export", () => {
    const context = createAccessContext({
      userId: "finance_1",
      roles: ["finance"],
    });

    expect(canReadAuditLogs(context)).toBe(true);
    expect(canReadAuditPayloads(context)).toBe(false);
    expect(canExportAuditReport(context)).toBe(false);
    expect(getVisibleAuditEntityTypes(context)).toContain("financial_entry");
    expect(getVisibleAuditEntityTypes(context)).not.toContain("user");
  });

  it("redacts sensitive key fragments", () => {
    expect(shouldRedactKey("refreshToken")).toBe(true);
    expect(shouldRedactKey("displayName")).toBe(false);
  });
});

describe("audit filters", () => {
  it("normalizes supported filters", () => {
    expect(
      normalizeAuditFilters({
        action: "update",
        dateFrom: "2026-05-01",
        dateTo: "invalid",
        q: " cliente ",
      }),
    ).toEqual({
      action: "update",
      dateFrom: "2026-05-01",
      dateTo: undefined,
      query: "cliente",
    });
  });

  it("matches text against labels, entity and actor fields", () => {
    const logs = [
      {
        action: "update",
        actorEmail: "financeiro@formula.local",
        actorName: "Financeiro Demo",
        entityId: "entry_1",
        entityType: "financial_entry",
      },
    ];

    expect(applyAuditTextFilter(logs, auditActionLabels.update)).toHaveLength(1);
    expect(applyAuditTextFilter(logs, "entrada financeira")).toHaveLength(1);
    expect(applyAuditTextFilter(logs, "sem resultado")).toHaveLength(0);
  });
});
