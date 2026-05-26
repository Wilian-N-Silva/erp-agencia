import { describe, expect, it } from "vitest";

import {
  isEmailAllowedForDomain,
  normalizeEmailDomain,
  normalizeOrigin,
  parseTrustedOrigins,
  getAuthSecret,
  isEmailPasswordAuthEnabled,
  isEmailPasswordSignUpEnabled,
} from "@/lib/auth/config";

describe("auth config helpers", () => {
  it("normalizes configured email domains", () => {
    expect(normalizeEmailDomain(" @Example.COM ")).toBe("example.com");
    expect(normalizeEmailDomain("")).toBeUndefined();
  });

  it("allows only matching email domains when configured", () => {
    expect(isEmailAllowedForDomain("user@example.com", "example.com")).toBe(true);
    expect(isEmailAllowedForDomain("user@other.com", "example.com")).toBe(false);
    expect(isEmailAllowedForDomain("user@other.com")).toBe(true);
  });

  it("parses trusted origin lists", () => {
    expect(parseTrustedOrigins("https://a.test, https://b.test ,,")).toEqual([
      "https://a.test",
      "https://b.test",
    ]);
  });

  it("normalizes URLs to origins", () => {
    expect(normalizeOrigin("https://example.com/path?q=1")).toEqual([
      "https://example.com",
    ]);
    expect(normalizeOrigin("not a url")).toEqual([]);
  });

  it("does not provide a runtime fallback auth secret outside build", () => {
    delete process.env.BETTER_AUTH_SECRET;
    process.env.npm_lifecycle_event = "test";

    expect(getAuthSecret()).toBeUndefined();
  });

  it("defaults email password auth to non-production environments", () => {
    delete process.env.ENABLE_EMAIL_PASSWORD_AUTH;
    delete process.env.ENABLE_EMAIL_PASSWORD_SIGN_UP;
    expect(isEmailPasswordAuthEnabled()).toBe(true);
    expect(isEmailPasswordSignUpEnabled()).toBe(true);
  });

  it("allows email password auth to be disabled explicitly", () => {
    process.env.ENABLE_EMAIL_PASSWORD_AUTH = "false";
    process.env.ENABLE_EMAIL_PASSWORD_SIGN_UP = "true";

    expect(isEmailPasswordAuthEnabled()).toBe(false);
    expect(isEmailPasswordSignUpEnabled()).toBe(false);
  });
});
