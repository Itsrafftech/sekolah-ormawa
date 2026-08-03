import { describe, expect, it } from "vitest";

import type {
  RegistrationFormConfig,
  RegistrationPayload,
} from "@/features/registration/contracts";
import {
  countWords,
  isValidHttpsPortfolioUrl,
  normalizeEmail,
  normalizeNim,
  normalizePhone,
  validateRegistrationPayload,
} from "@/features/registration/validation";

const departmentA = "10000000-0000-4000-8000-000000000001";
const departmentB = "10000000-0000-4000-8000-000000000002";
const medbrand = "10000000-0000-4000-8000-000000000003";

const config: RegistrationFormConfig = {
  periodId: "20000000-0000-4000-8000-000000000001",
  periodName: "Fixture",
  cohortCode: 63,
  entryYear: 2026,
  consentVersion: "DRAFT-CONSENT-TEST",
  motivationMinWords: 100,
  essayMinWords: 1,
  essayMaxWords: 1000,
  portfolioMaxFiles: 5,
  portfolioMaxFileBytes: 5 * 1024 * 1024,
  portfolioUrlMaxLength: 2048,
  draftTtlSeconds: 3600,
  departments: [
    { id: departmentA, code: "A", name: "A", shortName: "A", requiresPortfolio: false },
    { id: departmentB, code: "B", name: "B", shortName: "B", requiresPortfolio: false },
    { id: medbrand, code: "MEDBRAND", name: "Media Branding", shortName: "Medbrand", requiresPortfolio: true },
  ],
  studyPrograms: [{ id: "30000000-0000-4000-8000-000000000001", code: "TEST", name: "Test", isDraft: true }],
};

const motivation = Array.from({ length: 100 }, (_, index) => `kata${index}`).join(" ");

function payload(): RegistrationPayload {
  return {
    periodId: config.periodId,
    identity: {
      name: "Peserta Sintetis",
      nim: "I-123 TEST",
      cohortCode: 63,
      entryYear: 2026,
      className: "Kelas Test",
      studyProgramId: config.studyPrograms[0].id,
      phone: "0812 0000 0000",
      email: "Peserta@Example.test",
      gpa: 3.5,
      domicile: "Kota Test",
    },
    choices: [
      { departmentId: departmentA, motivation },
      { departmentId: departmentB, motivation },
    ],
    uploads: {
      cv: { id: "40000000-0000-4000-8000-000000000001", kind: "CV", name: "cv.pdf", sizeBytes: 100, mimeType: "application/pdf" },
      photo: { id: "40000000-0000-4000-8000-000000000002", kind: "PHOTO", name: "foto.png", sizeBytes: 100, mimeType: "image/png" },
      studentCard: null,
    },
    essays: { organizationExperience: "Sintetis", contribution: "Sintetis", academicBalance: "Sintetis" },
    portfolio: [],
    consent: { truthful: true, processing: true, version: config.consentVersion },
  };
}

describe("registration validation", () => {
  it("menormalisasi NIM, email, dan WhatsApp di server", () => {
    expect(normalizeNim(" i-12 34 ")).toBe("I1234");
    expect(normalizeEmail(" Peserta@Example.TEST ")).toBe("peserta@example.test");
    expect(normalizePhone("0812-3456 7890")).toBe("+6281234567890");
  });

  it("menghitung kata dengan whitespace majemuk", () => {
    expect(countWords(" satu\n dua   tiga ")).toBe(3);
  });

  it("menerima happy path non-Medbrand tanpa portofolio", () => {
    expect(validateRegistrationPayload(payload(), config).success).toBe(true);
  });

  it("menolak dua pilihan yang sama dan motivasi kurang dari 100 kata", () => {
    const input = payload();
    input.choices[1] = { departmentId: departmentA, motivation: "terlalu pendek" };
    const result = validateRegistrationPayload(input, config);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors["choices.1.departmentId"]).toBeTruthy();
      expect(result.errors["choices.1.motivation"]).toBeTruthy();
    }
  });

  it("menolak Medbrand di Pilihan 1 atau Pilihan 2 tanpa portofolio", () => {
    for (const index of [0, 1] as const) {
      const input = payload();
      input.choices[index].departmentId = medbrand;
      expect(validateRegistrationPayload(input, config)).toMatchObject({
        success: false,
        errors: { portfolio: expect.any(String) },
      });
    }
  });

  it("menerima satu tautan HTTPS dan menolak HTTP tanpa mengambil URL", () => {
    expect(isValidHttpsPortfolioUrl("https://www.behance.net/fixture", 2048)).toBe(true);
    expect(isValidHttpsPortfolioUrl("http://localhost/fixture", 2048)).toBe(false);
    const input = payload();
    input.choices[0].departmentId = medbrand;
    input.portfolio = [{ type: "EXTERNAL_LINK", externalUrl: "https://portfolio.example.test/karya", sortOrder: 0 }];
    expect(validateRegistrationPayload(input, config).success).toBe(true);
  });

  it("menolak lebih dari lima file portofolio", () => {
    const input = payload();
    input.choices[1].departmentId = medbrand;
    input.portfolio = Array.from({ length: 6 }, (_, index) => ({
      type: "FILE" as const,
      fileUploadId: `50000000-0000-4000-8000-00000000000${index}`,
      sortOrder: index,
    }));
    expect(validateRegistrationPayload(input, config)).toMatchObject({
      success: false,
      errors: { portfolio: expect.any(String) },
    });
  });
});
