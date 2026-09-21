import { APIError, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import {
  AccessInvitationAuthError,
  assertSessionUserIsAuthorized,
  consumeInvitationForUser,
  findSessionUserIdentity,
  findValidInvitationForEmail,
} from "@/features/access-invitations/auth";
import { createInvitationAuthLifecycle } from "@/features/access-invitations/lifecycle";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

import {
  getAllowedEmailDomain,
  getAuthBaseUrl,
  getAuthSecret,
  getGoogleAuthConfig,
  getTrustedOrigins,
  isEmailAllowedForDomain,
  isEmailPasswordAuthEnabled,
  isEmailPasswordSignUpEnabled,
} from "./config";

const allowedEmailDomain = getAllowedEmailDomain();
const googleAuthConfig = getGoogleAuthConfig();
const authSchema = {
  account: schema.accounts,
  session: schema.sessions,
  user: schema.users,
  verification: schema.verifications,
};
const invitationAuthLifecycle = createInvitationAuthLifecycle({
  assertSessionUserIsAuthorized,
  consumeInvitationForUser,
  findSessionUserIdentity,
  findValidInvitationForEmail,
});

export const auth = betterAuth({
  appName: "Sistema Interno FG",
  baseURL: getAuthBaseUrl(),
  basePath: "/api/auth",
  trustedOrigins: getTrustedOrigins(),
  secret: getAuthSecret(),
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),
  emailAndPassword: {
    enabled: isEmailPasswordAuthEnabled(),
    disableSignUp: !isEmailPasswordSignUpEnabled(),
    minPasswordLength: 8,
    autoSignIn: true,
  },
  socialProviders: googleAuthConfig
    ? {
        google: googleAuthConfig,
      }
    : {},
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const email = String(user.email ?? "").trim().toLowerCase();

          if (!isEmailAllowedForDomain(email, allowedEmailDomain)) {
            throw new APIError("FORBIDDEN", {
              code: "EMAIL_DOMAIN_NOT_ALLOWED",
              message: "Email domain is not allowed for this application.",
            });
          }

          const authorization = await withInvitationApiError(() =>
            invitationAuthLifecycle.requireInvitationForNewUser(email),
          );

          return {
            data: {
              accessStatus: "pending",
              email,
              isActive: false,
              organizationId: authorization.invitation.organizationId,
            },
          };
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          await withInvitationApiError(() =>
            invitationAuthLifecycle.authorizeSessionUser(session.userId),
          );
        },
      },
    },
  },
  plugins: [nextCookies()],
});

export type Auth = typeof auth;

async function withInvitationApiError<Result>(
  operation: () => Promise<Result>,
) {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AccessInvitationAuthError) {
      throw new APIError("FORBIDDEN", {
        code: error.code,
        message: "A valid access invitation is required.",
      });
    }

    throw error;
  }
}
