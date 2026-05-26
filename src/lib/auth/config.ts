import { getOptionalEnv } from "@/lib/env";

export const DEFAULT_AUTH_CALLBACK_URL = "/app";

function unique(values: string[]) {
  return [...new Set(values)];
}

function parseBoolean(value?: string) {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return undefined;
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

let warnedAboutBaseUrl = false;

export function getAuthBaseUrl() {
  const url =
    getOptionalEnv("BETTER_AUTH_URL") ??
    getOptionalEnv("APP_URL") ??
    "http://localhost:3000";

  if (
    !warnedAboutBaseUrl &&
    process.env.NODE_ENV === "production" &&
    (!url.startsWith("https://") || /\b(localhost|127\.0\.0\.1)\b/.test(url))
  ) {
    warnedAboutBaseUrl = true;
    console.warn(
      `[auth] BETTER_AUTH_URL is not a secure public URL in production: ${url}`,
    );
  }

  return url;
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

export function isEmailPasswordAuthEnabled() {
  return (
    parseBoolean(getOptionalEnv("ENABLE_EMAIL_PASSWORD_AUTH")) ??
    process.env.NODE_ENV !== "production"
  );
}

export function isEmailPasswordSignUpEnabled() {
  if (!isEmailPasswordAuthEnabled()) {
    return false;
  }

  return (
    parseBoolean(getOptionalEnv("ENABLE_EMAIL_PASSWORD_SIGN_UP")) ??
    process.env.NODE_ENV !== "production"
  );
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

export function isGoogleAuthConfigured() {
  return Boolean(getGoogleAuthConfig());
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
