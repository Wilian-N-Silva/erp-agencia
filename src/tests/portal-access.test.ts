import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentAccessContext: vi.fn(),
  getPortalEmployeeSummary: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();

  return {
    ...actual,
    cache: <Result>(operation: () => Result) => operation,
  };
});
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));
vi.mock("@/lib/dal", () => ({
  getCurrentAccessContext: mocks.getCurrentAccessContext,
}));
vi.mock("@/features/portal/dal", () => ({
  getPortalEmployeeSummary: mocks.getPortalEmployeeSummary,
}));

import { getCurrentPortalEmployeeAccess } from "@/features/portal/access";

const linkedContext = {
  employeeId: "30000000-0000-4000-8000-000000000001",
  organizationId: "10000000-0000-4000-8000-000000000001",
  permissions: [],
  roles: ["employee"],
  userId: "user-1",
};
const employee = {
  areaName: "Operations",
  employmentType: "clt",
  fullName: "Maria Silva",
  id: linkedContext.employeeId,
  positionName: "Analyst",
  registrationNumber: "FG-001",
};

describe("current portal employee access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rechecks the current link and returns blocked access after unlink", async () => {
    mocks.getCurrentAccessContext
      .mockResolvedValueOnce(linkedContext)
      .mockResolvedValueOnce({ ...linkedContext, employeeId: null });
    mocks.getPortalEmployeeSummary
      .mockResolvedValueOnce(employee)
      .mockResolvedValueOnce(null);

    await expect(getCurrentPortalEmployeeAccess()).resolves.toEqual({
      context: linkedContext,
      employee,
    });
    await expect(getCurrentPortalEmployeeAccess()).resolves.toBeNull();

    expect(mocks.getCurrentAccessContext).toHaveBeenCalledTimes(2);
    expect(mocks.getPortalEmployeeSummary).toHaveBeenCalledTimes(2);
  });

  it("redirects unauthenticated access before querying employee data", async () => {
    mocks.getCurrentAccessContext.mockResolvedValue(null);
    mocks.redirect.mockImplementation(() => {
      throw new Error("redirect:/login");
    });

    await expect(getCurrentPortalEmployeeAccess()).rejects.toThrow(
      "redirect:/login",
    );
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
    expect(mocks.getPortalEmployeeSummary).not.toHaveBeenCalled();
  });
});
