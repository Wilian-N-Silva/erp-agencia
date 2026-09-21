import { createHmac } from "node:crypto";
import { isIP } from "node:net";

import { z } from "zod";

import type { RateLimitAction } from "./config";

const authenticatedSubjectSchema = z
  .object({
    type: z.literal("authenticated"),
    organizationId: z.string().uuid(),
    userId: z.string().trim().min(1).max(255),
  })
  .strict();

const ipSubjectSchema = z
  .object({
    type: z.literal("ip"),
    ipAddress: z
      .string()
      .trim()
      .refine((value) => isIP(value) !== 0, "Invalid IP address."),
  })
  .strict();

export const rateLimitSubjectSchema = z.discriminatedUnion("type", [
  authenticatedSubjectSchema,
  ipSubjectSchema,
]);

export type RateLimitSubject = z.infer<typeof rateLimitSubjectSchema>;

export function hashRateLimitIdentity(
  action: RateLimitAction,
  subject: RateLimitSubject,
  secret: string,
) {
  const parsedSubject = rateLimitSubjectSchema.parse(subject);
  const normalizedIdentity =
    parsedSubject.type === "authenticated"
      ? [
          "v1",
          parsedSubject.type,
          parsedSubject.organizationId.toLowerCase(),
          parsedSubject.userId,
          action,
        ]
      : [
          "v1",
          parsedSubject.type,
          normalizeIp(parsedSubject.ipAddress),
          action,
        ];

  return createHmac("sha256", secret)
    .update(normalizedIdentity.join("\0"))
    .digest("hex");
}

function normalizeIp(ipAddress: string) {
  if (isIP(ipAddress) === 6) {
    return new URL(`http://[${ipAddress}]/`).hostname.slice(1, -1);
  }

  return ipAddress;
}
