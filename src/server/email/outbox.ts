import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { Resend } from "resend";

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

export type AccountSetupEmailPayload = {
  kind: "ACCOUNT_SETUP";
  recipient: string;
  recipientName: string;
  setupUrl: string;
  expiresAt: string;
};

export type BroadcastEmailPayload = {
  kind: "BROADCAST";
  recipient: string;
  recipientName: string;
  subject: string;
  body: string;
};

export type EmailPayload =
  | RegistrationEmailPayload
  | PasswordResetEmailPayload
  | AccountSetupEmailPayload
  | BroadcastEmailPayload;

export interface EmailAdapter {
  send(payload: EmailPayload, idempotencyKey: string): Promise<void>;
}

export class LocalEmailSinkAdapter implements EmailAdapter {
  async send(payload: EmailPayload, idempotencyKey: string): Promise<void> {
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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderEmail(payload: EmailPayload): { subject: string; html: string; text: string } {
  switch (payload.kind) {
    case "PASSWORD_RESET": {
      const subject = "Reset password akun Sekolah Ormawa Eksekutif PKU";
      const text = `Halo ${payload.recipientName},\n\nAda permintaan reset password untuk akun Anda. Buka tautan berikut untuk membuat password baru (berlaku sampai ${payload.expiresAt}):\n${payload.resetUrl}\n\nJika Anda tidak meminta ini, abaikan email ini - password Anda tidak akan berubah.\n\nSekolah Ormawa Eksekutif PKU`;
      const html = `<p>Halo ${escapeHtml(payload.recipientName)},</p><p>Ada permintaan reset password untuk akun Anda. Buka tautan berikut untuk membuat password baru (berlaku sampai ${escapeHtml(payload.expiresAt)}):</p><p><a href="${escapeHtml(payload.resetUrl)}">${escapeHtml(payload.resetUrl)}</a></p><p>Jika Anda tidak meminta ini, abaikan email ini - password Anda tidak akan berubah.</p><p>Sekolah Ormawa Eksekutif PKU</p>`;
      return { subject, html, text };
    }
    case "ACCOUNT_SETUP": {
      const subject = "Aktivasi akun PJ Birdep - Sekolah Ormawa Eksekutif PKU";
      const text = `Halo ${payload.recipientName},\n\nAkun PJ Birdep Anda sudah dibuat. Buka tautan berikut untuk mengatur password dan mengaktifkan akun (berlaku sampai ${payload.expiresAt}):\n${payload.setupUrl}\n\nSekolah Ormawa Eksekutif PKU`;
      const html = `<p>Halo ${escapeHtml(payload.recipientName)},</p><p>Akun PJ Birdep Anda sudah dibuat. Buka tautan berikut untuk mengatur password dan mengaktifkan akun (berlaku sampai ${escapeHtml(payload.expiresAt)}):</p><p><a href="${escapeHtml(payload.setupUrl)}">${escapeHtml(payload.setupUrl)}</a></p><p>Sekolah Ormawa Eksekutif PKU</p>`;
      return { subject, html, text };
    }
    case "BROADCAST": {
      const text = `Halo ${payload.recipientName},\n\n${payload.body}\n\nSekolah Ormawa Eksekutif PKU`;
      const html = `<p>Halo ${escapeHtml(payload.recipientName)},</p><p>${escapeHtml(payload.body).replaceAll("\n", "<br/>")}</p><p>Sekolah Ormawa Eksekutif PKU</p>`;
      return { subject: payload.subject, html, text };
    }
    case "REGISTRATION_CONFIRMATION":
    default: {
      const subject = `Konfirmasi pendaftaran ${payload.registrationNumber} - Sekolah Ormawa Eksekutif PKU`;
      const [primary, secondary] = payload.choices;
      const text = `Halo ${payload.participantName},\n\nPendaftaran Anda diterima.\n\nNomor registrasi: ${payload.registrationNumber}\nWaktu submit: ${payload.submittedAt}\nPilihan 1: ${primary}\nPilihan 2: ${secondary}\n\nSimpan nomor registrasi ini sebagai bukti pendaftaran.\n\nSekolah Ormawa Eksekutif PKU`;
      const html = `<p>Halo ${escapeHtml(payload.participantName)},</p><p>Pendaftaran Anda diterima.</p><ul><li>Nomor registrasi: <strong>${escapeHtml(payload.registrationNumber)}</strong></li><li>Waktu submit: ${escapeHtml(payload.submittedAt)}</li><li>Pilihan 1: ${escapeHtml(primary)}</li><li>Pilihan 2: ${escapeHtml(secondary)}</li></ul><p>Simpan nomor registrasi ini sebagai bukti pendaftaran.</p><p>Sekolah Ormawa Eksekutif PKU</p>`;
      return { subject, html, text };
    }
  }
}

/**
 * Production email provider: Resend (resend.com), via its HTTP API/SDK -
 * not SMTP (see ADR-036, RUNBOOK.md §Email production). Recipient identity
 * is never logged; only the outbox's own idempotency key and Resend's
 * response id are used for correlation. `idempotencyKey` is also passed
 * through to Resend's own idempotency support as defense-in-depth on top
 * of this app's outbox claim mechanism (Phase 8: a SENT row is never
 * reclaimed for reprocessing - see claimOutbox below).
 */
export class ResendEmailAdapter implements EmailAdapter {
  private readonly client: Resend;
  private readonly from: string;

  constructor(env = getServerEnvironment()) {
    if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
      throw new Error("RESEND_API_KEY dan RESEND_FROM_EMAIL wajib untuk ResendEmailAdapter.");
    }
    this.client = new Resend(env.RESEND_API_KEY);
    this.from = env.RESEND_FROM_EMAIL;
  }

  async send(payload: EmailPayload, idempotencyKey: string): Promise<void> {
    const { subject, html, text } = renderEmail(payload);
    const result = await this.client.emails.send(
      { from: this.from, to: payload.recipient, subject, html, text },
      { idempotencyKey },
    );
    if (result.error) {
      throw new Error(`Resend menolak pengiriman email: ${result.error.message}`);
    }
  }
}

export function getEmailAdapter(): EmailAdapter {
  if (process.env.NODE_ENV === "production") {
    return new ResendEmailAdapter();
  }
  return new LocalEmailSinkAdapter();
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
  const adapter = options.adapter ?? getEmailAdapter();
  const limit = options.limit ?? 10;
  const now = options.now ?? new Date();
  let sent = 0;
  let failed = 0;

  for (let index = 0; index < limit; index += 1) {
    const item = await claimOutbox(now);
    if (!item) break;
    try {
      const payload = decryptJson<EmailPayload>(
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
