import { createHash, createHmac, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type StorageProvider = "local" | "r2";

export type StorageConfig = {
  bucket: string | null;
  localDir: string;
  provider: StorageProvider;
  r2AccessKeyId?: string;
  r2Endpoint?: string;
  r2Region: string;
  r2SecretAccessKey?: string;
};

export type PutStorageObjectInput = {
  body: Buffer;
  contentType: string;
  key: string;
};

export type StoredObject = {
  bucket: string | null;
  key: string;
  provider: StorageProvider;
};

const emptyPayloadHash = createHash("sha256").update("").digest("hex");

export function getStorageConfig(
  env: Record<string, string | undefined> = process.env,
): StorageConfig {
  const bucket = env.STORAGE_BUCKET || null;
  const r2Endpoint = normalizeR2Endpoint(env);
  const hasR2Config = Boolean(
    bucket &&
      r2Endpoint &&
      env.STORAGE_ACCESS_KEY_ID &&
      env.STORAGE_SECRET_ACCESS_KEY,
  );

  return {
    bucket,
    localDir: env.LOCAL_UPLOAD_DIR || "uploads",
    provider: hasR2Config ? "r2" : "local",
    r2AccessKeyId: env.STORAGE_ACCESS_KEY_ID,
    r2Endpoint,
    r2Region: env.STORAGE_REGION || "auto",
    r2SecretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
  };
}

export function createStorageKey(input: {
  fileName: string;
  organizationId: string;
  prefix: string;
}) {
  const safeFileName = input.fileName
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return [
    input.prefix.replace(/[^\w/-]+/g, "-"),
    input.organizationId,
    `${randomUUID()}-${safeFileName || "file"}`,
  ].join("/");
}

export function getSha256Hex(body: Buffer) {
  return createHash("sha256").update(body).digest("hex");
}

export async function putStorageObject(
  input: PutStorageObjectInput,
  config = getStorageConfig(),
): Promise<StoredObject> {
  const key = normalizeObjectKey(input.key);

  if (config.provider === "r2") {
    await putR2Object({ ...input, key }, config);

    return {
      bucket: config.bucket,
      key,
      provider: "r2",
    };
  }

  const targetPath = resolveLocalObjectPath(config.localDir, key);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, input.body);

  return {
    bucket: null,
    key,
    provider: "local",
  };
}

export async function getStorageObject(
  object: Pick<StoredObject, "bucket" | "key" | "provider">,
  config = getStorageConfig(),
) {
  const key = normalizeObjectKey(object.key);

  if (object.provider === "r2") {
    return getR2Object(key, {
      ...config,
      bucket: object.bucket ?? config.bucket,
      provider: "r2",
    });
  }

  return readFile(resolveLocalObjectPath(config.localDir, key));
}

function normalizeR2Endpoint(env: Record<string, string | undefined>) {
  if (env.STORAGE_ENDPOINT) {
    return env.STORAGE_ENDPOINT.replace(/\/+$/g, "");
  }

  if (env.STORAGE_ACCOUNT_ID) {
    return `https://${env.STORAGE_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  }

  return undefined;
}

function normalizeObjectKey(key: string) {
  const normalized = key.replace(/\\/g, "/").replace(/^\/+/g, "");

  if (!normalized || normalized.split("/").some((segment) => !segment || segment === "..")) {
    throw new Error("Invalid storage key.");
  }

  return normalized;
}

function resolveLocalObjectPath(localDir: string, key: string) {
  const baseDir = path.resolve(process.cwd(), localDir);
  const targetPath = path.resolve(baseDir, key);

  if (!targetPath.startsWith(`${baseDir}${path.sep}`)) {
    throw new Error("Invalid local storage path.");
  }

  return targetPath;
}

async function putR2Object(input: PutStorageObjectInput, config: StorageConfig) {
  const response = await fetch(buildR2Url(input.key, config), {
    body: toArrayBuffer(input.body),
    headers: signR2Headers({
      bodyHash: getSha256Hex(input.body),
      config,
      contentType: input.contentType,
      key: input.key,
      method: "PUT",
    }),
    method: "PUT",
  });

  if (!response.ok) {
    throw new Error(`R2 upload failed with status ${response.status}.`);
  }
}

async function getR2Object(key: string, config: StorageConfig) {
  const response = await fetch(buildR2Url(key, config), {
    headers: signR2Headers({
      bodyHash: emptyPayloadHash,
      config,
      key,
      method: "GET",
    }),
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(`R2 download failed with status ${response.status}.`);
  }

  return Buffer.from(await response.arrayBuffer());
}

function buildR2Url(key: string, config: StorageConfig) {
  assertR2Config(config);
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");

  return `${config.r2Endpoint}/${config.bucket}/${encodedKey}`;
}

function signR2Headers(input: {
  bodyHash: string;
  config: StorageConfig;
  contentType?: string;
  key: string;
  method: "GET" | "PUT";
}) {
  const config = input.config;
  assertR2Config(config);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const url = new URL(buildR2Url(input.key, config));
  const headers: Record<string, string> = {
    host: url.host,
    "x-amz-content-sha256": input.bodyHash,
    "x-amz-date": amzDate,
  };

  if (input.contentType) {
    headers["content-type"] = input.contentType;
  }

  const signedHeaderKeys = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaderKeys
    .map((key) => `${key}:${headers[key]}\n`)
    .join("");
  const signedHeaders = signedHeaderKeys.join(";");
  const canonicalRequest = [
    input.method,
    url.pathname,
    "",
    canonicalHeaders,
    signedHeaders,
    input.bodyHash,
  ].join("\n");
  const credentialScope = `${dateStamp}/${config.r2Region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");
  const signingKey = getSignatureKey(
    config.r2SecretAccessKey,
    dateStamp,
    config.r2Region,
    "s3",
  );
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

  return {
    ...headers,
    authorization: `AWS4-HMAC-SHA256 Credential=${config.r2AccessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

function getSignatureKey(secret: string, dateStamp: string, region: string, service: string) {
  const dateKey = createHmac("sha256", `AWS4${secret}`).update(dateStamp).digest();
  const regionKey = createHmac("sha256", dateKey).update(region).digest();
  const serviceKey = createHmac("sha256", regionKey).update(service).digest();

  return createHmac("sha256", serviceKey).update("aws4_request").digest();
}

function assertR2Config(
  config: StorageConfig,
): asserts config is StorageConfig & {
  bucket: string;
  r2AccessKeyId: string;
  r2Endpoint: string;
  r2SecretAccessKey: string;
} {
  if (!config.bucket || !config.r2AccessKeyId || !config.r2Endpoint || !config.r2SecretAccessKey) {
    throw new Error("R2 storage is not configured.");
  }
}

function toArrayBuffer(buffer: Buffer) {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
}
