import type { RequestAuditMetadata } from "./types";

type HeaderReader = Pick<Headers, "get">;

export function getRequestAuditMetadata(headers?: HeaderReader): RequestAuditMetadata {
  if (!headers) {
    return {};
  }

  return {
    ipAddress: getClientIp(headers),
    userAgent: headers.get("user-agent") ?? undefined,
  };
}

function getClientIp(headers: HeaderReader) {
  const forwardedFor = headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim();
  }

  return headers.get("x-real-ip") ?? undefined;
}
