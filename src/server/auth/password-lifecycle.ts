import "server-only";

import { randomBytes, randomUUID } from "node:crypto";

import type { AdminContext } from "@/server/auth/guard";
import {
  GENERIC_RESET_REQUEST_MESSAGE,
  normalizeAdminEmail,
  validatePasswordPolicy,
} from "@/features/auth/contracts";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db";
import { getServerEnvironment } from "@/lib/env";
import { encryptJson, sha256 } from "@/lib/security/crypto";
import { AuthServiceError } from "@/server/auth/errors";
import { writeAuthAudit } from "@/server/auth/audit";
import { callInternalAuth, noStoreJson } from "@/server/auth/http";
import { consumeAuthRateLimit } from "@/server/auth/rate-limit";
import {
  clientIpHash,
  requestIdFromHeaders,
  safeUserAgent,
} from "@/server/auth/security";

export async function changeAuthenticatedPassword(input: {
  context: AdminContext;
  headers: Headers;
  currentPassword: string;
  newPassword: string;
  now?: Date;
}): Promise<Response> {
  const now = input.now ?? new Date();
  const environment = getServerEnvironment();
  const policyError = validatePasswordPolicy(input.newPassword, environment.PASSWORD_MAX_LENGTH);
  if (policyError) throw new AuthServiceError("INVALID_PASSWORD", 400, policyError);
  if (input.currentPassword.length > environment.PASSWORD_MAX_LENGTH) {
    throw new AuthServiceError("INVALID_PASSWORD", 400, "Password saat ini tidak valid.");
  }

  const credential = await prisma.account.findFirst({
    where: { userId: input.context.userId, providerId: "credential" },
    select: { id: true, password: true },
  });
  if (!credential?.password || !await verifyPassword({
    password: input.currentPassword,
    hash: credential.password,
  })) {
    throw new AuthServiceError("INVALID_PASSWORD", 400, "Password saat ini tidak valid.");
  }
  if (await verifyPassword({ password: input.newPassword, hash: credential.password })) {
    throw new AuthServiceError(
      "INVALID_PASSWORD",
      400,
      "Password baru harus berbeda dari password sementara/saat ini.",
    );
  }

  const passwordHash = await hashPassword(input.newPassword);
  await prisma.$transaction(async (transaction) => {
    await transaction.account.update({
      where: { id: credential.id },
      data: { password: passwordHash },
    });
    await transaction.user.update({
      where: { id: input.context.userId },
      data: {
        mustChangePassword: false,
        temporaryPasswordExpiresAt: null,
        passwordChangedAt: now,
        sessionVersion: { increment: 1 },
      },
    });
    await transaction.session.deleteMany({ where: { userId: input.context.userId } });
    await transaction.auditLog.create({
      data: {
        actorUserId: input.context.userId,
        action: "PASSWORD_CHANGE",
        entityType: "AUTH",
        entityId: input.context.userId,
        afterJson: { forcedStateCleared: true, sessionsRevoked: true },
        requestId: requestIdFromHeaders(input.headers),
        ipHash: clientIpHash(input.headers),
        userAgent: safeUserAgent(input.headers),
      },
    });
  });

  const authResponse = await callInternalAuth("/sign-in/email", input.headers, {
    email: input.context.email,
    password: input.newPassword,
    rememberMe: false,
  });
  if (!authResponse.ok) {
    return noStoreJson({
      data: { next: "/admin/login?reason=password-changed" },
      error: null,
    });
  }
  return noStoreJson({ data: { next: "/admin/dashboard" }, error: null }, 200, authResponse.headers);
}

export async function requestPasswordReset(input: {
  headers: Headers;
  email: string;
  now?: Date;
}): Promise<{ message: string; queued: boolean }> {
  const environment = getServerEnvironment();
  const now = input.now ?? new Date();
  const email = normalizeAdminEmail(input.email);
  const ipHash = clientIpHash(input.headers);
  await consumeAuthRateLimit({
    scope: "RESET_REQUEST",
    identity: email,
    ipHash,
    maximum: 3,
    now,
  });
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, name: true, email: true, isActive: true, banned: true },
  });
  if (!user || !user.isActive || user.banned) {
    await writeAuthAudit({
      action: "PASSWORD_RESET_REQUEST",
      headers: input.headers,
      entityId: user?.id ?? sha256(email),
      reason: "generic-unavailable-account",
      afterJson: { queued: false },
    });
    return { message: GENERIC_RESET_REQUEST_MESSAGE, queued: false };
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = sha256(token);
  const expiresAt = new Date(now.getTime() + environment.PASSWORD_RESET_TTL_SECONDS * 1000);
  const resetId = randomUUID();
  const resetUrl = new URL("/admin/reset-password", environment.NEXT_PUBLIC_APP_URL);
  resetUrl.searchParams.set("token", token);

  await prisma.$transaction(async (transaction) => {
    await transaction.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: now },
    });
    await transaction.passwordResetToken.create({
      data: {
        id: resetId,
        userId: user.id,
        tokenHash,
        expiresAt,
        requestedIpHash: ipHash,
      },
    });
    await transaction.emailOutbox.create({
      data: {
        type: "PASSWORD_RESET",
        recipientHash: sha256(email),
        encryptedPayload: encryptJson({
          kind: "PASSWORD_RESET",
          recipient: user.email,
          recipientName: user.name,
          resetUrl: resetUrl.toString(),
          expiresAt: expiresAt.toISOString(),
        }, environment.AUTH_SECRET),
        maxAttempts: environment.EMAIL_OUTBOX_MAX_ATTEMPTS,
        idempotencyKey: `password-reset:${resetId}`,
      },
    });
    await transaction.auditLog.create({
      data: {
        action: "PASSWORD_RESET_REQUEST",
        entityType: "AUTH",
        entityId: user.id,
        afterJson: { queued: true },
        requestId: requestIdFromHeaders(input.headers),
        ipHash,
        userAgent: safeUserAgent(input.headers),
      },
    });
  });

  return { message: GENERIC_RESET_REQUEST_MESSAGE, queued: true };
}

export async function inspectPasswordResetToken(
  token: string,
  now = new Date(),
): Promise<"VALID" | "INVALID" | "EXPIRED"> {
  if (token.length < 32 || token.length > 200) return "INVALID";
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: sha256(token) },
    select: { expiresAt: true, usedAt: true },
  });
  if (!record || record.usedAt) return "INVALID";
  return record.expiresAt <= now ? "EXPIRED" : "VALID";
}

export async function resetPasswordWithToken(input: {
  headers: Headers;
  token: string;
  newPassword: string;
  now?: Date;
}): Promise<void> {
  const environment = getServerEnvironment();
  const now = input.now ?? new Date();
  const tokenHash = sha256(input.token);
  await consumeAuthRateLimit({
    scope: "RESET_SUBMIT",
    identity: tokenHash,
    ipHash: clientIpHash(input.headers),
    now,
  });
  const policyError = validatePasswordPolicy(input.newPassword, environment.PASSWORD_MAX_LENGTH);
  if (policyError) throw new AuthServiceError("INVALID_PASSWORD", 400, policyError);
  const reset = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true } } },
  });
  if (!reset || reset.usedAt || reset.expiresAt <= now) {
    throw new AuthServiceError("INVALID_RESET_TOKEN", 400, "Tautan reset tidak valid atau kedaluwarsa.");
  }
  const credential = await prisma.account.findFirst({
    where: { userId: reset.userId, providerId: "credential" },
    select: { id: true, password: true },
  });
  if (!credential) throw new AuthServiceError("INVALID_RESET_TOKEN", 400, "Tautan reset tidak valid atau kedaluwarsa.");
  if (credential.password && await verifyPassword({ password: input.newPassword, hash: credential.password })) {
    throw new AuthServiceError("INVALID_PASSWORD", 400, "Password baru harus berbeda dari password sebelumnya.");
  }
  const passwordHash = await hashPassword(input.newPassword);
  await prisma.$transaction(async (transaction) => {
    const claimed = await transaction.passwordResetToken.updateMany({
      where: { id: reset.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) {
      throw new AuthServiceError("INVALID_RESET_TOKEN", 400, "Tautan reset tidak valid atau kedaluwarsa.");
    }
    await transaction.account.update({ where: { id: credential.id }, data: { password: passwordHash } });
    await transaction.user.update({
      where: { id: reset.userId },
      data: {
        mustChangePassword: false,
        temporaryPasswordExpiresAt: null,
        passwordChangedAt: now,
        sessionVersion: { increment: 1 },
      },
    });
    await transaction.session.deleteMany({ where: { userId: reset.userId } });
    await transaction.passwordResetToken.updateMany({
      where: { userId: reset.userId, usedAt: null },
      data: { usedAt: now },
    });
    await transaction.auditLog.create({
      data: {
        actorUserId: reset.userId,
        action: "PASSWORD_RESET",
        entityType: "AUTH",
        entityId: reset.userId,
        afterJson: { sessionsRevoked: true, forcedStateCleared: true },
        requestId: requestIdFromHeaders(input.headers),
        ipHash: clientIpHash(input.headers),
        userAgent: safeUserAgent(input.headers),
      },
    });
  });
}
