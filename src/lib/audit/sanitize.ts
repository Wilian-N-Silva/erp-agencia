import type { AuditJson, AuditSnapshot } from "./types";

const sensitiveKeyFragments = [
  "password",
  "secret",
  "token",
  "credential",
  "authorization",
  "cookie",
  "refresh",
  "access_token",
  "id_token",
  "storage_access_key",
];

export const redactedAuditValue = "[REDACTED]";

export function toAuditSnapshot(value: unknown): AuditSnapshot {
  const jsonValue = toAuditJson(value);

  if (!jsonValue || Array.isArray(jsonValue) || typeof jsonValue !== "object") {
    return null;
  }

  return jsonValue;
}

export function toAuditJson(value: unknown, key?: string): AuditJson {
  if (key && shouldRedactKey(key)) {
    return redactedAuditValue;
  }

  if (value === null || value === undefined) {
    return null;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => toAuditJson(item));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        toAuditJson(entryValue, entryKey),
      ]),
    );
  }

  return String(value);
}

export function shouldRedactKey(key: string) {
  const normalizedKey = key.toLowerCase();

  return sensitiveKeyFragments.some((fragment) => normalizedKey.includes(fragment));
}
