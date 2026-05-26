import { describe, expect, it } from "vitest";

import {
  AccessDeniedError,
  assertCan,
  getPermissionsForRoles,
  type PermissionKey,
} from "@/lib/rbac";
import { canReadEmployeeTarget, createAccessContext } from "@/lib/dal";

describe("RBAC policy", () => {
  it("keeps technical admin away from sensitive compensation and documents by default", () => {
    const permissions = getPermissionsForRoles(["technical_admin"]);

    expect(permissions).toContain("settings.manage");
    expect(permissions).not.toContain("compensation.read");
    expect(permissions).not.toContain("documents.read_sensitive");
    expect(permissions).not.toContain("finance.read");
  });

  it("grants finance access without personal document access", () => {
    const permissions = getPermissionsForRoles(["finance"]);

    expect(permissions).toContain("finance.write");
    expect(permissions).toContain("invoices.approve");
    expect(permissions).not.toContain("documents.read_sensitive");
  });

  it("limits employees to own-scope permissions", () => {
    const permissions = getPermissionsForRoles(["employee"]);

    expect(permissions).toContain("people.read_own");
    expect(permissions).toContain("reimbursements.read_own");
    expect(permissions).not.toContain("finance.read");
  });

  it("throws generic access denied errors", () => {
    const context = createAccessContext({
      userId: "user_1",
      roles: ["employee"],
    });

    expect(() => assertCan("finance.read", context)).toThrow(AccessDeniedError);
  });
});

describe("DAL access scope", () => {
  it("allows own employee records", () => {
    const context = createAccessContext({
      userId: "user_1",
      employeeId: "employee_1",
      roles: ["employee"],
    });

    expect(
      canReadEmployeeTarget(context, {
        employeeId: "employee_1",
      }),
    ).toBe(true);
  });

  it("allows leadership to read direct reports", () => {
    const context = createAccessContext({
      userId: "leader_1",
      employeeId: "leader_employee_1",
      roles: ["leadership"],
    });

    expect(
      canReadEmployeeTarget(context, {
        employeeId: "employee_2",
        managerEmployeeId: "leader_employee_1",
      }),
    ).toBe(true);
  });

  it("denies unrelated employee records without leaking record existence", () => {
    const context = createAccessContext({
      userId: "user_1",
      employeeId: "employee_1",
      roles: ["employee"],
    });
    const sensitivePermission: PermissionKey = "finance.read";

    expect(
      canReadEmployeeTarget(context, {
        employeeId: "employee_2",
      }),
    ).toBe(false);
    expect(() => assertCan(sensitivePermission, context)).toThrow("Access denied.");
  });
});
