import "server-only";

import { prisma } from "@/lib/db";

/**
 * A candidate is visible to a department's Dashboard PJ only when they
 * chose that department (either rank) and are not locked by a *different*
 * department. Once locked elsewhere, the candidate disappears entirely from
 * this department's dashboard (list, detail, notes, files) - confirmed
 * product decision for Phase 5, see docs/sekolah-ormawa/PHASE_STATUS.md.
 */
export async function findScopedCandidateId(
  candidateId: string,
  departmentId: string,
): Promise<string | null> {
  const candidate = await prisma.candidate.findFirst({
    where: {
      id: candidateId,
      deletedAt: null,
      choices: { some: { departmentId } },
      OR: [
        { status: "SUBMITTED" },
        { status: "LOCKED", locks: { some: { departmentId, unlockedAt: null } } },
      ],
    },
    select: { id: true },
  });
  return candidate?.id ?? null;
}
