import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { EmailOutbox } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getServerEnvironment } from "@/lib/env";
import { decryptJson, sha256 } from "@/lib/security/crypto";

export type RegistrationEmailPayload = {
  kind?: "REGISTRATION_CONFIRMATION";
  recipient: string;
  participantName: string;
  registrationNumber: string;
  submittedAt: string;
  choices: [string, string];
};

export type PasswordResetEmailPayload = {
  kind: "PASSWORD_RESET";
  recipient: string;
  recipientName: string;
  resetUrl: string;
  expiresAt: string;
};

export type DevelopmentEmailPayload = RegistrationEmailPayload | PasswordResetEmailPayload;

export interface EmailAdapter {
  send(payload: DevelopmentEmailPayload, idempotencyKey: string): Promise<void>;
}

export class LocalEmailSinkAdapter implements EmailAdapter {
  async send(payload: DevelopmentEmailPayload, idempotencyKey: string): Promise<void> {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Local email sink tidak boleh digunakan pada production.");
    }
    const storageBase = path.resolve(process.cwd(), "storage");
    const root = path.resolve(storageBase, getServerEnvironment().EMAIL_SINK_ROOT);
    if (root !== storageBase && !root.startsWith(`${storageBase}${path.sep}`)) {
      throw new Error("Email sink root berada di luar folder storage.");
    }
    await mkdir(root, { recursive: true });
    const target = path.resolve(root, `${sha256(idempotencyKey)}.json`);
    if (!target.startsWith(`${root}${path.sep}`)) throw new Error("Path email sink tidak valid.");
    try {
      await writeFile(target, JSON.stringify(payload, null, 2), { flag: "wx" });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  }
}

async function claimOutbox(now: Date): Promise<EmailOutbox | null> {
  const staleLock = new Date(now.getTime() - 5 * 60 * 1000);
  return prisma.$transaction(async (transaction) => {
    const next = await transaction.emailOutbox.findFirst({
      where: {
        attemptCount: { lt: getServerEnvironment().EMAIL_OUTBOX_MAX_ATTEMPTS },
        OR: [
          { status: { in: ["PENDING", "FAILED"] }, nextAttemptAt: { lte: now } },
          { status: "PROCESSING", lockedAt: { lt: staleLock } },
        ],
      },
      orderBy: { createdAt: "asc" },
    });
    if (!next) return null;
    const claimed = await transaction.emailOutbox.updateMany({
      where: { id: next.id, updatedAt: next.updatedAt },
      data: { status: "PROCESSING", lockedAt: now, attemptCount: { increment: 1 } },
    });
    return claimed.count === 1
      ? transaction.emailOutbox.findUnique({ where: { id: next.id } })
      : null;
  });
}

export async function processEmailOutbox(options: {
  adapter?: EmailAdapter;
  limit?: number;
  now?: Date;
} = {}): Promise<{ sent: number; failed: number }> {
  const adapter = options.adapter ?? new LocalEmailSinkAdapter();
  const limit = options.limit ?? 10;
  const now = options.now ?? new Date();
  let sent = 0;
  let failed = 0;

  for (let index = 0; index < limit; index += 1) {
    const item = await claimOutbox(now);
    if (!item) break;
    try {
      const payload = decryptJson<DevelopmentEmailPayload>(
        item.encryptedPayload,
        getServerEnvironment().AUTH_SECRET,
      );
      await adapter.send(payload, item.idempotencyKey);
      await prisma.emailOutbox.update({
        where: { id: item.id },
        data: { status: "SENT", sentAt: new Date(), lockedAt: null, lastErrorCode: null },
      });
      sent += 1;
    } catch (error) {
      const code = error instanceof Error ? error.name.slice(0, 80) : "PROVIDER_ERROR";
      const delaySeconds = Math.min(3600, 30 * 2 ** Math.max(0, item.attemptCount - 1));
      await prisma.emailOutbox.update({
        where: { id: item.id },
        data: {
          status: "FAILED",
          lockedAt: null,
          lastErrorCode: code,
          nextAttemptAt: new Date(Date.now() + delaySeconds * 1000),
        },
      });
      failed += 1;
    }
  }

  return { sent, failed };
}
