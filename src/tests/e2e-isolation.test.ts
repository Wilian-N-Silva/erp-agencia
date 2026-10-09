import { afterEach, expect, it, vi } from "vitest";
import { isolatedE2eDatabaseUrl } from "../../tests/e2e/helpers/isolated-database";

afterEach(() => vi.unstubAllEnvs());
it("permits fixture writes only in a matching, explicitly named local E2E database", () => {
  vi.stubEnv("DATABASE_DIRECT_URL", "postgres://migration@127.0.0.1:15433/erp_hml_e2e");
  vi.stubEnv("DATABASE_URL", "postgres://runtime@127.0.0.1:15433/erp_hml_e2e");
  expect(isolatedE2eDatabaseUrl()).toContain("/erp_hml_e2e");
  vi.stubEnv("DATABASE_DIRECT_URL", "postgres://migration@127.0.0.1:15432/erp_agencia");
  expect(() => isolatedE2eDatabaseUrl()).toThrow("dedicated local");
  vi.stubEnv("DATABASE_DIRECT_URL", "postgres://migration@example.com:15433/erp_hml_e2e");
  expect(() => isolatedE2eDatabaseUrl()).toThrow("dedicated local");
  vi.stubEnv("DATABASE_DIRECT_URL", "postgres://migration@127.0.0.1:15433/erp_hml_e2e");
  vi.stubEnv("DATABASE_URL", "postgres://runtime@127.0.0.1:15433/another_db");
  expect(() => isolatedE2eDatabaseUrl()).toThrow("matching runtime");
});
