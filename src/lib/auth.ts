import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin as adminPlugin } from "better-auth/plugins";

import { prisma } from "@/lib/db";
import { getServerEnvironment } from "@/lib/env";
import {
  accessControl,
  authRoles,
} from "@/lib/auth/permissions";
import {
  hashPassword,
  verifyPassword,
} from "@/lib/auth/password";

const environment = getServerEnvironment();

export const auth = betterAuth({
  appName: "Sekolah Ormawa Eksekutif PKU",
  // Authentication failures are intentionally generic and are recorded through
  // the redacted application audit trail instead of Better Auth's diagnostic log.
  logger: {
    disabled: true,
  },
  baseURL: environment.NEXT_PUBLIC_APP_URL,
  secret: environment.AUTH_SECRET,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    resetPasswordTokenExpiresIn: environment.PASSWORD_RESET_TTL_SECONDS,
    revokeSessionsOnPasswordReset: true,
    password: {
      hash: hashPassword,
      verify: verifyPassword,
    },
    onPasswordReset: async ({ user }) => {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          mustChangePassword: false,
          temporaryPasswordExpiresAt: null,
          passwordChangedAt: new Date(),
        },
      });
    },
  },
  user: {
    additionalFields: {
      mustChangePassword: {
        type: "boolean",
        required: true,
        defaultValue: true,
        input: false,
      },
      temporaryPasswordExpiresAt: {
        type: "date",
        required: false,
        input: false,
      },
      departmentId: {
        type: "string",
        required: false,
        input: false,
      },
      isActive: {
        type: "boolean",
        required: true,
        defaultValue: true,
        input: false,
      },
      sessionVersion: {
        type: "number",
        required: true,
        defaultValue: 0,
        input: false,
      },
    },
  },
  session: {
    expiresIn: environment.SESSION_MAX_AGE_SECONDS,
    updateAge: environment.SESSION_UPDATE_AGE_SECONDS,
    additionalFields: {
      absoluteExpiresAt: {
        type: "date",
        required: true,
        input: false,
      },
      sessionVersion: {
        type: "number",
        required: true,
        defaultValue: 0,
        input: false,
      },
    },
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    modelName: "RateLimit",
    window: environment.LOGIN_RATE_LIMIT_WINDOW_SECONDS,
    max: environment.LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
    customRules: {
      "/sign-in/email": {
        window: environment.LOGIN_RATE_LIMIT_WINDOW_SECONDS,
        max: environment.LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
      },
      "/request-password-reset": {
        window: environment.LOGIN_RATE_LIMIT_WINDOW_SECONDS,
        max: 3,
      },
    },
  },
  advanced: {
    cookiePrefix: environment.SESSION_COOKIE_NAME,
    useSecureCookies: environment.NODE_ENV === "production",
    disableCSRFCheck: false,
    disableOriginCheck: false,
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      secure: environment.NODE_ENV === "production",
      path: "/",
    },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { sessionVersion: true },
          });
          if (!user) return false;
          return {
            data: {
              ...session,
              absoluteExpiresAt: new Date(
                Date.now() + environment.SESSION_MAX_AGE_SECONDS * 1000,
              ),
              sessionVersion: user.sessionVersion,
            },
          };
        },
      },
    },
  },
  trustedOrigins: [environment.NEXT_PUBLIC_APP_URL],
  plugins: [
    adminPlugin({
      ac: accessControl,
      roles: authRoles,
      defaultRole: "DEPT_PJ",
      bannedUserMessage: "Akun tidak aktif. Hubungi Super Admin Sekolah Ormawa.",
    }),
    nextCookies(),
  ],
});
