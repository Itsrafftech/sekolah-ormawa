import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type {
  CandidateListItem,
  CandidateListQuery,
  CandidateListResult,
  CandidateSegment,
} from "@/features/candidates/contracts";
import { normalizeEmail, normalizeNim } from "@/features/registration/validation";
import { prisma } from "@/lib/db";

const SORT_ORDER: Record<CandidateListQuery["sort"], Prisma.CandidateOrderByWithRelationInput[]> = {
  submittedAt_asc: [{ submittedAt: "asc" }, { id: "asc" }],
  submittedAt_desc: [{ submittedAt: "desc" }, { id: "desc" }],
  name_asc: [{ name: "asc" }, { id: "asc" }],
  name_desc: [{ name: "desc" }, { id: "desc" }],
};

/**
 * Every branch below is (new selection-decision rule) OR (legacy
 * candidate_locks-era fallback, gated on `selectionDecision: null` so it
 * only ever applies to a candidate that predates this feature and was
 * never backfilled with a SelectionDecision row - see the equivalent OR
 * in scope.ts's findScopedCandidateId, which this mirrors). Going forward
 * every candidate gets a SelectionDecision at registration time
 * (submit.ts) or via the migration backfill, so the legacy branch is
 * dead weight for new data but keeps already-migrated production rows
 * behaving exactly as before this feature shipped.
 */
function segmentWhere(departmentId: string, segment: CandidateSegment): Prisma.CandidateWhereInput {
  if (segment === "LOCKED") {
    // "Diterima Birdep ini" (legacy key name "LOCKED", see contracts.ts):
    // candidates this department has accepted - taken as Pilihan 1, taken
    // as Pilihan 2 after forwarding, or (legacy) actively locked by this
    // department under the old candidate_locks mechanism.
    return {
      OR: [
        { selectionDecision: { primaryDeptId: departmentId, status: "TAKEN" } },
        { selectionDecision: { secondaryDeptId: departmentId, status: "TAKEN_P2" } },
        { selectionDecision: null, status: "LOCKED", locks: { some: { departmentId, unlockedAt: null } } },
      ],
    };
  }
  if (segment === "SECONDARY") {
    // Pilihan 2 dashboard: always shown regardless of decision status
    // (PENDING/HESITANT_P1/FORWARDED/HESITANT_P2), except once Pilihan 1
    // has taken the candidate outright (TAKEN) - product spec §"Dashboard
    // PJ Pilihan 2". ELIMINATED candidates are already excluded from every
    // view via the standard deletedAt:null filter below.
    return {
      choices: { some: { departmentId, rank: "SECONDARY" } },
      NOT: {
        OR: [
          { selectionDecision: { status: "TAKEN" } },
          { selectionDecision: null, status: "LOCKED" },
        ],
      },
    };
  }
  // PRIMARY: always shown to Pilihan 1, at every decision stage - "semua
  // pelamar yang memilih Birdep ini sebagai Pilihan 1 tampil dengan
  // overview lengkap". Legacy fallback: only while still SUBMITTED (not
  // yet locked), matching this segment's pre-existing behavior.
  return {
    choices: { some: { departmentId, rank: "PRIMARY" } },
    OR: [
      { selectionDecision: { isNot: null } },
      { selectionDecision: null, status: "SUBMITTED" },
    ],
  };
}

function searchWhere(search: string | null): Prisma.CandidateWhereInput {
  if (!search) return {};
  return {
    OR: [
      { name: { contains: search, mode: "insensitive" } },
      { normalizedNim: { contains: normalizeNim(search) } },
      { normalizedEmail: { contains: normalizeEmail(search) } },
      { registrationNumber: { contains: search, mode: "insensitive" } },
    ],
  };
}

export async function getCandidateSegmentCounts(
  departmentId: string,
  periodId: string,
): Promise<Record<CandidateSegment, number>> {
  const [primary, secondary, locked] = await Promise.all([
    prisma.candidate.count({
      where: { periodId, deletedAt: null, ...segmentWhere(departmentId, "PRIMARY") },
    }),
    prisma.candidate.count({
      where: { periodId, deletedAt: null, ...segmentWhere(departmentId, "SECONDARY") },
    }),
    prisma.candidate.count({
      where: { periodId, deletedAt: null, ...segmentWhere(departmentId, "LOCKED") },
    }),
  ]);
  return { PRIMARY: primary, SECONDARY: secondary, LOCKED: locked };
}

export async function listCandidatesForDepartment(input: {
  departmentId: string;
  periodId: string;
  query: CandidateListQuery;
}): Promise<CandidateListResult> {
  const { departmentId, periodId, query } = input;
  const where: Prisma.CandidateWhereInput = {
    periodId,
    deletedAt: null,
    ...segmentWhere(departmentId, query.segment),
    ...searchWhere(query.search),
  };

  const rows = await prisma.candidate.findMany({
    where,
    orderBy: SORT_ORDER[query.sort],
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      registrationNumber: true,
      name: true,
      nim: true,
      status: true,
      submittedAt: true,
      studyProgram: true,
      choices: {
        where: { departmentId },
        select: { rank: true },
        take: 1,
      },
      selectionDecision: {
        select: { status: true, primaryDeptId: true, secondaryDeptId: true },
      },
    },
  });

  const hasNext = rows.length > query.limit;
  const page = hasNext ? rows.slice(0, query.limit) : rows;

  const items: CandidateListItem[] = page.map((candidate) => ({
    id: candidate.id,
    registrationNumber: candidate.registrationNumber,
    name: candidate.name,
    nim: candidate.nim,
    studyProgramName: candidate.studyProgram,
    rank: candidate.choices[0]?.rank ?? "PRIMARY",
    status: candidate.status,
    submittedAt: candidate.submittedAt.toISOString(),
    selection: candidate.selectionDecision
      ? {
          status: candidate.selectionDecision.status,
          role: candidate.selectionDecision.primaryDeptId === departmentId ? "P1" : "P2",
        }
      : null,
  }));

  const counts = await getCandidateSegmentCounts(departmentId, periodId);

  return {
    items,
    nextCursor: hasNext ? page[page.length - 1].id : null,
    counts,
  };
}
