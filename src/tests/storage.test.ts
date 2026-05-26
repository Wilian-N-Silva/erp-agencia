import { describe, expect, it } from "vitest";

import {
  createStorageKey,
  getSha256Hex,
  getStorageConfig,
} from "@/lib/storage";

describe("storage configuration", () => {
  it("falls back to local storage when R2 credentials are incomplete", () => {
    expect(
      getStorageConfig({
        STORAGE_ACCESS_KEY_ID: "key",
        STORAGE_BUCKET: "bucket",
      }).provider,
    ).toBe("local");
  });

  it("uses R2 when endpoint, bucket and keys are configured", () => {
    const config = getStorageConfig({
      STORAGE_ACCESS_KEY_ID: "key",
      STORAGE_BUCKET: "bucket",
      STORAGE_ENDPOINT: "https://account.r2.cloudflarestorage.com/",
      STORAGE_SECRET_ACCESS_KEY: "secret",
    });

    expect(config.provider).toBe("r2");
    expect(config.r2Endpoint).toBe("https://account.r2.cloudflarestorage.com");
    expect(config.r2Region).toBe("auto");
  });

  it("creates safe object keys and checksums", () => {
    const key = createStorageKey({
      fileName: "Contrato PJ Exemplo.pdf",
      organizationId: "org_1",
      prefix: "documents/employee",
    });

    expect(key).toMatch(/^documents\/employee\/org_1\/.+-contrato-pj-exemplo.pdf$/);
    expect(getSha256Hex(Buffer.from("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
