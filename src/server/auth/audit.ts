import "server-only";

import type { AuditAction, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { clientIpHash, requestIdFromHeaders, safeUserAgent } from "@/server/auth/security";

/**
 * Defaults to the shared global client for the (common) case of a caller
 * not already inside a transaction. A caller that IS inside an open
 * `prisma.$transaction(async (tx) => {...})` MUST pass its `tx` here
 * instead of leaving the default - writing the audit row through the
 * global client while a transaction is still open means it needs a
 * SECOND connection from the same pool before the first can commit.
 * Under high concurrency (many other callers all blocked on the same row
 * lock, each holding a connection of their own) that second connection
 * may never free up, self-deadlocking the pool. Real, reproduced bug
 * (ADR-042) in lock.ts/selection.ts prior to this fix - both now thread
 * `tx` through their own writeLockAudit/writeSelectionAudit wrappers.
 */
export async function writeAuditLog(
  input: {
    action: AuditAction;
    headers: Headers;
    actorUserId?: string | null;
    entityType: string;
    entityId: string;
    departmentId?: string | null;
    beforeJson?: Prisma.InputJsonValue;
    afterJson?: Prisma.InputJsonValue;
    reason?: string;
  },
  client: Prisma.TransactionClient = prisma,
): Promise<void> {
  await client.auditLog.create({
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

export async function writeAuthAudit(
  input: {
    action: AuditAction;
    headers: Headers;
    actorUserId?: string | null;
    entityId: string;
    afterJson?: Prisma.InputJsonValue;
    reason?: string;
  },
  client: Prisma.TransactionClient = prisma,
): Promise<void> {
  await writeAuditLog({ ...input, entityType: "AUTH" }, client);
}

