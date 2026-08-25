import "server-only";

import type {
  BroadcastContent,
  BroadcastFilter,
  BroadcastPreviewResult,
  BroadcastSendResult,
} from "@/features/broadcast/contracts";
import { prisma } from "@/lib/db";
import { getServerEnvironment } from "@/lib/env";
import { encryptJson, sha256, signValue, verifySignature } from "@/lib/security/crypto";
import { writeAuditLog } from "@/server/auth/audit";

const PREVIEW_TTL_MS = 10 * 60 * 1000;

export class BroadcastError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "BroadcastError";
  }
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && "code" in error && error.code === "P2002",
  );
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function payloadHash(filter: BroadcastFilter, content: BroadcastContent): string {
  return sha256(stableStringify({ filter, content }));
}

async function resolveRecipients(
  filter: BroadcastFilter,
): Promise<Array<{ id: string; name: string; email: string }>> {
  return prisma.candidate.findMany({
    where: {
      periodId: filter.periodId,
      deletedAt: null,
      status: { in: ["SUBMITTED", "LOCKED"] },
      ...(filter.departmentId
        ? { choices: { some: { departmentId: filter.departmentId } } }
        : {}),
      ...(filter.placementStatus
        ? { placement: { status: filter.placementStatus } }
        : {}),
    },
    select: { id: true, name: true, email: true },
  });
}

/**
 * Double-confirmation step 1: no send happens here. Returns a recipient
 * count/sample and a short-lived HMAC token binding the *exact* filter +
 * content shown to the operator - step 2 must present this same token, so
 * editing the message after previewing forces a fresh preview.
 */
export async function previewBroadcast(input: {
  filter: BroadcastFilter;
  content: BroadcastContent;
}): Promise<BroadcastPreviewResult> {
  const recipients = await resolveRecipients(input.filter);
  const expiresAt = Date.now() + PREVIEW_TTL_MS;
  const hash = payloadHash(input.filter, input.content);
  const signature = signValue(`${hash}.${expiresAt}`, getServerEnvironment().AUTH_SECRET);
  return {
    count: recipients.length,
    sample: recipients.slice(0, 5).map((recipient) => recipient.name),
    previewToken: `${expiresAt}.${signature}`,
    expiresAt: new Date(expiresAt).toISOString(),
  };
}

function verifyPreviewToken(
  token: string,
  filter: BroadcastFilter,
  content: BroadcastContent,
  now: number,
): boolean {
  const [expiresAtRaw, signature] = token.split(".");
  const expiresAt = Number(expiresAtRaw);
  if (!signature || !Number.isSafeInteger(expiresAt) || expiresAt <= now) return false;
  const hash = payloadHash(filter, content);
  return verifySignature(`${hash}.${expiresAt}`, signature, getServerEnvironment().AUTH_SECRET);
}

/**
 * Double-confirmation step 2. Requires the exact previewToken from step 1;
 * a mismatched or expired token means the operator must preview again
 * before sending. The broadcast id is derived deterministically from the
 * token so a retried/duplicate send call reuses the same EmailOutbox
 * idempotency keys instead of double-sending.
 */
export async function sendBroadcast(input: {
  filter: BroadcastFilter;
  content: BroadcastContent;
  previewToken: string;
  actorUserId: string;
  headers: Headers;
  now?: Date;
}): Promise<BroadcastSendResult> {
  const now = input.now ?? new Date();
  if (!verifyPreviewToken(input.previewToken, input.filter, input.content, now.getTime())) {
    throw new BroadcastError(
      "Preview kedaluwarsa atau konten berubah. Lakukan preview ulang sebelum mengirim.",
      409,
      "PREVIEW_TOKEN_INVALID",
    );
  }

  const recipients = await resolveRecipients(input.filter);
  if (recipients.length === 0) {
    throw new BroadcastError("Tidak ada kandidat yang cocok dengan filter ini.", 422, "NO_RECIPIENTS");
  }

  const environment = getServerEnvironment();
  const broadcastId = sha256(input.previewToken).slice(0, 32);

  try {
    await prisma.emailOutbox.createMany({
      data: recipients.map((recipient) => ({
        type: "BROADCAST",
        recipientHash: sha256(recipient.email),
        encryptedPayload: encryptJson({
          kind: "BROADCAST",
          recipient: recipient.email,
          recipientName: recipient.name,
          subject: input.content.subject,
          body: input.content.body,
        }, environment.AUTH_SECRET),
        maxAttempts: environment.EMAIL_OUTBOX_MAX_ATTEMPTS,
        idempotencyKey: `broadcast:${broadcastId}:${recipient.id}`,
      })),
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    // Same previewToken sent again (retry/double-click): rows already
    // exist from the first attempt, so this is a no-op replay, not a
    // duplicate send.
  }

  await writeAuditLog({
    action: "BROADCAST",
    headers: input.headers,
    actorUserId: input.actorUserId,
    entityType: "BROADCAST",
    entityId: broadcastId,
    departmentId: input.filter.departmentId ?? null,
    afterJson: {
      periodId: input.filter.periodId,
      placementStatus: input.filter.placementStatus ?? null,
      recipientCount: recipients.length,
      subject: input.content.subject,
    },
  });

  return { sent: recipients.length };
}
