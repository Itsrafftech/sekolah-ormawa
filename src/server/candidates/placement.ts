import "server-only";

import type {
  CandidatePlacementSummary,
  PlacementStatusValue,
} from "@/features/candidates/contracts";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/server/auth/audit";

function toSummary(placement: {
  status: PlacementStatusValue;
  mentorLabel: string | null;
  reason: string | null;
  placedAt: Date | null;
  updatedAt: Date;
}): CandidatePlacementSummary {
  return {
    status: placement.status,
    mentorLabel: placement.mentorLabel,
    reason: placement.reason,
    placedAt: placement.placedAt ? placement.placedAt.toISOString() : null,
    updatedAt: placement.updatedAt.toISOString(),
  };
}

/**
 * Placement status may only be adjusted while the candidate is actively
 * locked by the requesting department - it represents that department's
 * internal review outcome for a claim they currently hold.
 */
export async function updateCandidatePlacement(input: {
  candidateId: string;
  departmentId: string;
  actorUserId: string;
  status: PlacementStatusValue;
  mentorLabel?: string;
  reason?: string;
  headers: Headers;
  now?: Date;
}): Promise<CandidatePlacementSummary | null> {
  const now = input.now ?? new Date();

  const activeLock = await prisma.candidateLock.findFirst({
    where: { candidateId: input.candidateId, departmentId: input.departmentId, unlockedAt: null },
  });
  if (!activeLock) return null;

  const existing = await prisma.candidatePlacement.findUnique({
    where: { candidateId: input.candidateId },
  });
  if (!existing || existing.departmentId !== input.departmentId) return null;

  const placement = await prisma.candidatePlacement.update({
    where: { candidateId: input.candidateId },
    data: {
      status: input.status,
      mentorLabel: input.mentorLabel?.trim() || null,
      reason: input.reason?.trim() || null,
      placedAt: input.status === "PLACED" ? now : null,
    },
  });

  await writeAuditLog({
    action: "UPDATE",
    headers: input.headers,
    actorUserId: input.actorUserId,
    entityType: "CANDIDATE_PLACEMENT",
    entityId: placement.id,
    departmentId: input.departmentId,
    beforeJson: { status: existing.status },
    afterJson: { status: placement.status, candidateId: input.candidateId },
  });

  return toSummary(placement);
}
