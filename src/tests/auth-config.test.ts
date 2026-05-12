import { describe, expect, it } from "vitest";

import {
  isEmailAllowedForDomain,
  normalizeEmailDomain,
  normalizeOrigin,
  parseTrustedOrigins,
  getAuthSecret,
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
});
