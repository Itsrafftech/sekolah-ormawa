import "server-only";

import type { AuditAction, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { clientIpHash, requestIdFromHeaders, safeUserAgent } from "@/server/auth/security";

export async function writeAuditLog(input: {
  action: AuditAction;
  headers: Headers;
  actorUserId?: string | null;
  entityType: string;
  entityId: string;
  departmentId?: string | null;
  beforeJson?: Prisma.InputJsonValue;
  afterJson?: Prisma.InputJsonValue;
  reason?: string;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      departmentId: input.departmentId ?? null,
      beforeJson: input.beforeJson,
      afterJson: input.afterJson,
      reason: input.reason?.slice(0, 160),
      requestId: requestIdFromHeaders(input.headers),
      ipHash: clientIpHash(input.headers),
      userAgent: safeUserAgent(input.headers),
    },
  });
}

export async function writeAuthAudit(input: {
  action: AuditAction;
  headers: Headers;
  actorUserId?: string | null;
  entityId: string;
  afterJson?: Prisma.InputJsonValue;
  reason?: string;
}): Promise<void> {
  await writeAuditLog({ ...input, entityType: "AUTH" });
}

