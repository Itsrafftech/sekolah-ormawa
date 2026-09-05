import "server-only";

import type { CandidateDetail, CandidateUploadSummary } from "@/features/candidates/contracts";
import { prisma } from "@/lib/db";
import { findScopedCandidateId } from "@/server/candidates/scope";

function toUploadSummary(upload: {
  id: string;
  kind: "CV" | "PHOTO" | "STUDENT_CARD" | "PORTFOLIO";
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
      studyProgram: { select: { name: true } },
      choices: {
        orderBy: { rank: "asc" },
        include: { department: { select: { id: true, name: true, code: true } } },
      },
      uploads: {
        where: { status: { in: ["VALIDATED", "FINALIZED"] }, kind: { not: "PORTFOLIO" } },
        select: {
          id: true,
          kind: true,
          originalFileName: true,
          sizeBytes: true,
          detectedMimeType: true,
        },
      },
      portfolios: {
        orderBy: { sortOrder: "asc" },
        include: {
          file: {
            select: {
              id: true,
              kind: true,
              originalFileName: true,
              sizeBytes: true,
              detectedMimeType: true,
            },
          },
        },
      },
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

  return {
    id: candidate.id,
    registrationNumber: candidate.registrationNumber,
    name: candidate.name,
    nim: candidate.nim,
    className: candidate.className,
    studyProgramName: candidate.studyProgram.name,
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
    uploads: candidate.uploads.map(toUploadSummary),
    portfolios: candidate.portfolios.map((portfolio) => ({
      id: portfolio.id,
      type: portfolio.type,
      title: portfolio.title,
      description: portfolio.description,
      applicantRole: portfolio.applicantRole,
      creationYear: portfolio.creationYear,
      sortOrder: portfolio.sortOrder,
      externalUrl: portfolio.externalUrl,
      file: portfolio.file ? toUploadSummary(portfolio.file) : null,
    })),
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
