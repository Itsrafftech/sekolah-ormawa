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

function segmentWhere(departmentId: string, segment: CandidateSegment): Prisma.CandidateWhereInput {
  if (segment === "LOCKED") {
    return {
      status: "LOCKED",
      choices: { some: { departmentId } },
      locks: { some: { departmentId, unlockedAt: null } },
    };
  }
  return {
    status: "SUBMITTED",
    choices: { some: { departmentId, rank: segment } },
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
      studyProgram: { select: { name: true } },
      choices: {
        where: { departmentId },
        select: { rank: true },
        take: 1,
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
    studyProgramName: candidate.studyProgram.name,
    rank: candidate.choices[0]?.rank ?? "PRIMARY",
    status: candidate.status,
    submittedAt: candidate.submittedAt.toISOString(),
  }));

  const counts = await getCandidateSegmentCounts(departmentId, periodId);

  return {
    items,
    nextCursor: hasNext ? page[page.length - 1].id : null,
    counts,
  };
}
