import { APIError, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { asc } from "drizzle-orm";

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

          const [defaultOrganization] = await db
            .select({ id: schema.organizations.id })
            .from(schema.organizations)
            .orderBy(asc(schema.organizations.name))
            .limit(1);

          return {
            data: {
              email,
              organizationId: defaultOrganization?.id ?? null,
            },
          };
        },
      },
    },
  },
  plugins: [nextCookies()],
});

export type Auth = typeof auth;
