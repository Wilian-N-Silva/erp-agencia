import { describe, expect, it } from "vitest";

import {
  assertRoleReplacementKeepsSettingsAdministrator,
  canManageSettings,
  canReadSettings,
  lastSettingsAdministratorError,
  normalizeRoleSelection,
  parseSettingValue,
  stringifySettingValue,
} from "@/features/settings/rules";
import {
  updateUserAccessStatusSchema,
  updateUserEmployeeLinkSchema,
  updateUserRolesSchema,
} from "@/features/settings/schemas";
import { createAccessContext } from "@/tests/helpers/access-context";

describe("settings authorization", () => {
  it("allows read and manage according to permissions", () => {
    const technicalAdmin = createAccessContext({
      userId: "admin_1",
      roles: ["technical_admin"],
    });
    const director = createAccessContext({
      userId: "director_1",
      roles: ["director"],
    });

    expect(canReadSettings(technicalAdmin)).toBe(true);
    expect(canManageSettings(technicalAdmin)).toBe(true);
    expect(canReadSettings(director)).toBe(true);
    expect(canManageSettings(director)).toBe(false);
  });
});

describe("settings values", () => {
  it("parses json values and falls back to strings", () => {
    expect(parseSettingValue('{"provider":"local"}')).toEqual({ provider: "local" });
    expect(parseSettingValue("plain value")).toBe("plain value");
    expect(parseSettingValue("")).toBeNull();
  });

  it("formats stored settings for editing", () => {
    expect(stringifySettingValue({ bytes: 1024 })).toBe('{\n  "bytes": 1024\n}');
    expect(stringifySettingValue("local")).toBe("local");
  });

  it("normalizes role selections", () => {
    expect(normalizeRoleSelection(["finance", "finance", "invalid", "employee"])).toEqual([
      "employee",
      "finance",
    ]);
  });
});

describe("user access status input", () => {
  it.each(["pending", "active", "suspended", "revoked"] as const)(
    "accepts the explicit %s status",
    (accessStatus) => {
      expect(
        updateUserAccessStatusSchema.parse({
          accessStatus,
          userId: "user_1",
        }),
      ).toEqual({
        accessStatus,
        userId: "user_1",
      });
    },
  );

  it("rejects unknown statuses and server-owned payload fields", () => {
    expect(() =>
      updateUserAccessStatusSchema.parse({
        accessStatus: "disabled",
        userId: "user_1",
      }),
    ).toThrow();
    expect(() =>
      updateUserAccessStatusSchema.parse({
        accessStatus: "active",
        organizationId: "20000000-0000-4000-8000-000000000001",
        userId: "user_1",
      }),
    ).toThrow();
  });
});

describe("role replacement", () => {
  it("rejects unknown roles and server-owned fields", () => {
    expect(() =>
      updateUserRolesSchema.parse({
        roleKeys: ["finance", "root"],
        userId: "user_1",
      }),
    ).toThrow();
    expect(() =>
      updateUserRolesSchema.parse({
        organizationId: "20000000-0000-4000-8000-000000000001",
        roleKeys: ["finance"],
        userId: "user_1",
      }),
    ).toThrow();
  });

  it("protects only the last active persisted settings administrator", () => {
    expect(() =>
      assertRoleReplacementKeepsSettingsAdministrator({
        activeSettingsAdministratorCount: 1,
        replacementHasSettingsManage: false,
        targetHasSettingsManage: true,
        targetIsActive: true,
      }),
    ).toThrow(lastSettingsAdministratorError);
    expect(() =>
      assertRoleReplacementKeepsSettingsAdministrator({
        activeSettingsAdministratorCount: 2,
        replacementHasSettingsManage: false,
        targetHasSettingsManage: true,
        targetIsActive: true,
      }),
    ).not.toThrow();
    expect(() =>
      assertRoleReplacementKeepsSettingsAdministrator({
        activeSettingsAdministratorCount: 1,
        replacementHasSettingsManage: true,
        targetHasSettingsManage: true,
        targetIsActive: true,
      }),
    ).not.toThrow();
  });
});

describe("user employee link input", () => {
  const employeeId = "30000000-0000-4000-8000-000000000001";

  it("accepts an explicit employee or an explicit unlink", () => {
    expect(
      updateUserEmployeeLinkSchema.parse({ employeeId, userId: "user_1" }),
    ).toEqual({ employeeId, userId: "user_1" });
    expect(
      updateUserEmployeeLinkSchema.parse({ employeeId: "", userId: "user_1" }),
    ).toEqual({ employeeId: null, userId: "user_1" });
  });

  it("rejects invalid ids and server-owned organization fields", () => {
    expect(() =>
      updateUserEmployeeLinkSchema.parse({
        employeeId: "not-an-id",
        userId: "user_1",
      }),
    ).toThrow();
    expect(() =>
      updateUserEmployeeLinkSchema.parse({ userId: "user_1" }),
    ).toThrow();
    expect(() =>
      updateUserEmployeeLinkSchema.parse({
        employeeId,
        organizationId: "20000000-0000-4000-8000-000000000001",
        userId: "user_1",
      }),
    ).toThrow();
  });
});
