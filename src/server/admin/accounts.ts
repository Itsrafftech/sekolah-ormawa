import "server-only";

import { randomBytes, randomUUID } from "node:crypto";

import type { AccountListItem } from "@/features/admin/account-contracts";
import { normalizeAdminEmail } from "@/features/auth/contracts";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db";
import { getServerEnvironment } from "@/lib/env";
import { encryptJson, sha256 } from "@/lib/security/crypto";
import { writeAuditLog } from "@/server/auth/audit";
import { clientIpHash, requestIdFromHeaders, safeUserAgent } from "@/server/auth/security";

export class AccountAdminError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "AccountAdminError";
  }
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && "code" in error && error.code === "P2002",
  );
}

function toListItem(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  departmentId: string | null;
  department: { name: string } | null;
  isActive: boolean;
  banned: boolean;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}): AccountListItem {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as AccountListItem["role"],
    departmentId: user.departmentId,
    departmentName: user.department?.name ?? null,
    isActive: user.isActive,
    banned: user.banned,
    mustChangePassword: user.mustChangePassword,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function listAccounts(): Promise<AccountListItem[]> {
  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    include: { department: { select: { name: true } } },
  });
  return users.map(toListItem);
}

/**
 * Creates a DEPT_PJ account without ever generating a temp password an
 * operator would need to relay out-of-band: a throwaway random hash fills
 * the required credential row, and the new PJ authenticates for the first
 * time exclusively through a one-time setup link (same mechanism as
 * password reset, Phase 4), sent via the email outbox. Matches the
 * documented preference in DECISIONS.md over distributing temp passwords.
 * SUPER_ADMIN accounts are intentionally not creatable here (confirmed
 * product decision) - only via seed/database.
 */
export async function createPjAccount(input: {
  name: string;
  email: string;
  departmentId: string;
  actorUserId: string;
  headers: Headers;
  now?: Date;
}): Promise<AccountListItem> {
  const environment = getServerEnvironment();
  const now = input.now ?? new Date();
  const email = normalizeAdminEmail(input.email);

  const department = await prisma.department.findFirst({
    where: { id: input.departmentId, isActive: true },
  });
  if (!department) {
    throw new AccountAdminError("Birdep tidak ditemukan atau tidak aktif.", 404, "DEPARTMENT_NOT_FOUND");
  }

  const userId = randomUUID();
  const throwawayHash = await hashPassword(randomBytes(32).toString("base64url"));
  const setupToken = randomBytes(32).toString("base64url");
  const tokenHash = sha256(setupToken);
  const expiresAt = new Date(now.getTime() + environment.TEMP_PASSWORD_TTL_SECONDS * 1000);
  const setupUrl = new URL("/admin/reset-password", environment.NEXT_PUBLIC_APP_URL);
  setupUrl.searchParams.set("token", setupToken);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id: userId,
          name: input.name,
          email,
          emailVerified: false,
          role: "DEPT_PJ",
          departmentId: department.id,
          banned: false,
          isActive: true,
          mustChangePassword: true,
          temporaryPasswordExpiresAt: expiresAt,
        },
      });
      await tx.account.create({
        data: {
          id: randomUUID(),
          accountId: userId,
          providerId: "credential",
          userId,
          password: throwawayHash,
        },
      });
      await tx.passwordResetToken.create({
        data: { id: randomUUID(), userId, tokenHash, expiresAt },
      });
      await tx.emailOutbox.create({
        data: {
          type: "ACCOUNT_SETUP",
          recipientHash: sha256(email),
          encryptedPayload: encryptJson({
            kind: "ACCOUNT_SETUP",
            recipient: email,
            recipientName: input.name,
            setupUrl: setupUrl.toString(),
            expiresAt: expiresAt.toISOString(),
          }, environment.AUTH_SECRET),
          maxAttempts: environment.EMAIL_OUTBOX_MAX_ATTEMPTS,
          idempotencyKey: `account-setup:${userId}`,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "CREATE",
          entityType: "ACCOUNT",
          entityId: userId,
          departmentId: department.id,
          afterJson: { role: "DEPT_PJ", departmentId: department.id },
          requestId: requestIdFromHeaders(input.headers),
          ipHash: clientIpHash(input.headers),
          userAgent: safeUserAgent(input.headers),
        },
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AccountAdminError("Email sudah digunakan akun lain.", 409, "EMAIL_TAKEN");
    }
    throw error;
  }

  const created = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { department: { select: { name: true } } },
  });
  return toListItem(created);
}

export async function updateAccount(input: {
  accountId: string;
  name?: string;
  departmentId?: string;
  actorUserId: string;
  headers: Headers;
}): Promise<AccountListItem | null> {
  const existing = await prisma.user.findUnique({ where: { id: input.accountId } });
  if (!existing || existing.role !== "DEPT_PJ") return null;

  let departmentId = existing.departmentId;
  if (input.departmentId) {
    const department = await prisma.department.findFirst({
      where: { id: input.departmentId, isActive: true },
    });
    if (!department) {
      throw new AccountAdminError("Birdep tidak ditemukan atau tidak aktif.", 404, "DEPARTMENT_NOT_FOUND");
    }
    departmentId = department.id;
  }

  const updated = await prisma.user.update({
    where: { id: input.accountId },
    data: {
      name: input.name?.trim() || existing.name,
      departmentId,
    },
    include: { department: { select: { name: true } } },
  });

  await writeAuditLog({
    action: "UPDATE",
    headers: input.headers,
    actorUserId: input.actorUserId,
    entityType: "ACCOUNT",
    entityId: updated.id,
    departmentId: updated.departmentId,
    beforeJson: { name: existing.name, departmentId: existing.departmentId },
    afterJson: { name: updated.name, departmentId: updated.departmentId },
  });

  return toListItem(updated);
}

export async function setAccountBanned(input: {
  accountId: string;
  banned: boolean;
  actorUserId: string;
  headers: Headers;
}): Promise<AccountListItem | null> {
  const existing = await prisma.user.findUnique({ where: { id: input.accountId } });
  if (!existing || existing.role !== "DEPT_PJ") return null;

  const updated = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: input.accountId },
      data: { banned: input.banned, sessionVersion: { increment: 1 } },
      include: { department: { select: { name: true } } },
    });
    await tx.session.deleteMany({ where: { userId: input.accountId } });
    return user;
  });

  await writeAuditLog({
    action: "UPDATE",
    headers: input.headers,
    actorUserId: input.actorUserId,
    entityType: "ACCOUNT",
    entityId: updated.id,
    departmentId: updated.departmentId,
    afterJson: { banned: input.banned, sessionsRevoked: true },
    reason: input.banned ? "account-disabled" : "account-enabled",
  });

  return toListItem(updated);
}

export async function revokeAccountSessions(input: {
  accountId: string;
  actorUserId: string;
  headers: Headers;
}): Promise<boolean> {
  const existing = await prisma.user.findUnique({ where: { id: input.accountId } });
  if (!existing || existing.role !== "DEPT_PJ") return false;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: input.accountId },
      data: { sessionVersion: { increment: 1 } },
    });
    await tx.session.deleteMany({ where: { userId: input.accountId } });
  });

  await writeAuditLog({
    action: "SESSION_REVOKE",
    headers: input.headers,
    actorUserId: input.actorUserId,
    entityType: "ACCOUNT",
    entityId: input.accountId,
    departmentId: existing.departmentId,
    reason: "admin-revoke-all",
  });

  return true;
}

/**
 * Issues a fresh one-time setup/reset link for an existing PJ account
 * (e.g. they lost the original setup email, or Super Admin wants to force a
 * password reset) - same mechanism as createPjAccount's initial link.
 */
export async function issueAccountResetLink(input: {
  accountId: string;
  actorUserId: string;
  headers: Headers;
  now?: Date;
}): Promise<boolean> {
  const environment = getServerEnvironment();
  const now = input.now ?? new Date();
  const existing = await prisma.user.findUnique({ where: { id: input.accountId } });
  if (!existing || existing.role !== "DEPT_PJ") return false;

  const token = randomBytes(32).toString("base64url");
  const tokenHash = sha256(token);
  const expiresAt = new Date(now.getTime() + environment.PASSWORD_RESET_TTL_SECONDS * 1000);
  const setupUrl = new URL("/admin/reset-password", environment.NEXT_PUBLIC_APP_URL);
  setupUrl.searchParams.set("token", token);

  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.updateMany({
      where: { userId: existing.id, usedAt: null },
      data: { usedAt: now },
    });
    await tx.passwordResetToken.create({
      data: { id: randomUUID(), userId: existing.id, tokenHash, expiresAt },
    });
    await tx.user.update({
      where: { id: existing.id },
      data: { mustChangePassword: true, temporaryPasswordExpiresAt: expiresAt },
    });
    await tx.emailOutbox.create({
      data: {
        type: "PASSWORD_RESET",
        recipientHash: sha256(existing.email),
        encryptedPayload: encryptJson({
          kind: "PASSWORD_RESET",
          recipient: existing.email,
          recipientName: existing.name,
          resetUrl: setupUrl.toString(),
          expiresAt: expiresAt.toISOString(),
        }, environment.AUTH_SECRET),
        maxAttempts: environment.EMAIL_OUTBOX_MAX_ATTEMPTS,
        idempotencyKey: `account-reset:${existing.id}:${tokenHash.slice(0, 16)}`,
      },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "PASSWORD_RESET_REQUEST",
        entityType: "ACCOUNT",
        entityId: existing.id,
        departmentId: existing.departmentId,
        reason: "admin-issued-reset",
        requestId: requestIdFromHeaders(input.headers),
        ipHash: clientIpHash(input.headers),
        userAgent: safeUserAgent(input.headers),
      },
    });
  });

  return true;
}
