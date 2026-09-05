import "server-only";

import { prisma } from "@/lib/db";

/**
 * A candidate is visible to a department's Dashboard PJ only when they
 * chose that department (either rank) and the selection decision system
 * still grants that side access - Pilihan 1 always has access; Pilihan 2
 * loses access once the candidate is TAKEN by Pilihan 1 ("hilang total
 * dari dashboard PJ Pilihan 2", same enumeration-reduction principle as
 * cross-department scoping, ADR-025). This governs list/detail/notes/files
 * uniformly since they all call this function.
 *
 * The `status: "LOCKED"` branch is legacy (candidate_locks era, kept only
 * for any candidate that predates the selection decision system and was
 * never migrated) - the selection system replaces it going forward and
 * never sets candidate.status to LOCKED itself.
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
        { status: "LOCKED", locks: { some: { departmentId, unlockedAt: null } } },
        { selectionDecision: { primaryDeptId: departmentId } },
        { selectionDecision: { secondaryDeptId: departmentId, NOT: { status: "TAKEN" } } },
        { selectionDecision: null, status: "SUBMITTED" },
      ],
    },
    select: { id: true },
  });
  return candidate?.id ?? null;
}
