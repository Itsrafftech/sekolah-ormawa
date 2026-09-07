import { z } from "zod";

import type {
  RegistrationFormConfig,
  RegistrationPayload,
} from "@/features/registration/contracts";

export function countWords(value: string): number {
  const normalized = value.trim();
  return normalized ? normalized.split(/\s+/u).length : 0;
}

export function normalizeNim(value: string): string {
  return value.trim().replace(/[\s-]+/gu, "").toUpperCase();
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizePhone(value: string): string {
  const compact = value.trim().replace(/[\s().-]+/gu, "");
  if (compact.startsWith("0")) {
    return `+62${compact.slice(1)}`;
  }
  if (compact.startsWith("62")) {
    return `+${compact}`;
  }
  return compact;
}

// Phase D - "Portofolio via URL Google Drive" (ADR-045). Deliberately
// stricter than a generic HTTPS URL check (which is what this function
// used to be, back when portfolio items could be any HTTPS link) -
// requires the Google Drive host specifically, since that's the only
// sharing flow the "Anyone with the link can view" instruction shown to
// candidates actually applies to.
export function isValidGoogleDriveUrl(value: string, maxLength: number): boolean {
  if (!value || value.length > maxLength) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "drive.google.com" &&
      !url.username && !url.password;
  } catch {
    return false;
  }
}

const uploadReferenceSchema = z.object({
  id: z.uuid(),
  kind: z.enum(["CV", "PHOTO", "STUDENT_CARD", "FOLLOW_EVIDENCE", "PAYMENT_EVIDENCE"]),
  name: z.string().min(1).max(255),
  sizeBytes: z.number().int().positive(),
  mimeType: z.string().min(1).max(127),
});

// "Guidebook, ketentuan, dan pembayaran": the code itself is assigned by
// GET /api/registration/payment-code, not chosen/typed by the registrant -
// this only checks the SHAPE of whatever the client echoes back (digits
// only, at least 3 - not capped at exactly 3 since a period past 999
// registrants still issues a longer, still-valid code, see that route's
// comment). Uniqueness/correctness is enforced by the DB unique
// constraint (periodId, paymentCode) and by submit.ts recomputing amount
// server-side - this schema check alone is not a security boundary.
const paymentCodeSchema = z.string().trim().regex(/^\d{3,}$/u, "Kode pembayaran tidak valid.");

// Phase C - "Field Khusus Per Birdep". Format valid: 4 huruf, kombinasi
// I/E + N/S + T/F + J/P (16 tipe MBTI). Normalisasi uppercase terjadi di
// sini juga (bukan cuma di UI) karena payload tidak boleh dipercaya
// datang sudah ternormalisasi dari client.
const mbtiSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .refine((value) => /^[EI][NS][TF][JP]$/u.test(value), "Format MBTI tidak valid (contoh: INTJ, ENFP, ISTP).");

const payloadSchema = z.object({
  periodId: z.uuid(),
  // Phase A - "Jalur Legislatif": optional since the form doesn't send it
  // yet - validateRegistrationPayload below treats a missing value as
  // EXECUTIVE, matching submit.ts's own default.
  track: z.enum(["EXECUTIVE", "LEGISLATIVE"]).optional(),
  // "Guidebook, ketentuan, dan pembayaran": optional at the schema level
  // for the same reason as `track` (a caller/draft that predates this
  // field shouldn't hard-fail schema parsing) - the business-logic
  // section below is what actually enforces it must be `true`.
  guidebookAcknowledged: z.boolean().optional(),
  identity: z.object({
    name: z.string().trim().min(2).max(160),
    nim: z.string().trim().min(3).max(40),
    cohortCode: z.number().int().positive(),
    entryYear: z.number().int().min(1900).max(2200),
    className: z.string().trim().min(1).max(80),
    // UAT feedback (post-Phase D): free text instead of a foreign key to
    // master data - the fixture study-program list was incomplete and
    // blocked candidates from registering under their actual program.
    studyProgram: z.string().trim().min(3).max(100),
    phone: z.string().trim().min(8).max(32),
    email: z.email().max(254),
    domicile: z.string().trim().min(2).max(160),
  }),
  choices: z.tuple([
    z.object({ departmentId: z.uuid(), motivation: z.string().trim() }),
    z.object({ departmentId: z.uuid(), motivation: z.string().trim() }),
  ]),
  uploads: z.object({
    cv: uploadReferenceSchema.nullable(),
    photo: uploadReferenceSchema.nullable(),
    studentCard: uploadReferenceSchema.nullable(),
    followEvidence: uploadReferenceSchema.nullable(),
    paymentEvidence: uploadReferenceSchema.nullable(),
  }),
  essays: z.object({
    organizationExperience: z.string().trim(),
    contribution: z.string().trim(),
    academicBalance: z.string().trim(),
  }),
  // "Guidebook, ketentuan, dan pembayaran": `code` nullable at the schema
  // level (the client hasn't reached the Payment step yet on early
  // steps/drafts) - required non-null by the business-logic section
  // below, which is what actually runs at submit time. `amount` is
  // accepted but never trusted - submit.ts always recomputes it from
  // `code` alone server-side.
  payment: z.object({
    code: paymentCodeSchema.nullable(),
    amount: z.number().int().positive().nullable(),
  }),
  // Phase C - "Field Khusus Per Birdep". All optional at the schema level
  // (requiredness depends on which Birdep was chosen - checked below,
  // same pattern as track), but komitMbti's format is always checked when
  // present regardless of department. portfolioUrl/budgetPlanUrl (Phase D,
  // ADR-045) are plain trimmed strings here - their Google Drive URL
  // format and max length depend on config.portfolioUrlMaxLength, which
  // isn't available at schema-definition time, so that check happens in
  // the business-logic section below (same pattern the old EXTERNAL_LINK
  // portfolio item validation used).
  departmentFields: z.object({
    komitMbti: mbtiSchema.optional(),
    adkesmahFocus: z.enum(["ADVOCACY", "WELFARE"]).optional(),
    portfolioUrl: z.string().trim().optional(),
    budgetPlanUrl: z.string().trim().optional(),
  }),
  consent: z.object({
    // Custom messages: without these, a Zod structural failure here (e.g.
    // an unchecked box reaching submit()) surfaces Zod's raw default
    // "Invalid input: expected true" straight to the end user - matches
    // the wording validateStep(4) already uses client-side.
    truthful: z.literal(true, "Pernyataan kebenaran data wajib disetujui."),
    processing: z.literal(true, "Persetujuan pemrosesan data wajib diberikan."),
    version: z.string().min(1).max(100),
  }),
});

export type FieldErrors = Record<string, string>;

export function validateRegistrationPayload(
  input: unknown,
  config: RegistrationFormConfig,
): { success: true; data: RegistrationPayload } | { success: false; errors: FieldErrors } {
  const parsed = payloadSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      errors: Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path.join("."), issue.message]),
      ),
    };
  }

  const data = parsed.data as RegistrationPayload;
  const errors: FieldErrors = {};

  if (data.periodId !== config.periodId) errors.periodId = "Periode formulir tidak sesuai.";
  if (data.identity.cohortCode !== config.cohortCode) {
    errors["identity.cohortCode"] = "Kode angkatan tidak sesuai konfigurasi periode.";
  }
  if (data.identity.entryYear !== config.entryYear) {
    errors["identity.entryYear"] = "Tahun masuk tidak sesuai konfigurasi periode.";
  }
  if (data.consent.version !== config.consentVersion) {
    errors["consent.version"] = "Versi persetujuan telah berubah. Tinjau kembali persetujuan.";
  }
  if (data.choices[0].departmentId === data.choices[1].departmentId) {
    errors["choices.1.departmentId"] = "Pilihan Birdep harus berbeda.";
  }

  // Phase A - "Jalur Legislatif": both choices must belong to the same
  // track. This is the fast-fail/field-error copy of the check; submit.ts
  // re-validates against fresh DB data as the authoritative server-side
  // guard (config.departments here is a client-supplied snapshot).
  const choiceTracks = data.choices.map(
    (choice) => config.departments.find((item) => item.id === choice.departmentId)?.track,
  );
  if (
    choiceTracks[0] && choiceTracks[1] && choiceTracks[0] !== choiceTracks[1]
  ) {
    errors["choices.1.departmentId"] = "Pilihan Birdep harus berasal dari jalur (Eksekutif/Legislatif) yang sama.";
  }
  const effectiveTrack = data.track ?? "EXECUTIVE";
  if (
    choiceTracks[0] && choiceTracks[1] && choiceTracks[0] === choiceTracks[1] &&
    choiceTracks[0] !== effectiveTrack
  ) {
    errors.track = "Field track tidak sesuai dengan jalur Birdep yang dipilih.";
  }

  data.choices.forEach((choice, index) => {
    if (countWords(choice.motivation) < config.motivationMinWords) {
      errors[`choices.${index}.motivation`] =
        `Motivasi minimal ${config.motivationMinWords} kata.`;
    }
  });

  Object.entries(data.essays).forEach(([key, value]) => {
    const words = countWords(value);
    if (words < config.essayMinWords || words > config.essayMaxWords) {
      errors[`essays.${key}`] =
        `Esai harus ${config.essayMinWords}-${config.essayMaxWords} kata.`;
    }
  });

  // "Guidebook, ketentuan, dan pembayaran": required for every registrant,
  // checked at Step 0 before anything else can be filled in.
  if (!data.guidebookAcknowledged) {
    errors.guidebookAcknowledged = "Kamu wajib mencentang bahwa sudah membaca guidebook dan ketentuan pendaftaran.";
  }

  if (!data.uploads.cv) errors["uploads.cv"] = "CV PDF wajib diunggah.";
  if (!data.uploads.photo) errors["uploads.photo"] = "Pas foto wajib diunggah.";
  // UAT feedback - "persyaratan follow dan share": required for every
  // registrant regardless of track/department.
  if (!data.uploads.followEvidence) {
    errors["uploads.followEvidence"] = "Bukti follow dan share (PDF) wajib diunggah.";
  }
  // "Guidebook, ketentuan, dan pembayaran": required for every registrant.
  if (!data.payment.code) {
    errors["payment.code"] = "Kode pembayaran belum dibuat. Kembali ke langkah Pembayaran.";
  }
  if (!data.uploads.paymentEvidence) {
    errors["uploads.paymentEvidence"] = "Bukti pembayaran wajib diunggah.";
  }

  const selectedCodes = data.choices.map(
    (choice) => config.departments.find((item) => item.id === choice.departmentId)?.code,
  );
  // Phase C - "Field Khusus Per Birdep" (ADR-043): BADMEDBRND legislatif
  // shares Medbrand eksekutif's exact same portfolio requirement. Phase D
  // (ADR-045): the field itself is now a Google Drive URL, not a file.
  const requiresPortfolio = selectedCodes.includes("MEDBRAND") || selectedCodes.includes("BADMEDBRND");
  if (requiresPortfolio && !data.departmentFields.portfolioUrl) {
    errors["departmentFields.portfolioUrl"] = "Link Google Drive portofolio wajib jika Media Branding dipilih.";
  } else if (
    data.departmentFields.portfolioUrl &&
    !isValidGoogleDriveUrl(data.departmentFields.portfolioUrl, config.portfolioUrlMaxLength)
  ) {
    errors["departmentFields.portfolioUrl"] = "Link harus berupa URL Google Drive yang valid (https://drive.google.com/...).";
  }

  // Phase C - "Field Khusus Per Birdep": each field is required only when
  // the candidate actually picked the department it belongs to - this is
  // the fast-fail copy, same pattern as requiresPortfolio above; submit.ts
  // re-derives the same requirement from fresh DB data as the
  // authoritative guard.
  if (selectedCodes.includes("KOMIT") && !data.departmentFields.komitMbti) {
    errors["departmentFields.komitMbti"] = "Tipe MBTI wajib diisi karena Biro Kolaborasi dan Kemitraan dipilih.";
  }
  if (selectedCodes.includes("ADKESMAH") && !data.departmentFields.adkesmahFocus) {
    errors["departmentFields.adkesmahFocus"] =
      "Bidang fokus wajib dipilih karena Departemen Advokasi dan Kesejahteraan Mahasiswa dipilih.";
  }
  // Komanggar's RAB stays optional ("nilai plus") - only the format is
  // checked when a value is present, no requiredness check.
  if (
    data.departmentFields.budgetPlanUrl &&
    !isValidGoogleDriveUrl(data.departmentFields.budgetPlanUrl, config.portfolioUrlMaxLength)
  ) {
    errors["departmentFields.budgetPlanUrl"] = "Link harus berupa URL Google Drive yang valid (https://drive.google.com/...).";
  }

  return Object.keys(errors).length > 0
    ? { success: false, errors }
    : { success: true, data };
}
