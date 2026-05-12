import { APIError, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

import {
  getAllowedEmailDomain,
  getAuthBaseUrl,
  getAuthSecret,
  getGoogleAuthConfig,
  getTrustedOrigins,
  isEmailAllowedForDomain,
} from "./config";

const allowedEmailDomain = getAllowedEmailDomain();
const googleAuthConfig = getGoogleAuthConfig();

export const auth = betterAuth({
  appName: "Sistema Interno FG",
  baseURL: getAuthBaseUrl(),
  basePath: "/api/auth",
  trustedOrigins: getTrustedOrigins(),
  secret: getAuthSecret(),
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: false,
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

          return {
            data: {
              email,
            },
          };
        },
      },
    },
  },
  plugins: [nextCookies()],
});

export type Auth = typeof auth;
