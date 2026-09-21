import { loadEnvFile } from "node:process";

import { defineConfig } from "vitest/config";

function loadOptionalEnvFile(path?: string) {
  try {
    loadEnvFile(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

// Node preserves variables already present in process.env. Loading the
// test-specific file first gives it precedence over the local development
// fallback while still allowing CI/shell variables to override both.
loadOptionalEnvFile(".env.test.local");
loadOptionalEnvFile();

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    hookTimeout: 15_000,
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 15_000,
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
});
