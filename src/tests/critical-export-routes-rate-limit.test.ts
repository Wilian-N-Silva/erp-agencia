import type { NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildEmployeeProfile: vi.fn(),
  buildPeopleCsv: vi.fn(),
  canReadPeople: vi.fn(),
  enforceAuthenticatedRateLimit: vi.fn(),
  employeeProfileFileName: vi.fn(),
  getEmployeeDetail: vi.fn(),
  getCurrentAccessContext: vi.fn(),
  getFinanceDashboard: vi.fn(),
  listAuditLogs: vi.fn(),
  listEmployees: vi.fn(),
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
vi.mock("@/features/people/dal", () => ({
  getEmployeeDetail: mocks.getEmployeeDetail,
  listEmployees: mocks.listEmployees,
}));
vi.mock("@/features/people/rules", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/people/rules")>();

  return { ...actual, canReadPeople: mocks.canReadPeople };
});
vi.mock("@/features/people/export", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/people/export")>();

  return {
    ...actual,
    buildEmployeeProfile: mocks.buildEmployeeProfile,
    buildPeopleCsv: mocks.buildPeopleCsv,
    employeeProfileFileName: mocks.employeeProfileFileName,
  };
});
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
import { GET as getPeopleCsv } from "@/app/(private)/app/colaboradores/exportar/route";
import { GET as getEmployeeProfile } from "@/app/(private)/app/colaboradores/[id]/exportar/route";

const context = {
  organizationId: "10000000-0000-4000-8000-000000000001",
  roles: ["finance"],
  userId: "user-1",
};
const blockedError = new Error("rate limit exceeded");

describe("critical export route rate limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buildEmployeeProfile.mockReturnValue("employee-profile");
    mocks.buildPeopleCsv.mockReturnValue("people-csv");
    mocks.canReadPeople.mockReturnValue(true);
    mocks.employeeProfileFileName.mockReturnValue("ficha-fg-00001.txt");
    mocks.getCurrentAccessContext.mockResolvedValue(context);
    mocks.enforceAuthenticatedRateLimit.mockRejectedValue(blockedError);
    mocks.reportRateLimitSecurityEvent.mockResolvedValue(undefined);
    mocks.toRateLimitResponse.mockReturnValue(
      Response.json(
        { error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many requests." } },
        { headers: { "retry-after": "30" }, status: 429 },
      ),
    );
  });

  it.each([
    ["audit CSV", getAuditCsv],
    ["audit XLSX", getAuditXlsx],
    ["finance CSV", getFinanceCsv],
    ["finance XLSX", getFinanceXlsx],
    ["people CSV", getPeopleCsv],
  ])("returns 429 from the %s entrypoint before exporting", async (_label, route) => {
    const response = await route(createRequest());

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("30");
    expect(mocks.enforceAuthenticatedRateLimit).toHaveBeenCalledTimes(1);
    expect(mocks.enforceAuthenticatedRateLimit).toHaveBeenCalledWith("export", context);
    expect(mocks.reportRateLimitSecurityEvent).toHaveBeenCalledWith(blockedError);
    expect(mocks.toRateLimitResponse).toHaveBeenCalledWith(blockedError);
    expect(mocks.listAuditLogs).not.toHaveBeenCalled();
    expect(mocks.getFinanceDashboard).not.toHaveBeenCalled();
    expect(mocks.listEmployees).not.toHaveBeenCalled();
    expect(mocks.buildPeopleCsv).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("returns 429 with Retry-After before loading or building an employee profile", async () => {
    const response = await getEmployeeProfile(createRequest(), routeContext());

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("30");
    expect(mocks.enforceAuthenticatedRateLimit).toHaveBeenCalledWith(
      "export",
      context,
    );
    expect(mocks.reportRateLimitSecurityEvent).toHaveBeenCalledWith(blockedError);
    expect(mocks.getEmployeeDetail).not.toHaveBeenCalled();
    expect(mocks.buildEmployeeProfile).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("exports the permitted people CSV through the tenant-scoped DAL", async () => {
    const employee = { fullName: "Ana Lima", socialName: null };
    mocks.enforceAuthenticatedRateLimit.mockResolvedValue(undefined);
    mocks.listEmployees.mockResolvedValue([employee]);

    const response = await getPeopleCsv(createRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain(
      "colaboradores.csv",
    );
    await expect(response.text()).resolves.toBe("people-csv");
    expect(mocks.listEmployees).toHaveBeenCalledWith(context);
    expect(mocks.buildPeopleCsv).toHaveBeenCalledWith([employee]);
    expect(mocks.writeAuditLog).toHaveBeenCalledOnce();
  });

  it("exports a permitted employee profile using the authenticated tenant context", async () => {
    const employee = { id: "20000000-0000-4000-8000-000000000001" };
    mocks.enforceAuthenticatedRateLimit.mockResolvedValue(undefined);
    mocks.getEmployeeDetail.mockResolvedValue(employee);

    const response = await getEmployeeProfile(createRequest(), routeContext());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain(
      "ficha-fg-00001.txt",
    );
    await expect(response.text()).resolves.toBe("employee-profile");
    expect(mocks.getEmployeeDetail).toHaveBeenCalledWith(
      context,
      employee.id,
    );
    expect(mocks.buildEmployeeProfile).toHaveBeenCalledWith(employee);
    expect(mocks.writeAuditLog).toHaveBeenCalledOnce();
  });

  it("does not expose an employee profile when tenant scope rejects the id", async () => {
    mocks.enforceAuthenticatedRateLimit.mockResolvedValue(undefined);
    mocks.getEmployeeDetail.mockResolvedValue(null);

    const response = await getEmployeeProfile(createRequest(), routeContext());

    expect(response.status).toBe(404);
    expect(mocks.getEmployeeDetail).toHaveBeenCalledWith(
      context,
      "20000000-0000-4000-8000-000000000001",
    );
    expect(mocks.buildEmployeeProfile).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("checks people RBAC before consuming export capacity or querying profiles", async () => {
    mocks.canReadPeople.mockReturnValue(false);

    const response = await getEmployeeProfile(createRequest(), routeContext());

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://erp.example.test/acesso-negado",
    );
    expect(mocks.enforceAuthenticatedRateLimit).not.toHaveBeenCalled();
    expect(mocks.getEmployeeDetail).not.toHaveBeenCalled();
  });

  it("keeps active people downloads wired to server-side export routes", async () => {
    const [peopleView, employeeView] = await Promise.all([
      readFile(
        join(
          process.cwd(),
          "src/app/(private)/app/colaboradores/people-view.tsx",
        ),
        "utf8",
      ),
      readFile(
        join(
          process.cwd(),
          "src/app/(private)/app/colaboradores/[id]/employee-detail-view.tsx",
        ),
        "utf8",
      ),
    ]);

    expect(peopleView).toContain("/app/colaboradores/exportar?");
    expect(employeeView).toContain("/app/colaboradores/${employee.id}/exportar");
    expect(peopleView).not.toContain("new Blob");
    expect(employeeView).not.toContain("new Blob");
    expect(peopleView).not.toContain("@/features/people/export");
    expect(employeeView).not.toContain("@/features/people/export");
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

function routeContext() {
  return {
    params: Promise.resolve({
      id: "20000000-0000-4000-8000-000000000001",
    }),
  };
}
