import { getOptionalEnv } from "@/lib/env";

export const DEFAULT_AUTH_CALLBACK_URL = "/app";

function unique(values: string[]) {
  return [...new Set(values)];
}

export function normalizeEmailDomain(domain?: string) {
  const normalized = domain?.trim().toLowerCase().replace(/^@/, "");

  return normalized || undefined;
}

export function isEmailAllowedForDomain(email: string, domain?: string) {
  const normalizedDomain = normalizeEmailDomain(domain);

  if (!normalizedDomain) {
    return true;
  }

  return email.trim().toLowerCase().endsWith(`@${normalizedDomain}`);
}

export function getAllowedEmailDomain() {
  return normalizeEmailDomain(getOptionalEnv("ALLOWED_EMAIL_DOMAIN"));
}

export function getAuthBaseUrl() {
  return (
    getOptionalEnv("BETTER_AUTH_URL") ??
    getOptionalEnv("APP_URL") ??
    "http://localhost:3000"
  );
}

export function getAuthSecret() {
  return getOptionalEnv("BETTER_AUTH_SECRET") ?? getBuildOnlyAuthSecret();
}

export function getTrustedOrigins() {
  const configuredOrigins = [
    getOptionalEnv("APP_URL"),
    getOptionalEnv("BETTER_AUTH_URL"),
    ...parseTrustedOrigins(getOptionalEnv("BETTER_AUTH_TRUSTED_ORIGINS")),
  ];

  return unique(configuredOrigins.flatMap((origin) => normalizeOrigin(origin)));
}

function getBuildOnlyAuthSecret() {
  return process.env.npm_lifecycle_event === "build"
    ? "build-time-only-better-auth-secret"
    : undefined;
}

export function getGoogleAuthConfig() {
  const clientId = getOptionalEnv("GOOGLE_CLIENT_ID");
  const clientSecret = getOptionalEnv("GOOGLE_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    return undefined;
  }

  return {
    clientId,
    clientSecret,
    hd: getAllowedEmailDomain(),
  };
}

export function parseTrustedOrigins(value?: string) {
  return value
    ? value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
    : [];
}

export function normalizeOrigin(value?: string) {
  if (!value) {
    return [];
  }

  try {
    return [new URL(value).origin];
  } catch {
    return [];
  }
}
