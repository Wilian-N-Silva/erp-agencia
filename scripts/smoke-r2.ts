import { createHmac } from "node:crypto";

import {
  getSha256Hex,
  getStorageConfig,
  getStorageObject,
  putStorageObject,
} from "../src/lib/storage";

const config = getStorageConfig();

if (config.provider !== "r2") {
  console.error(
    "[smoke-r2] Storage is not configured for R2. Check STORAGE_BUCKET, STORAGE_ENDPOINT (or STORAGE_ACCOUNT_ID), STORAGE_ACCESS_KEY_ID, STORAGE_SECRET_ACCESS_KEY.",
  );
  process.exit(1);
}

const key = `smoke-tests/smoke-${Date.now()}.txt`;
const body = Buffer.from(
  `smoke-r2 ok at ${new Date().toISOString()}\n`,
  "utf8",
);

console.log("[smoke-r2] Config");
console.log(`  bucket:      ${config.bucket}`);
console.log(`  endpoint:    ${config.r2Endpoint}`);
console.log(`  region:      ${config.r2Region}`);
console.log(`  accessKeyId: ${config.r2AccessKeyId?.slice(0, 6)}…`);
console.log("");

async function main() {
  console.log(`[smoke-r2] PUT ${key} (${body.byteLength} bytes)`);
  const stored = await putStorageObject({
    body,
    contentType: "text/plain; charset=utf-8",
    key,
  });
  console.log(`  → stored bucket=${stored.bucket} key=${stored.key}`);

  console.log(`[smoke-r2] GET ${key}`);
  const fetched = await getStorageObject(stored);
  const fetchedText = fetched.toString("utf8");
  const ok =
    fetched.byteLength === body.byteLength &&
    getSha256Hex(fetched) === getSha256Hex(body);
  console.log(`  → got ${fetched.byteLength} bytes${ok ? " (checksum OK)" : " (checksum MISMATCH)"}`);
  console.log(`  → content: ${fetchedText.trim()}`);

  console.log(`[smoke-r2] DELETE ${key}`);
  await deleteR2Object(key);
  console.log("  → deleted");

  if (!ok) throw new Error("Content checksum mismatch on round-trip.");
  console.log("\n[smoke-r2] ✓ all good — credentials, bucket and endpoint work.");
}

async function deleteR2Object(objectKey: string) {
  const encodedKey = objectKey.split("/").map(encodeURIComponent).join("/");
  const url = `${config.r2Endpoint}/${config.bucket}/${encodedKey}`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const parsed = new URL(url);
  const headers: Record<string, string> = {
    host: parsed.host,
    "x-amz-content-sha256": getSha256Hex(Buffer.alloc(0)),
    "x-amz-date": amzDate,
  };
  const signedHeaderKeys = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaderKeys
    .map((k) => `${k}:${headers[k]}\n`)
    .join("");
  const signedHeaders = signedHeaderKeys.join(";");
  const canonicalRequest = [
    "DELETE",
    parsed.pathname,
    "",
    canonicalHeaders,
    signedHeaders,
    headers["x-amz-content-sha256"],
  ].join("\n");
  const credentialScope = `${dateStamp}/${config.r2Region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    getSha256Hex(Buffer.from(canonicalRequest, "utf8")),
  ].join("\n");
  const dateKey = createHmac("sha256", `AWS4${config.r2SecretAccessKey!}`)
    .update(dateStamp)
    .digest();
  const regionKey = createHmac("sha256", dateKey).update(config.r2Region).digest();
  const serviceKey = createHmac("sha256", regionKey).update("s3").digest();
  const signingKey = createHmac("sha256", serviceKey).update("aws4_request").digest();
  const signature = createHmac("sha256", signingKey)
    .update(stringToSign)
    .digest("hex");

  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      ...headers,
      authorization: `AWS4-HMAC-SHA256 Credential=${config.r2AccessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  });

  if (!response.ok && response.status !== 204) {
    throw new Error(`R2 delete failed with status ${response.status}.`);
  }
}

main().catch((err) => {
  console.error("\n[smoke-r2] ✗ failed");
  console.error(err);
  process.exit(1);
});
