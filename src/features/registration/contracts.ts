// Bumped to 4: IPK (gpa) removed from identity (ADR-040) - a draft saved
// under schema 3 still has a gpa field the form no longer renders, so it
// must be discarded rather than restored.
export const REGISTRATION_DRAFT_SCHEMA_VERSION = 4;

// Phase A/B - "Jalur Legislatif". Still optional on the payload type
// (not required) even though the form now always sets it from Step 0
// (Phase B) - kept optional so a stale pre-Phase-B draft restored from
// localStorage, or any other future caller that doesn't know about
// tracks, still gets the EXECUTIVE default server-side (submit.ts)
// instead of a hard validation error.
export type Track = "EXECUTIVE" | "LEGISLATIVE";

// Phase B - "Jalur Legislatif". Mirrors src/server/departments/public.ts's
// DepartmentsByTrack/PublicDepartmentOption (GET /api/departments) -
// defined here too since this is the shared client/server contract layer
// and registration-form.tsx ("use client") shouldn't import types from a
// "server-only"-guarded module.
export type PublicDepartmentOption = {
  id: string;
  code: string;
  name: string;
  shortName: string;
};

export type DepartmentsByTrack = {
  executive: PublicDepartmentOption[];
  legislative: PublicDepartmentOption[];
};

// Phase D - "Portofolio via URL Google Drive" (ADR-045): PORTFOLIO and
// BUDGET_PLAN removed from this union - both moved from in-app upload to
// a plain Google Drive URL field (departmentFields.portfolioUrl/
// budgetPlanUrl below). CV/PHOTO/STUDENT_CARD are the only kinds a
// registration payload can still reference.
export type UploadReference = {
  id: string;
  kind: "CV" | "PHOTO" | "STUDENT_CARD";
  name: string;
  sizeBytes: number;
  mimeType: string;
};

// Phase C - "Field Khusus Per Birdep". Adkesmah's required focus-area
// choice - kept as a string literal union (not imported from
// @/generated/prisma/client) for the same "use client" boundary reason as
// Track above.
export type AdkesmahFocus = "ADVOCACY" | "WELFARE";

export type RegistrationPayload = {
  periodId: string;
  track?: Track;
  identity: {
    name: string;
    nim: string;
    cohortCode: number;
    entryYear: number;
    className: string;
    studyProgramId: string;
    phone: string;
    email: string;
    domicile: string;
  };
  choices: [
    { departmentId: string; motivation: string },
    { departmentId: string; motivation: string },
  ];
  uploads: {
    cv: UploadReference | null;
    photo: UploadReference | null;
    studentCard: UploadReference | null;
  };
  essays: {
    organizationExperience: string;
    contribution: string;
    academicBalance: string;
  };
  // Phase C - "Field Khusus Per Birdep". Populated only for the
  // department each field belongs to (KOMIT's MBTI, Adkesmah's focus
  // area) - undefined/omitted whenever the candidate's chosen Birdep
  // doesn't require that field. Server re-validates this against the
  // candidate's actual choices, same defense-in-depth pattern as track.
  //
  // Phase D (ADR-045): portfolioUrl (Medbrand/Badmedbrnd, wajib jika
  // dipilih) and budgetPlanUrl (Komanggar, opsional) added here as plain
  // Google Drive URL strings - replaces the old file-upload-based
  // `portfolio` array entirely (no other Birdep ever used it).
  departmentFields: {
    komitMbti?: string;
    adkesmahFocus?: AdkesmahFocus;
    portfolioUrl?: string;
    budgetPlanUrl?: string;
  };
  consent: {
    truthful: boolean;
    processing: boolean;
    version: string;
  };
};

export type RegistrationFormConfig = {
  periodId: string;
  periodName: string;
  cohortCode: number;
  entryYear: number;
  consentVersion: string;
  motivationMinWords: number;
  essayMinWords: number;
  essayMaxWords: number;
  // Phase D (ADR-045): portfolioMaxFiles/portfolioMaxFileBytes/
  // budgetPlanMaxFileBytes removed along with the retired file-upload
  // mechanism - portfolioUrlMaxLength is the only cap still relevant
  // (applies to both the portfolio and RAB Google Drive URL fields).
  portfolioUrlMaxLength: number;
  draftTtlSeconds: number;
  departments: Array<{
    id: string;
    code: string;
    name: string;
    shortName: string;
    // MEDBRAND (eksekutif) and BADMEDBRND (legislatif) share this exact
    // same field per the Phase C spec (ADR-043).
    requiresPortfolio: boolean;
    // Phase C - "Field Khusus Per Birdep": department-triggered fields,
    // each derived server-side from department.code, mirroring how
    // requiresPortfolio already worked before this phase.
    requiresMbti: boolean;
    requiresAdkesmahFocus: boolean;
    allowsBudgetPlan: boolean;
    track: Track;
  }>;
  studyPrograms: Array<{
    id: string;
    code: string;
    name: string;
    isDraft: boolean;
  }>;
};

export type RegistrationSuccessResponse = {
  registrationNumber: string;
  confirmationToken: string;
  confirmationExpiresAt: string;
};
