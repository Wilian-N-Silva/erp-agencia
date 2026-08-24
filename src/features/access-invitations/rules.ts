import { z } from "zod";

import {
  isEmailAllowedForDomain,
  normalizeEmailDomain,
} from "@/lib/auth/config";
import { roleKeys, type RoleKey } from "@/lib/rbac";

const roleKeySchema = z.enum(roleKeys);
export const invitationRoleKeysSchema = z
  .array(roleKeySchema)
  .min(1)
  .max(roleKeys.length)
  .transform((values) => [...new Set(values)].sort());

const allowedDomainSettingSchema = z
  .object({
    domain: z.string().nullable().optional(),
  })
  .strict();

export const invitationExpiryOptions = [1, 3, 7, 14, 30] as const;
export type InvitationExpiryDays = (typeof invitationExpiryOptions)[number];
export type AccessInvitationState = "expired" | "pending" | "used";

export function canInviteExistingAccount(input: {
  accountOrganizationId: string | null;
  hasExplicitRole: boolean;
  invitationOrganizationId: string;
}) {
  return (
    input.accountOrganizationId === input.invitationOrganizationId &&
    !input.hasExplicitRole
  );
}

export function normalizeInvitationEmail(email: string) {
  return email.trim().toLowerCase();
}

export function normalizeInvitationRoles(values: readonly string[]): RoleKey[] {
  const result = invitationRoleKeysSchema.safeParse(values);

  return result.success ? result.data : [];
}

export function getAllowedInvitationDomain(value: unknown) {
  const result = allowedDomainSettingSchema.safeParse(value);

  return result.success ? normalizeEmailDomain(result.data.domain ?? undefined) : undefined;
}

export function isInvitationEmailAllowed(
  email: string,
  organizationSetting: unknown,
  applicationDomain?: string,
) {
  const organizationDomain = getAllowedInvitationDomain(organizationSetting);

  return (
    isEmailAllowedForDomain(email, organizationDomain) &&
    isEmailAllowedForDomain(email, applicationDomain)
  );
}

export function getAccessInvitationState(
  invitation: { expiresAt: Date; usedAt: Date | null },
  now = new Date(),
): AccessInvitationState {
  if (invitation.usedAt) {
    return "used";
  }

  return invitation.expiresAt.getTime() <= now.getTime() ? "expired" : "pending";
}
