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

export function isValidHttpsPortfolioUrl(value: string, maxLength: number): boolean {
  if (!value || value.length > maxLength) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

const uploadReferenceSchema = z.object({
  id: z.uuid(),
  kind: z.enum(["CV", "PHOTO", "STUDENT_CARD", "PORTFOLIO"]),
  name: z.string().min(1).max(255),
  sizeBytes: z.number().int().positive(),
  mimeType: z.string().min(1).max(127),
});

const portfolioSchema = z.object({
  type: z.enum(["FILE", "EXTERNAL_LINK"]),
  fileUploadId: z.uuid().optional(),
  externalUrl: z.string().optional(),
  title: z.string().trim().max(160).optional(),
  description: z.string().trim().max(1000).optional(),
  applicantRole: z.string().trim().max(160).optional(),
  creationYear: z.number().int().min(1900).max(2200).optional(),
  sortOrder: z.number().int().min(0),
});

const payloadSchema = z.object({
  periodId: z.uuid(),
  identity: z.object({
    name: z.string().trim().min(2).max(160),
    nim: z.string().trim().min(3).max(40),
    cohortCode: z.number().int().positive(),
    entryYear: z.number().int().min(1900).max(2200),
    className: z.string().trim().min(1).max(80),
    studyProgramId: z.uuid(),
    phone: z.string().trim().min(8).max(32),
    email: z.email().max(254),
    gpa: z.number().min(0).max(4),
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
  }),
  essays: z.object({
    organizationExperience: z.string().trim(),
    contribution: z.string().trim(),
    academicBalance: z.string().trim(),
  }),
  portfolio: z.array(portfolioSchema),
  consent: z.object({
    truthful: z.literal(true),
    processing: z.literal(true),
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

  if (!data.uploads.cv) errors["uploads.cv"] = "CV PDF wajib diunggah.";
  if (!data.uploads.photo) errors["uploads.photo"] = "Pas foto wajib diunggah.";

  const selectedCodes = data.choices.map(
    (choice) => config.departments.find((item) => item.id === choice.departmentId)?.code,
  );
  const requiresPortfolio = selectedCodes.includes("MEDBRAND");
  if (requiresPortfolio && data.portfolio.length === 0) {
    errors.portfolio = "Portofolio wajib jika Media Branding dipilih.";
  }

  const fileItems = data.portfolio.filter((item) => item.type === "FILE");
  if (fileItems.length > config.portfolioMaxFiles) {
    errors.portfolio = `Maksimum ${config.portfolioMaxFiles} file portofolio.`;
  }
  data.portfolio.forEach((item, index) => {
    if (item.type === "FILE" && (!item.fileUploadId || item.externalUrl)) {
      errors[`portfolio.${index}`] = "Item file harus merujuk satu upload tanpa URL.";
    }
    if (
      item.type === "EXTERNAL_LINK" &&
      (!item.externalUrl || item.fileUploadId ||
        !isValidHttpsPortfolioUrl(item.externalUrl, config.portfolioUrlMaxLength))
    ) {
      errors[`portfolio.${index}`] = "Tautan portofolio harus berupa URL HTTPS yang valid.";
    }
  });

  return Object.keys(errors).length > 0
    ? { success: false, errors }
    : { success: true, data };
}
