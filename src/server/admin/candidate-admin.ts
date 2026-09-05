import "server-only";

import type {
  DeletedCandidateItem,
  LockedCandidateItem,
} from "@/features/admin/candidate-admin-contracts";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/server/auth/audit";

export class CandidateAdminError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "CandidateAdminError";
  }
}

/** Cross-department view of every currently active lock, for Super Admin override. */
export async function listAllLockedCandidates(): Promise<LockedCandidateItem[]> {
  const locks = await prisma.candidateLock.findMany({
    where: { unlockedAt: null },
    orderBy: { lockedAt: "asc" },
    include: {
      candidate: { select: { id: true, name: true, registrationNumber: true, deletedAt: true } },
      department: { select: { name: true } },
    },
  });
  const activeLocks = locks.filter((lock) => !lock.candidate.deletedAt);
  const lockerIds = [...new Set(activeLocks.map((lock) => lock.lockedByUserId))];
  const lockers = await prisma.user.findMany({
    where: { id: { in: lockerIds } },
    select: { id: true, name: true },
  });
  const lockerNames = new Map(lockers.map((user) => [user.id, user.name]));

  return activeLocks.map((lock) => ({
    candidateId: lock.candidate.id,
    candidateName: lock.candidate.name,
    registrationNumber: lock.candidate.registrationNumber,
    departmentId: lock.departmentId,
    departmentName: lock.department.name,
    lockedByName: lockerNames.get(lock.lockedByUserId) ?? "Pengguna tidak dikenal",
    lockedAt: lock.lockedAt.toISOString(),
    lockReason: lock.lockReason,
  }));
}

export async function listDeletedCandidates(): Promise<DeletedCandidateItem[]> {
  const candidates = await prisma.candidate.findMany({
    where: { deletedAt: { not: null } },
    orderBy: { deletedAt: "desc" },
    select: {
      id: true,
      name: true,
      registrationNumber: true,
      deletedAt: true,
      selectionDecision: { select: { status: true } },
    },
  });
  return candidates.map((candidate) => ({
    id: candidate.id,
    name: candidate.name,
    registrationNumber: candidate.registrationNumber,
    deletedAt: candidate.deletedAt!.toISOString(),
    eliminated: candidate.selectionDecision?.status === "ELIMINATED",
  }));
}

export async function softDeleteCandidate(input: {
  candidateId: string;
  actorUserId: string;
  headers: Headers;
  now?: Date;
}): Promise<boolean> {
  const now = input.now ?? new Date();
  const candidate = await prisma.candidate.findFirst({
    where: { id: input.candidateId, deletedAt: null },
  });
  if (!candidate) return false;
  if (candidate.status === "LOCKED") {
    throw new CandidateAdminError(
      "Kandidat sedang terkunci. Override unlock terlebih dahulu sebelum menghapus.",
      409,
      "CANDIDATE_LOCKED",
    );
  }

  await prisma.candidate.update({ where: { id: candidate.id }, data: { deletedAt: now } });
  await writeAuditLog({
    action: "SOFT_DELETE",
    headers: input.headers,
    actorUserId: input.actorUserId,
    entityType: "CANDIDATE",
    entityId: candidate.id,
  });
  return true;
}

export async function restoreCandidate(input: {
  candidateId: string;
  actorUserId: string;
  headers: Headers;
}): Promise<boolean> {
  const candidate = await prisma.candidate.findFirst({
    where: { id: input.candidateId, deletedAt: { not: null } },
  });
  if (!candidate) return false;

  await prisma.candidate.update({ where: { id: candidate.id }, data: { deletedAt: null } });
  await writeAuditLog({
    action: "RESTORE",
    headers: input.headers,
    actorUserId: input.actorUserId,
    entityType: "CANDIDATE",
    entityId: candidate.id,
  });
  return true;
}
