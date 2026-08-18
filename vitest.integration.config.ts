import { loadEnvFile } from "node:process";

import { defineConfig } from "vitest/config";

try {
  loadEnvFile();
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
    throw error;
  }
}

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
