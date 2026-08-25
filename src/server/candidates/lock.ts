import "server-only";

import type { CandidateLockSummary } from "@/features/candidates/contracts";
import { prisma } from "@/lib/db";
import { requestIdFromHeaders, clientIpHash, safeUserAgent } from "@/server/auth/security";

export class CandidateLockError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "CandidateLockError";
  }
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && "code" in error && error.code === "P2002",
  );
}

// P2028: the interactive transaction expired/errored at the driver level
// (e.g. it queued too long for a pool connection under heavy contention and
// the query/commit ran past the transaction timeout). Deliberately NOT
// retried: an earlier version retried this and, under 50-way concurrent
// contention on a single candidate row, the pile of simultaneous retries
// made contention worse and produced a genuine Postgres deadlock. A single
// attempt that fails fast into a clean 409 is both simpler and safer.
function isTransactionApiError(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && "code" in error && error.code === "P2028",
  );
}

function toCleanError(error: unknown): never {
  if (error instanceof CandidateLockError) throw error;
  if (isTransactionApiError(error)) {
    throw new CandidateLockError(
      "Permintaan mengalami konflik tinggi pada kandidat ini. Coba lagi.",
      409,
      "LOCK_CONTENDED",
    );
  }
  throw error;
}

// ADR-030: lock only while the period is OPEN (narrower than unlock -
// selection/claiming stops the moment the period closes; unlock remains
// available a while longer for administrative correction).
function assertPeriodAllowsLockAction(period: { status: string }): void {
  if (period.status !== "OPEN") {
    throw new CandidateLockError(
      "Aksi lock hanya diizinkan saat periode berstatus OPEN.",
      409,
      "PERIOD_LOCK_WINDOW_CLOSED",
    );
  }
}

function assertPeriodAllowsUnlock(period: { status: string; allowUnlock: boolean }): void {
  if (period.status !== "OPEN" && period.status !== "CLOSED") {
    throw new CandidateLockError(
      "Aksi unlock hanya diizinkan saat periode berstatus OPEN atau CLOSED.",
      409,
      "PERIOD_LOCK_WINDOW_CLOSED",
    );
  }
  if (!period.allowUnlock) {
    throw new CandidateLockError(
      "Periode ini tidak mengizinkan unlock.",
      409,
      "UNLOCK_NOT_ALLOWED",
    );
  }
}

async function writeLockAudit(input: {
  action: "LOCK" | "UNLOCK" | "OVERRIDE";
  actorUserId: string;
  entityId: string;
  departmentId: string;
  candidateId: string;
  reason: string;
  headers: Headers;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      action: input.action,
      actorUserId: input.actorUserId,
      entityType: "CANDIDATE_LOCK",
      entityId: input.entityId,
      departmentId: input.departmentId,
      reason: input.reason.slice(0, 160),
      afterJson: { candidateId: input.candidateId },
      requestId: requestIdFromHeaders(input.headers),
      ipHash: clientIpHash(input.headers),
      userAgent: safeUserAgent(input.headers),
    },
  });
}

export async function lockCandidate(input: {
  candidateId: string;
  departmentId: string;
  actorUserId: string;
  actorName: string;
  reason: string;
  headers: Headers;
  now?: Date;
}): Promise<CandidateLockSummary> {
  const now = input.now ?? new Date();

  try {
    return await prisma.$transaction(async (tx) => {
      const candidate = await tx.candidate.findFirst({
        where: {
          id: input.candidateId,
          deletedAt: null,
          choices: { some: { departmentId: input.departmentId } },
        },
        include: { period: { select: { status: true } } },
      });
      if (!candidate) {
        throw new CandidateLockError("Kandidat tidak ditemukan.", 404, "RESOURCE_NOT_FOUND");
      }
      if (candidate.status !== "SUBMITTED") {
        throw new CandidateLockError(
          "Kandidat tidak tersedia untuk dikunci.",
          409,
          "CANDIDATE_NOT_LOCKABLE",
        );
      }
      assertPeriodAllowsLockAction(candidate.period);

      // The partial unique index on candidate_locks(candidateId) WHERE
      // unlockedAt IS NULL is the actual concurrency guard (KONTEKS PRODUK:
      // satu kandidat hanya satu lock aktif). Insert first so concurrent
      // callers fail fast here via a native unique-violation.
      let lock;
      try {
        lock = await tx.candidateLock.create({
          data: {
            candidateId: candidate.id,
            departmentId: input.departmentId,
            lockedByUserId: input.actorUserId,
            lockReason: input.reason,
            lockedAt: now,
          },
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new CandidateLockError("Kandidat sudah dikunci lebih dulu.", 409, "LOCK_CONFLICT");
        }
        throw error;
      }

      // Conditional on status='SUBMITTED' as a second, independent guard:
      // if this ever returns 0 rows despite our unique insert succeeding,
      // something outside this function's invariants changed the candidate
      // concurrently, and we must not silently continue.
      const updated = await tx.candidate.updateMany({
        where: { id: candidate.id, status: "SUBMITTED" },
        data: { status: "LOCKED", version: { increment: 1 } },
      });
      if (updated.count !== 1) {
        throw new CandidateLockError(
          "Status kandidat berubah saat proses lock.",
          409,
          "CANDIDATE_NOT_LOCKABLE",
        );
      }

      const department = await tx.department.findUniqueOrThrow({
        where: { id: input.departmentId },
        select: { name: true },
      });

      await tx.candidatePlacement.upsert({
        where: { candidateId: candidate.id },
        create: {
          candidateId: candidate.id,
          departmentId: input.departmentId,
          status: "UNDER_REVIEW",
        },
        update: {
          departmentId: input.departmentId,
          status: "UNDER_REVIEW",
          mentorLabel: null,
          reason: null,
          placedAt: null,
        },
      });

      await writeLockAudit({
        action: "LOCK",
        actorUserId: input.actorUserId,
        entityId: lock.id,
        departmentId: input.departmentId,
        candidateId: candidate.id,
        reason: input.reason,
        headers: input.headers,
      });

      return {
        id: lock.id,
        departmentId: input.departmentId,
        departmentName: department.name,
        lockedByName: input.actorName,
        lockedAt: lock.lockedAt.toISOString(),
        lockReason: lock.lockReason,
      } satisfies CandidateLockSummary;
    }, { timeout: 15_000 });
  } catch (error) {
    toCleanError(error);
  }
}

export async function unlockCandidate(input: {
  candidateId: string;
  departmentId: string;
  actorUserId: string;
  reason: string;
  headers: Headers;
  now?: Date;
}): Promise<boolean> {
  const now = input.now ?? new Date();

  try {
    return await prisma.$transaction(async (tx) => {
      const candidate = await tx.candidate.findFirst({
        where: { id: input.candidateId, deletedAt: null, status: "LOCKED" },
        include: { period: { select: { status: true, allowUnlock: true } } },
      });
      if (!candidate) return false;

      const lock = await tx.candidateLock.findFirst({
        where: { candidateId: candidate.id, departmentId: input.departmentId, unlockedAt: null },
      });
      if (!lock) return false;

      assertPeriodAllowsUnlock(candidate.period);

      const updated = await tx.candidateLock.updateMany({
        where: { id: lock.id, unlockedAt: null },
        data: {
          unlockedAt: now,
          unlockedByUserId: input.actorUserId,
          unlockReason: input.reason,
        },
      });
      if (updated.count === 0) {
        throw new CandidateLockError(
          "Kandidat sudah dibuka kuncinya oleh proses lain.",
          409,
          "ALREADY_UNLOCKED",
        );
      }

      await tx.candidate.update({
        where: { id: candidate.id },
        data: { status: "SUBMITTED", version: { increment: 1 } },
      });

      await tx.candidatePlacement.deleteMany({ where: { candidateId: candidate.id } });

      await writeLockAudit({
        action: "UNLOCK",
        actorUserId: input.actorUserId,
        entityId: lock.id,
        departmentId: input.departmentId,
        candidateId: candidate.id,
        reason: input.reason,
        headers: input.headers,
      });

      return true;
    }, { timeout: 15_000 });
  } catch (error) {
    toCleanError(error);
  }
}

/**
 * Super Admin only. Force-unlocks a candidate regardless of which
 * department holds the lock, and bypasses the period OPEN/CLOSED and
 * allowUnlock rules that ordinary unlock enforces (ADR-030) - this is the
 * administrative escape hatch those rules are deliberately narrower than.
 * `overrideReason` is mandatory (ADR-031) and the action is audited as
 * OVERRIDE, not UNLOCK, so it stays distinguishable in the trail.
 */
export async function overrideUnlockCandidate(input: {
  candidateId: string;
  actorUserId: string;
  reason: string;
  headers: Headers;
  now?: Date;
}): Promise<boolean> {
  const now = input.now ?? new Date();

  try {
    return await prisma.$transaction(async (tx) => {
      const candidate = await tx.candidate.findFirst({
        where: { id: input.candidateId, deletedAt: null, status: "LOCKED" },
      });
      if (!candidate) return false;

      const lock = await tx.candidateLock.findFirst({
        where: { candidateId: candidate.id, unlockedAt: null },
      });
      if (!lock) return false;

      const updated = await tx.candidateLock.updateMany({
        where: { id: lock.id, unlockedAt: null },
        data: {
          unlockedAt: now,
          unlockedByUserId: input.actorUserId,
          unlockReason: input.reason,
          overrideReason: input.reason,
        },
      });
      if (updated.count === 0) {
        throw new CandidateLockError(
          "Kandidat sudah dibuka kuncinya oleh proses lain.",
          409,
          "ALREADY_UNLOCKED",
        );
      }

      await tx.candidate.update({
        where: { id: candidate.id },
        data: { status: "SUBMITTED", version: { increment: 1 } },
      });

      await tx.candidatePlacement.deleteMany({ where: { candidateId: candidate.id } });

      await writeLockAudit({
        action: "OVERRIDE",
        actorUserId: input.actorUserId,
        entityId: lock.id,
        departmentId: lock.departmentId,
        candidateId: candidate.id,
        reason: input.reason,
        headers: input.headers,
      });

      return true;
    }, { timeout: 15_000 });
  } catch (error) {
    toCleanError(error);
  }
}
