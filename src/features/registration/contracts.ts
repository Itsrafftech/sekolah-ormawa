// Bumped to 5: "Guidebook, ketentuan, dan pembayaran" adds
// guidebookAcknowledged and a payment code assigned server-side when the
// registrant reaches the Payment step - a draft saved under schema 4
// predates both and must be discarded rather than restored (an old draft
// resuming past Step 0 without ever seeing the new required checkbox, or
// carrying a stale/nonexistent payment code, would be worse than asking
// the registrant to redo the (short) early steps).
export const REGISTRATION_DRAFT_SCHEMA_VERSION = 5;

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
// budgetPlanUrl below). FOLLOW_EVIDENCE added (UAT feedback -
// "persyaratan follow dan share"): required PDF for every registrant.
// PAYMENT_EVIDENCE added ("Guidebook, ketentuan, dan pembayaran"):
// required payment screenshot/receipt for every registrant.
export type UploadReference = {
  id: string;
  kind: "CV" | "PHOTO" | "STUDENT_CARD" | "FOLLOW_EVIDENCE" | "PAYMENT_EVIDENCE";
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
  // "Guidebook, ketentuan, dan pembayaran": Step 0's required checkbox
  // ("Saya sudah membaca guidebook dan ketentuan pendaftaran"). Optional
  // on the type (like track above) so a pre-existing caller/draft without
  // it defaults to false server-side rather than a hard schema error -
  // false is the correct fail-closed default for a checkbox that must be
  // explicitly ticked.
  guidebookAcknowledged?: boolean;
  identity: {
    name: string;
    nim: string;
    cohortCode: number;
    entryYear: number;
    className: string;
    // UAT feedback (post-Phase D): free text instead of a foreign key to
    // master data - the fixture study-program list was incomplete and
    // blocked candidates from registering under their actual program.
    studyProgram: string;
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
    // UAT feedback - "persyaratan follow dan share": one required PDF
    // (all follow/share screenshots combined) for every registrant,
    // regardless of track/department.
    followEvidence: UploadReference | null;
    // "Guidebook, ketentuan, dan pembayaran": one required payment
    // screenshot/receipt for every registrant.
    paymentEvidence: UploadReference | null;
  };
  essays: {
    organizationExperience: string;
    contribution: string;
    academicBalance: string;
  };
  // "Guidebook, ketentuan, dan pembayaran": `code` is assigned server-side
  // (GET /api/registration/payment-code) the first time the registrant
  // reaches the Payment step, then persisted through the localStorage
  // draft so it is never re-issued on revisit/reload - null until that
  // first fetch completes. `amount` mirrors what the server told the
  // client the total is (PAYMENT_BASE_AMOUNT + code) purely for display;
  // submit.ts always recomputes and stores the authoritative amount
  // server-side from `code` alone, never trusting this field.
  payment: {
    code: string | null;
    amount: number | null;
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
  // "Guidebook, ketentuan, dan pembayaran": base registration fee before
  // the per-registrant unique code is added (see payment.amount above) -
  // read from PAYMENT_BASE_AMOUNT so the org can change the fee via
  // environment configuration without a code change.
  paymentBaseAmount: number;
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
};

export type RegistrationSuccessResponse = {
  registrationNumber: string;
  confirmationToken: string;
  confirmationExpiresAt: string;
};
