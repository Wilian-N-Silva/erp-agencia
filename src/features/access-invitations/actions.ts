"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { writeAuditLog } from "@/lib/audit";
import {
  getAllowedEmailDomain,
  isEmailAllowedForDomain,
} from "@/lib/auth/config";
import { db } from "@/lib/db";
import {
  accessInvitations,
  appSettings,
  users,
} from "@/lib/db/schema";
import {
  bindCurrentTenantContext,
  getCurrentAccessContext,
  type AccessContext,
} from "@/lib/dal";
import {
  enforceAuthenticatedRateLimit,
  withRateLimitActionResult,
} from "@/lib/rate-limit";
import { AccessDeniedError, assertCan } from "@/lib/rbac";

import {
  getAllowedInvitationDomain,
  invitationExpiryOptions,
  normalizeInvitationEmail,
  normalizeInvitationRoles,
} from "./rules";

const createInvitationSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(180),
    expiresInDays: z.coerce
      .number()
      .int()
      .refine(
        (value) =>
          invitationExpiryOptions.includes(
            value as (typeof invitationExpiryOptions)[number],
          ),
        "Invalid invitation expiry.",
      ),
  })
  .strict();

type AuthorizedContext = AccessContext & { organizationId: string };

async function createAccessInvitationAction(formData: FormData) {
  const context = await requireInvitationManagerContext();
  await enforceAuthenticatedRateLimit("invitation", context);

  const input = createInvitationSchema.parse({
    email: formData.get("email"),
    expiresInDays: formData.get("expiresInDays"),
  });
  const email = normalizeInvitationEmail(input.email);
  const roleKeys = normalizeInvitationRoles(
    formData.getAll("roleKeys").map(String),
  );

  if (roleKeys.length === 0) {
    throw new Error("At least one valid role is required.");
  }

  await assertInvitationDomainIsAllowed(email, context.organizationId);

  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser) {
    throw new Error("This email already has a user account.");
  }

  const [before] = await db
    .select()
    .from(accessInvitations)
    .where(
      and(
        eq(accessInvitations.organizationId, context.organizationId),
        eq(accessInvitations.email, email),
      ),
    )
    .limit(1);
  const expiresAt = addDays(new Date(), input.expiresInDays);
  const [after] = before
    ? await db
        .update(accessInvitations)
        .set({
          expiresAt,
          invitedByUserId: context.userId,
          roleKeys,
          updatedAt: new Date(),
          usedAt: null,
          usedByUserId: null,
        })
        .where(
          and(
            eq(accessInvitations.id, before.id),
            eq(accessInvitations.organizationId, context.organizationId),
          ),
        )
        .returning()
    : await db
        .insert(accessInvitations)
        .values({
          email,
          expiresAt,
          invitedByUserId: context.userId,
          organizationId: context.organizationId,
          roleKeys,
        })
        .returning();

  if (!after) {
    throw new Error("Could not persist access invitation.");
  }

  await writeAuditLog(context, {
    action: before ? "update" : "create",
    entityId: after.id,
    entityType: "access_invitation",
    before: before ?? undefined,
    after,
    metadata: {
      event: before ? "resent" : "invited",
    },
  });

  revalidatePath("/app/configuracoes");
}

async function assertInvitationDomainIsAllowed(
  email: string,
  organizationId: string,
) {
  const [setting] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(
      and(
        eq(appSettings.organizationId, organizationId),
        eq(appSettings.key, "allowed_email_domain"),
      ),
    )
    .limit(1);
  const organizationDomain = getAllowedInvitationDomain(setting?.value);
  const applicationDomain = getAllowedEmailDomain();

  if (
    !isEmailAllowedForDomain(email, organizationDomain) ||
    !isEmailAllowedForDomain(email, applicationDomain)
  ) {
    throw new Error("Email domain is not allowed for this organization.");
  }
}

async function requireInvitationManagerContext(): Promise<AuthorizedContext> {
  const context = await getCurrentAccessContext();

  if (!context) {
    redirect("/login");
  }

  assertCan("settings.manage", context);

  if (!context.organizationId) {
    throw new AccessDeniedError();
  }

  return {
    ...context,
    organizationId: context.organizationId,
  };
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export { tenantCreateAccessInvitationAction as createAccessInvitationAction };

const tenantCreateAccessInvitationAction = withRateLimitActionResult(
  bindCurrentTenantContext(createAccessInvitationAction),
);