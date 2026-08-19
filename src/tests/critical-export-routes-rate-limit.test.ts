import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enforceAuthenticatedRateLimit: vi.fn(),
  getCurrentAccessContext: vi.fn(),
  getFinanceDashboard: vi.fn(),
  listAuditLogs: vi.fn(),
  reportRateLimitSecurityEvent: vi.fn(),
  toRateLimitResponse: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("@/lib/dal", () => ({
  getCurrentAccessContext: mocks.getCurrentAccessContext,
}));
vi.mock("@/lib/rate-limit", () => ({
  enforceAuthenticatedRateLimit: mocks.enforceAuthenticatedRateLimit,
  reportRateLimitSecurityEvent: mocks.reportRateLimitSecurityEvent,
  toRateLimitResponse: mocks.toRateLimitResponse,
}));
vi.mock("@/lib/rbac", () => ({ can: vi.fn().mockReturnValue(true) }));
vi.mock("@/lib/audit", () => ({
  getRequestAuditMetadata: vi.fn(),
  writeAuditLog: mocks.writeAuditLog,
}));
vi.mock("@/features/audit/dal", () => ({ listAuditLogs: mocks.listAuditLogs }));
vi.mock("@/features/audit/rules", () => ({
  canExportAuditReport: vi.fn().mockReturnValue(true),
  normalizeAuditFilters: vi.fn(),
}));
vi.mock("@/features/audit/export", () => ({ buildAuditCsv: vi.fn() }));
vi.mock("@/features/audit/export-xlsx", () => ({ buildAuditXlsx: vi.fn() }));
vi.mock("@/features/finance/dal", () => ({
  getFinanceDashboard: mocks.getFinanceDashboard,
}));
vi.mock("@/features/finance/rules", () => ({ normalizeFinanceFilters: vi.fn() }));
vi.mock("@/features/finance/export", () => ({ buildFinanceCsv: vi.fn() }));
vi.mock("@/features/finance/export-xlsx", () => ({ buildFinanceXlsx: vi.fn() }));

import { GET as getAuditCsv } from "@/app/(private)/app/auditoria/exportar/route";
import { GET as getAuditXlsx } from "@/app/(private)/app/auditoria/exportar-xlsx/route";
import { GET as getFinanceCsv } from "@/app/(private)/app/financeiro/exportar/route";
import { GET as getFinanceXlsx } from "@/app/(private)/app/financeiro/exportar-xlsx/route";

const context = {
  organizationId: "10000000-0000-4000-8000-000000000001",
  roles: ["finance"],
  userId: "user-1",
};
const blockedError = new Error("rate limit exceeded");

describe("critical export route rate limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentAccessContext.mockResolvedValue(context);
    mocks.enforceAuthenticatedRateLimit.mockRejectedValue(blockedError);
    mocks.reportRateLimitSecurityEvent.mockResolvedValue(undefined);
    mocks.toRateLimitResponse.mockReturnValue(
      Response.json(
        { error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many requests." } },
        { status: 429 },
      ),
    );
  });

  it.each([
    ["audit CSV", getAuditCsv],
    ["audit XLSX", getAuditXlsx],
    ["finance CSV", getFinanceCsv],
    ["finance XLSX", getFinanceXlsx],
  ])("returns 429 from the %s entrypoint before exporting", async (_label, route) => {
    const response = await route(createRequest());

    expect(response.status).toBe(429);
    expect(mocks.enforceAuthenticatedRateLimit).toHaveBeenCalledTimes(1);
    expect(mocks.enforceAuthenticatedRateLimit).toHaveBeenCalledWith("export", context);
    expect(mocks.reportRateLimitSecurityEvent).toHaveBeenCalledWith(blockedError);
    expect(mocks.toRateLimitResponse).toHaveBeenCalledWith(blockedError);
    expect(mocks.listAuditLogs).not.toHaveBeenCalled();
    expect(mocks.getFinanceDashboard).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });
});

function createRequest() {
  const url = new URL("https://erp.example.test/app/exportar");
  return {
    headers: new Headers(),
    nextUrl: url,
    url: url.toString(),
  } as unknown as NextRequest;
}
