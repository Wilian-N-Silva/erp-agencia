import { describe, expect, it } from "vitest";

import {
  canManageSettings,
  canReadSettings,
  normalizeRoleSelection,
  parseSettingValue,
  stringifySettingValue,
} from "@/features/settings/rules";
import { createAccessContext } from "@/lib/dal";

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
