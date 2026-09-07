import "server-only";

import { randomUUID } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getServerEnvironment } from "@/lib/env";
import { sha256 } from "@/lib/security/crypto";
import { AuthServiceError } from "@/server/auth/errors";

export type RateLimitScope =
  | "LOGIN"
  | "RESET_REQUEST"
  | "RESET_SUBMIT"
  | "REGISTRATION_SUBMIT"
  | "REGISTRATION_UPLOAD"
  | "REGISTRATION_DOWNLOAD"
  // "Guidebook, ketentuan, dan pembayaran": GET /api/registration/
  // payment-code mutates state (burns an atomic per-period sequence
  // number) despite being a GET - rate limiting per IP is the primary
  // defense against someone exhausting the 3-digit code space, since this
  // endpoint deliberately does NOT run assertValidCsrf (see that route for
  // why a GET-shaped mutation doesn't fit that check).
  | "REGISTRATION_PAYMENT_CODE"
  | "ADMIN_FILE_ACCESS"
  | "ADMIN_EXPORT"
  | "ADMIN_BROADCAST_SEND";

export async function consumeAuthRateLimit(input: {
  scope: RateLimitScope;
  identity: string;
  ipHash: string;
  maximum?: number;
  now?: Date;
}): Promise<number> {
  const environment = getServerEnvironment();
  const now = input.now ?? new Date();
  const cutoff = new Date(now.getTime() - environment.LOGIN_RATE_LIMIT_WINDOW_SECONDS * 1000);
  const keyHash = sha256(`${input.identity}:${input.ipHash}`);
  const rows = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    INSERT INTO "auth_rate_limits"
      ("id", "scope", "keyHash", "count", "windowStartedAt", "updatedAt")
    VALUES
      (${randomUUID()}::uuid, ${input.scope}, ${keyHash}, 1, ${now}, ${now})
    ON CONFLICT ("scope", "keyHash") DO UPDATE SET
      "count" = CASE
        WHEN "auth_rate_limits"."windowStartedAt" <= ${cutoff}
        THEN 1 ELSE "auth_rate_limits"."count" + 1 END,
      "windowStartedAt" = CASE
        WHEN "auth_rate_limits"."windowStartedAt" <= ${cutoff}
        THEN ${now} ELSE "auth_rate_limits"."windowStartedAt" END,
      "updatedAt" = ${now}
    RETURNING "count"
  `);
  const count = rows[0]?.count ?? 1;
  const maximum = input.maximum ?? environment.LOGIN_RATE_LIMIT_MAX_ATTEMPTS;
  if (count > maximum) {
    throw new AuthServiceError(
      "RATE_LIMITED",
      429,
      "Terlalu banyak percobaan. Tunggu sebelum mencoba kembali.",
    );
  }
  return count;
}

