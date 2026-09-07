import "server-only";

import type { CandidateDetail, CandidateUploadSummary } from "@/features/candidates/contracts";
import { prisma } from "@/lib/db";
import { findScopedCandidateId } from "@/server/candidates/scope";

function toUploadSummary(upload: {
  id: string;
  kind: "CV" | "PHOTO" | "STUDENT_CARD" | "FOLLOW_EVIDENCE" | "PAYMENT_EVIDENCE";
  originalFileName: string;
  sizeBytes: number;
  detectedMimeType: string | null;
}): CandidateUploadSummary {
  return {
    id: upload.id,
    kind: upload.kind,
    originalFileName: upload.originalFileName,
    sizeBytes: upload.sizeBytes,
    detectedMimeType: upload.detectedMimeType,
  };
}

export async function getCandidateDetail(
  candidateId: string,
  departmentId: string,
): Promise<CandidateDetail | null> {
  const scopedId = await findScopedCandidateId(candidateId, departmentId);
  if (!scopedId) return null;

  const candidate = await prisma.candidate.findUnique({
    where: { id: scopedId },
    include: {
      choices: {
        orderBy: { rank: "asc" },
        include: { department: { select: { id: true, name: true, code: true } } },
      },
      // PORTFOLIO/BUDGET_PLAN excluded (retired upload kinds, Phase D -
      // ADR-045) - kept here defensively in case a pre-Phase-D FileUpload
      // row with either kind is still attached to an older candidate
      // (the CandidatePortfolio link row was dropped by the migration,
      // but the underlying FileUpload row itself was not), so it doesn't
      // show up unlabeled in the generic document list below.
      uploads: {
        where: { status: { in: ["VALIDATED", "FINALIZED"] }, kind: { notIn: ["PORTFOLIO", "BUDGET_PLAN"] } },
        select: {
          id: true,
          kind: true,
          originalFileName: true,
          sizeBytes: true,
          detectedMimeType: true,
        },
      },
      supplementalData: true,
      locks: {
        where: { unlockedAt: null },
        include: { department: { select: { name: true } } },
        take: 1,
      },
      placement: true,
      selectionDecision: {
        include: {
          primaryDept: { select: { name: true } },
          secondaryDept: { select: { name: true } },
        },
      },
    },
  });
  if (!candidate) return null;

  const activeLock = candidate.locks[0];
  const lockedByName = activeLock
    ? (await prisma.user.findUnique({
        where: { id: activeLock.lockedByUserId },
        select: { name: true },
      }))?.name ?? "Pengguna tidak dikenal"
    : null;

  // Phase C - "Field Khusus Per Birdep" (ADR-043): visibility for each
  // "Data Khusus Birdep" field keys off `departmentId` - the viewer's
  // CURRENT department scope, already resolved by the caller to either a
  // DEPT_PJ's own (fixed) department or whichever department Super Admin
  // has switched into (ADR-028's department-switcher). A DEPT_PJ can
  // therefore only ever see their own Birdep's field; Super Admin can see
  // any one by switching - no separate "see everything at once" branch
  // needed, this is the same scoping the rest of this function already
  // relies on (findScopedCandidateId above).
  //
  // Phase D (ADR-045): portfolioUrl/budgetPlanUrl are plain strings on
  // the same supplementalData row now (no more FileUpload lookup for
  // either) - scoped to MEDBRAND/BADMEDBRND and KOMANGG respectively,
  // same as komitMbti/adkesmahFocus are scoped to KOMIT/ADKESMAH.
  const viewerDepartment = await prisma.department.findUnique({
    where: { id: departmentId },
    select: { code: true },
  });
  const viewerCode = viewerDepartment?.code ?? null;
  const supplementalKomitMbti = viewerCode === "KOMIT" ? candidate.supplementalData?.komitMbti ?? null : null;
  const supplementalAdkesmahFocus =
    viewerCode === "ADKESMAH" ? candidate.supplementalData?.adkesmahFocus ?? null : null;
  const supplementalPortfolioUrl =
    viewerCode === "MEDBRAND" || viewerCode === "BADMEDBRND"
      ? candidate.supplementalData?.portfolioUrl ?? null
      : null;
  const supplementalBudgetPlanUrl =
    viewerCode === "KOMANGG" ? candidate.supplementalData?.budgetPlanUrl ?? null : null;
  const supplemental =
    supplementalKomitMbti || supplementalAdkesmahFocus || supplementalPortfolioUrl || supplementalBudgetPlanUrl
      ? {
          komitMbti: supplementalKomitMbti,
          adkesmahFocus: supplementalAdkesmahFocus,
          portfolioUrl: supplementalPortfolioUrl,
          budgetPlanUrl: supplementalBudgetPlanUrl,
        }
      : null;

  return {
    id: candidate.id,
    registrationNumber: candidate.registrationNumber,
    name: candidate.name,
    nim: candidate.nim,
    className: candidate.className,
    studyProgramName: candidate.studyProgram,
    phone: candidate.phone,
    email: candidate.email,
    domicile: candidate.domicile,
    essayOrgExperience: candidate.essayOrgExperience,
    essayContribution: candidate.essayContribution,
    essayBalance: candidate.essayBalance,
    status: candidate.status,
    submittedAt: candidate.submittedAt.toISOString(),
    choices: candidate.choices.map((choice) => ({
      departmentId: choice.departmentId,
      departmentName: choice.department.name,
      departmentCode: choice.department.code,
      rank: choice.rank,
      motivation: choice.motivation,
      contribution: choice.contribution,
    })),
    // The `where: kind: { notIn: [...] }` clause above already excludes
    // PORTFOLIO/BUDGET_PLAN at the query level - this filter exists only
    // to narrow the TS type accordingly (Prisma's generated type for a
    // `select`-ed enum column can't reflect a runtime WHERE filter).
    uploads: candidate.uploads
      .filter((upload): upload is typeof upload & { kind: "CV" | "PHOTO" | "STUDENT_CARD" | "FOLLOW_EVIDENCE" | "PAYMENT_EVIDENCE" } =>
        upload.kind === "CV" || upload.kind === "PHOTO" || upload.kind === "STUDENT_CARD" ||
        upload.kind === "FOLLOW_EVIDENCE" || upload.kind === "PAYMENT_EVIDENCE")
      .map(toUploadSummary),
    supplemental,
    activeLock: activeLock
      ? {
          id: activeLock.id,
          departmentId: activeLock.departmentId,
          departmentName: activeLock.department.name,
          lockedByName: lockedByName ?? "Pengguna tidak dikenal",
          lockedAt: activeLock.lockedAt.toISOString(),
          lockReason: activeLock.lockReason,
        }
      : null,
    placement: candidate.placement
      ? {
          status: candidate.placement.status,
          mentorLabel: candidate.placement.mentorLabel,
          reason: candidate.placement.reason,
          placedAt: candidate.placement.placedAt
            ? candidate.placement.placedAt.toISOString()
            : null,
          updatedAt: candidate.placement.updatedAt.toISOString(),
        }
      : null,
    selection: candidate.selectionDecision
      ? {
          status: candidate.selectionDecision.status,
          role: candidate.selectionDecision.primaryDeptId === departmentId ? "P1" : "P2",
          primaryDeptId: candidate.selectionDecision.primaryDeptId,
          primaryDeptName: candidate.selectionDecision.primaryDept.name,
          secondaryDeptId: candidate.selectionDecision.secondaryDeptId,
          secondaryDeptName: candidate.selectionDecision.secondaryDept.name,
          p1Reason: candidate.selectionDecision.p1Reason,
          p2Reason: candidate.selectionDecision.p2Reason,
          p1DecidedAt: candidate.selectionDecision.p1DecidedAt?.toISOString() ?? null,
          p2DecidedAt: candidate.selectionDecision.p2DecidedAt?.toISOString() ?? null,
        }
      : null,
  };
}
