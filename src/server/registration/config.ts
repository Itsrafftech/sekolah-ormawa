import "server-only";

import type { RegistrationFormConfig } from "@/features/registration/contracts";
import { prisma } from "@/lib/db";
import { getServerEnvironment } from "@/lib/env";

export type RegistrationAvailability =
  | { state: "OPEN"; config: RegistrationFormConfig }
  | { state: "CLOSED" | "UNAVAILABLE"; title: string; detail: string };

export async function getRegistrationAvailability(
  now = new Date(),
): Promise<RegistrationAvailability> {
  const environment = getServerEnvironment();
  if (!environment.REGISTRATION_SUBMISSION_ENABLED) {
    return {
      state: "CLOSED",
      title: "Pendaftaran belum diaktifkan",
      detail: "Form dikunci oleh konfigurasi rilis. Data DRAFT tidak dapat digunakan untuk mendaftar.",
    };
  }

  const period = await prisma.recruitmentPeriod.findFirst({
    where: { status: "OPEN", configStatus: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    include: {
      departments: {
        where: {
          acceptsApplications: true,
          department: { isActive: true, unitType: { not: "BPH" } },
        },
        include: { department: true },
        orderBy: { department: { sortOrder: "asc" } },
      },
    },
  });

  if (!period) {
    return {
      state: "CLOSED",
      title: "Belum ada periode yang dibuka",
      detail: "Pendaftaran hanya tersedia saat periode berstatus OPEN dan konfigurasi telah disahkan.",
    };
  }

  if ((period.opensAt && now < period.opensAt) || (period.closesAt && now >= period.closesAt)) {
    return {
      state: "CLOSED",
      title: "Periode tidak sedang menerima pendaftaran",
      detail: "Waktu server berada di luar jadwal pendaftaran yang dikonfigurasi.",
    };
  }

  if (!period.entryYear || !period.registrationPrefix || !period.consentVersion) {
    return {
      state: "UNAVAILABLE",
      title: "Konfigurasi periode belum lengkap",
      detail: "Tahun masuk, prefix registrasi, dan versi consent wajib disahkan sebelum form dibuka.",
    };
  }

  if (
    process.env.NODE_ENV === "production" &&
    period.consentVersion.toUpperCase().includes("DRAFT")
  ) {
    return {
      state: "UNAVAILABLE",
      title: "Consent resmi belum tersedia",
      detail: "Submission production dinonaktifkan sampai versi consent resmi disahkan.",
    };
  }

  // UAT feedback (post-Phase D): the study-program active-master-data
  // gate that used to live here was removed along with StudyProgram's
  // role in registration - "program studi" is free text now (see
  // Candidate.studyProgram), so an empty/incomplete StudyProgram table no
  // longer has any bearing on whether registration can open.
  if (period.departments.length < 2) {
    return {
      state: "UNAVAILABLE",
      title: "Master data pendaftaran belum siap",
      detail: "Minimal dua Birdep penerima diperlukan.",
    };
  }

  return {
    state: "OPEN",
    config: {
      periodId: period.id,
      periodName: period.name,
      cohortCode: period.cohortCode,
      entryYear: period.entryYear,
      consentVersion: period.consentVersion,
      motivationMinWords: environment.MOTIVATION_MIN_WORDS,
      essayMinWords: environment.ESSAY_MIN_WORDS,
      essayMaxWords: environment.ESSAY_MAX_WORDS,
      portfolioUrlMaxLength: environment.PORTFOLIO_URL_MAX_LENGTH,
      draftTtlSeconds: environment.REGISTRATION_DRAFT_TTL_SECONDS,
      departments: period.departments.map(({ department }) => ({
        id: department.id,
        code: department.code,
        name: department.name,
        shortName: department.shortName,
        // Phase C - "Field Khusus Per Birdep" (ADR-043): BADMEDBRND
        // legislatif shares Medbrand eksekutif's exact portfolio field.
        requiresPortfolio: department.code === "MEDBRAND" || department.code === "BADMEDBRND",
        requiresMbti: department.code === "KOMIT",
        requiresAdkesmahFocus: department.code === "ADKESMAH",
        allowsBudgetPlan: department.code === "KOMANGG",
        track: department.track,
      })),
    },
  };
}
