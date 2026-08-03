import "server-only";

import type { AdminContext } from "@/server/auth/guard";
import { prisma } from "@/lib/db";
import { callInternalAuth, noStoreJson } from "@/server/auth/http";
import { clientIpHash, requestIdFromHeaders, safeUserAgent } from "@/server/auth/security";

export async function logoutCurrentSession(input: {
  context: AdminContext;
  headers: Headers;
}): Promise<Response> {
  const response = await callInternalAuth("/sign-out", input.headers, {});
  await prisma.auditLog.create({
    data: {
      actorUserId: input.context.userId,
      action: "LOGOUT",
      entityType: "AUTH",
      entityId: input.context.userId,
      afterJson: { currentSessionRevoked: true },
      requestId: requestIdFromHeaders(input.headers),
      ipHash: clientIpHash(input.headers),
      userAgent: safeUserAgent(input.headers),
    },
  });
  return noStoreJson({ data: { next: "/admin/login?reason=logout" }, error: null }, 200, response.headers);
}

export async function revokeAllSessions(input: {
  context: AdminContext;
  headers: Headers;
}): Promise<Response> {
  const clearCookieResponse = await callInternalAuth("/sign-out", input.headers, {});
  await prisma.$transaction(async (transaction) => {
    await transaction.user.update({
      where: { id: input.context.userId },
      data: { sessionVersion: { increment: 1 } },
    });
    await transaction.session.deleteMany({ where: { userId: input.context.userId } });
    await transaction.auditLog.create({
      data: {
        actorUserId: input.context.userId,
        action: "SESSION_REVOKE",
        entityType: "AUTH",
        entityId: input.context.userId,
        afterJson: { allSessionsRevoked: true },
        requestId: requestIdFromHeaders(input.headers),
        ipHash: clientIpHash(input.headers),
        userAgent: safeUserAgent(input.headers),
      },
    });
  });
  return noStoreJson({ data: { next: "/admin/login?reason=revoked" }, error: null }, 200, clearCookieResponse.headers);
}

export async function revokeAllSessionsForUser(input: {
  userId: string;
  actorUserId?: string | null;
  headers: Headers;
  reason: string;
}): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    await transaction.user.update({
      where: { id: input.userId },
      data: { sessionVersion: { increment: 1 } },
    });
    await transaction.session.deleteMany({ where: { userId: input.userId } });
    await transaction.auditLog.create({
      data: {
        actorUserId: input.actorUserId ?? input.userId,
        action: "SESSION_REVOKE",
        entityType: "AUTH",
        entityId: input.userId,
        reason: input.reason.slice(0, 160),
        afterJson: { allSessionsRevoked: true },
        requestId: requestIdFromHeaders(input.headers),
        ipHash: clientIpHash(input.headers),
        userAgent: safeUserAgent(input.headers),
      },
    });
  });
}

