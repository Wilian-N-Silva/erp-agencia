import { describe, expect, it } from "vitest";

import { getOptionalEnv, getRequiredEnv } from "@/lib/env";

describe("environment helpers", () => {
  it("returns optional env values when present", () => {
    process.env.TEST_OPTIONAL_ENV = "available";

    expect(getOptionalEnv("TEST_OPTIONAL_ENV")).toBe("available");
  });

  it("throws for missing required env values", () => {
    delete process.env.TEST_REQUIRED_ENV;

    expect(() => getRequiredEnv("TEST_REQUIRED_ENV")).toThrow(
      "Missing required environment variable: TEST_REQUIRED_ENV",
    );
  });
});
