import type { NextRequest } from "next/server";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

const mocks = vi.hoisted(() => ({
  getCurrentAccessContext: vi.fn(),
  getDocumentForAccess: vi.fn(),
  getFinanceDashboard: vi.fn(),
  getStorageObject: vi.fn(),
  insert: vi.fn(),
  listAuditLogs: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/audit", () => ({
  auditActions: [
    "auth.login",
    "auth.logout",
    "auth.denied",
    "create",
    "update",
    "delete",
    "export",
    "sensitive_read",
    "approve",
    "reject",
    "status_change",
    "permission_change",
    "rate_limit_exceeded",
  ],
  getRequestAuditMetadata: vi.fn(),
  writeAuditLog: mocks.writeAuditLog,
}));
vi.mock("@/lib/db", () => ({
  db: {
    insert: mocks.insert,
  },
}));
vi.mock("@/lib/dal", () => ({
  bindCurrentTenantContext: (operation: unknown) => operation,
  getCurrentAccessContext: mocks.getCurrentAccessContext,
}));
vi.mock("@/lib/rate-limit", () => ({
  enforceAuthenticatedRateLimit: vi.fn(),
  withRateLimitActionResult: (operation: unknown) => operation,
}));
vi.mock("@/lib/rbac", () => ({
  AccessDeniedError: class AccessDeniedError extends Error {},
  assertCan: vi.fn(),
  can: vi.fn().mockReturnValue(true),
  canAny: vi.fn().mockReturnValue(true),
}));
vi.mock("@/features/timeoff/rules", () => ({
  calculateBusinessDays: vi.fn(),
  canApproveTimeOff: vi.fn(),
  canCreateOwnTimeOff: vi.fn().mockReturnValue(true),
  canManageVacationBalance: vi.fn(),
  computeVacationPeriod: vi.fn(),
  timeOffTypeLabels: {
    absence: "Ausencia programada",
    planned_pause: "Pausa programada",
    vacation: "Ferias",
  },
  validateSoldDays: vi.fn(),
}));
vi.mock("@/features/documents/dal", () => ({
  getDocumentForAccess: mocks.getDocumentForAccess,
}));
vi.mock("@/features/audit/dal", () => ({
  listAuditLogs: mocks.listAuditLogs,
}));
vi.mock("@/features/finance/dal", () => ({
  getFinanceDashboard: mocks.getFinanceDashboard,
}));
vi.mock("@/features/audit/export", () => ({ buildAuditCsv: vi.fn() }));
vi.mock("@/features/finance/export", () => ({ buildFinanceCsv: vi.fn() }));
vi.mock("@/lib/storage", () => ({
  getStorageObject: mocks.getStorageObject,
}));

import { GET as downloadDocument } from "@/app/(private)/app/documentos/[id]/download/route";
import { GET as exportAudit } from "@/app/(private)/app/auditoria/exportar/route";
import { GET as exportFinance } from "@/app/(private)/app/financeiro/exportar/route";
import {
  parseAuditExportFilters,
} from "@/features/audit/rules";
import {
  normalizeMoneyInput,
  parseFinanceExportFilters,
} from "@/features/finance/rules";
import { createTimeOffRequestAction } from "@/features/timeoff/actions";
import { isIsoDate, isIsoMonth } from "@/lib/validation";

const context = {
  employeeId: "30000000-0000-4000-8000-000000000001",
  organizationId: "10000000-0000-4000-8000-000000000001",
  roles: ["employee"],
  userId: "user-1",
};

describe("Server Action input validation audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentAccessContext.mockResolvedValue(context);
    mocks.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "time-off-1" }]),
      }),
    });
  });

  it("ignores reserved Next.js Action metadata before strict validation", async () => {
    const formData = createTimeOffForm();
    formData.set("$ACTION_ID_create-time-off", "");

    await expect(createTimeOffRequestAction(formData)).resolves.toBeUndefined();
    expect(mocks.insert).toHaveBeenCalledOnce();
    expect(mocks.writeAuditLog).toHaveBeenCalledOnce();
  });

  it("rejects a server-owned organization id before any write", async () => {
    const formData = createTimeOffForm();
    formData.set(
      "organizationId",
      "20000000-0000-4000-8000-000000000001",
    );

    await expect(createTimeOffRequestAction(formData)).rejects.toBeInstanceOf(
      ZodError,
    );
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("keeps every local Action object schema in strict mode", async () => {
    const featuresDirectory = join(process.cwd(), "src/features");
    const featureEntries = await readdir(featuresDirectory, {
      withFileTypes: true,
    });
    const actionSources = (
      await Promise.all(
        featureEntries
          .filter((entry) => entry.isDirectory())
          .map(async (entry) => {
            try {
              return await readFile(
                join(featuresDirectory, entry.name, "actions.ts"),
                "utf8",
              );
            } catch {
              return null;
            }
          }),
      )
    ).filter((source): source is string => source !== null);

    expect(actionSources.length).toBeGreaterThan(0);
    for (const source of actionSources) {
      expect(source).not.toContain("z.object(");
    }
  });
});

describe("route and export input validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentAccessContext.mockResolvedValue(context);
  });

  it("rejects unknown server-owned export fields", () => {
    expect(() =>
      parseAuditExportFilters(
        new URLSearchParams({ organizationId: context.organizationId }),
      ),
    ).toThrow(ZodError);
    expect(() =>
      parseFinanceExportFilters(
        new URLSearchParams({ approvedByUserId: context.userId }),
      ),
    ).toThrow(ZodError);
  });

  it("rejects invalid export values instead of silently normalizing them", () => {
    expect(() =>
      parseAuditExportFilters(
        new URLSearchParams({ dateFrom: "2026-02-30" }),
      ),
    ).toThrow(ZodError);
    expect(() =>
      parseFinanceExportFilters(
        new URLSearchParams({ entryStatus: "paid" }),
      ),
    ).toThrow(ZodError);
  });

  it.each([
    [
      "audit",
      exportAudit,
      "organizationId=10000000-0000-4000-8000-000000000001",
    ],
    ["finance", exportFinance, "entryStatus=paid"],
  ])("returns 400 from the %s export API for invalid filters", async (
    _label,
    route,
    query,
  ) => {
    const response = await route(createRequest(`/app/exportar?${query}`));

    expect(response.status).toBe(400);
    expect(mocks.listAuditLogs).not.toHaveBeenCalled();
    expect(mocks.getFinanceDashboard).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("rejects a malformed document id before the tenant DAL", async () => {
    const response = await downloadDocument(
      createRequest("/app/documentos/not-a-uuid/download"),
      { params: Promise.resolve({ id: "not-a-uuid" }) },
    );

    expect(response.status).toBe(404);
    expect(mocks.getDocumentForAccess).not.toHaveBeenCalled();
    expect(mocks.getStorageObject).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });
});

describe("bounded scalar validation", () => {
  it("validates real calendar dates and months", () => {
    expect(isIsoDate("2024-02-29")).toBe(true);
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoMonth("2026-12")).toBe(true);
    expect(isIsoMonth("2026-13")).toBe(false);
  });

  it("rejects money above the database numeric(12,2) range", () => {
    expect(normalizeMoneyInput("9999999999.99")).toBe("9999999999.99");
    expect(() => normalizeMoneyInput("10000000000.00")).toThrow(
      "supported range",
    );
  });
});

function createTimeOffForm() {
  const formData = new FormData();
  formData.set("type", "vacation");
  formData.set("startDate", "2026-09-01");
  formData.set("endDate", "2026-09-05");
  return formData;
}

function createRequest(path: string) {
  const url = new URL(path, "https://erp.example.test");

  return {
    headers: new Headers(),
    nextUrl: url,
    url: url.toString(),
  } as unknown as NextRequest;
}
