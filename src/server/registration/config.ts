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

  const studyPrograms = await prisma.studyProgram.findMany({
    where: { isActive: true, configStatus: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true, configStatus: true },
  });

  if (period.departments.length < 2 || studyPrograms.length === 0) {
    return {
      state: "UNAVAILABLE",
      title: "Master data pendaftaran belum siap",
      detail: "Minimal dua Birdep penerima dan satu program studi aktif diperlukan.",
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
      portfolioMaxFiles: environment.PORTFOLIO_MAX_FILES,
      portfolioMaxFileBytes: environment.PORTFOLIO_MAX_FILE_BYTES,
      portfolioUrlMaxLength: environment.PORTFOLIO_URL_MAX_LENGTH,
      draftTtlSeconds: environment.REGISTRATION_DRAFT_TTL_SECONDS,
      departments: period.departments.map(({ department }) => ({
        id: department.id,
        code: department.code,
        name: department.name,
        shortName: department.shortName,
        requiresPortfolio: department.code === "MEDBRAND",
      })),
      studyPrograms: studyPrograms.map((program) => ({
        id: program.id,
        code: program.code,
        name: program.name,
        isDraft: program.configStatus === "DRAFT",
      })),
    },
  };
}
