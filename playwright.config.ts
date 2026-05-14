import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command:
      "powershell -NoProfile -Command \"$env:BETTER_AUTH_URL='http://127.0.0.1:3100'; $env:APP_URL='http://127.0.0.1:3100'; $env:NEXT_PUBLIC_BETTER_AUTH_URL='http://127.0.0.1:3100'; $env:BETTER_AUTH_TRUSTED_ORIGINS='http://127.0.0.1:3100'; npm.cmd run start -- --hostname 127.0.0.1 --port 3100\"",
    reuseExistingServer: false,
    timeout: 120_000,
    url: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100/login",
  },
});
