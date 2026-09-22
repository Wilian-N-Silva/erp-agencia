import { describe, expect, it } from "vitest";

import {
  AccessDeniedError,
  assertCan,
  type PermissionKey,
} from "@/lib/rbac";
import { getSeedPermissionsForRoles } from "@/lib/db/seed-role-permissions";
import {
  canReadEmployeeTarget,
  createAccessContext as createRuntimeAccessContext,
} from "@/lib/dal";
import { createAccessContext } from "@/tests/helpers/access-context";

describe("RBAC seed policy", () => {
  it("keeps technical admin away from sensitive compensation and documents by default", () => {
    const permissions = getSeedPermissionsForRoles(["technical_admin"]);

    expect(permissions).toContain("settings.manage");
    expect(permissions).not.toContain("compensation.read");
    expect(permissions).not.toContain("documents.read_sensitive");
    expect(permissions).not.toContain("finance.read");
  });

  it("grants finance access without personal document access", () => {
    const permissions = getSeedPermissionsForRoles(["finance"]);

    expect(permissions).toContain("finance.write");
    expect(permissions).toContain("invoices.approve");
    expect(permissions).not.toContain("documents.read_sensitive");
  });

  it("limits employees to own-scope permissions", () => {
    const permissions = getSeedPermissionsForRoles(["employee"]);

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

  it("does not infer runtime permissions from role names", () => {
    const context = createRuntimeAccessContext({
      permissions: [],
      roles: ["finance"],
      userId: "user_1",
    });

    expect(context.roles).toEqual(["finance"]);
    expect(context.permissions).toEqual([]);
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
