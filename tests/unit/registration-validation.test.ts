import { describe, expect, it } from "vitest";

import type {
  RegistrationFormConfig,
  RegistrationPayload,
} from "@/features/registration/contracts";
import {
  countWords,
  isValidGoogleDriveUrl,
  normalizeEmail,
  normalizeNim,
  normalizePhone,
  validateRegistrationPayload,
} from "@/features/registration/validation";

const departmentA = "10000000-0000-4000-8000-000000000001";
const departmentB = "10000000-0000-4000-8000-000000000002";
const medbrand = "10000000-0000-4000-8000-000000000003";
const komleg = "10000000-0000-4000-8000-000000000004";
const badmedbrnd = "10000000-0000-4000-8000-000000000005";
// Phase C - "Field Khusus Per Birdep" (ADR-043) fixtures.
const komit = "10000000-0000-4000-8000-000000000006";
const adkesmah = "10000000-0000-4000-8000-000000000007";
const komanggar = "10000000-0000-4000-8000-000000000008";
// Generic legislative department with none of the Phase C special
// fields - keeps the plain "both choices legislative" happy-path test
// below from tripping BADMEDBRND's (now-required) portfolio field.
const kompeng = "10000000-0000-4000-8000-000000000009";
// "Tambahan Field Khusus Senbud".
const senbud = "10000000-0000-4000-8000-000000000010";
// "Tambahan Field Khusus Ristek".
const ristek = "10000000-0000-4000-8000-000000000011";

function department(overrides: Partial<RegistrationFormConfig["departments"][number]>): RegistrationFormConfig["departments"][number] {
  return {
    id: overrides.id!,
    code: overrides.code!,
    name: overrides.name!,
    shortName: overrides.shortName!,
    requiresPortfolio: false,
    requiresMbti: false,
    requiresAdkesmahFocus: false,
    allowsBudgetPlan: false,
    track: "EXECUTIVE",
    ...overrides,
  };
}

const config: RegistrationFormConfig = {
  periodId: "20000000-0000-4000-8000-000000000001",
  periodName: "Fixture",
  cohortCode: 63,
  entryYear: 2026,
  consentVersion: "DRAFT-CONSENT-TEST",
  motivationMinWords: 100,
  essayMinWords: 1,
  essayMaxWords: 1000,
  portfolioUrlMaxLength: 2048,
  paymentAmount: 15001,
  draftTtlSeconds: 3600,
  departments: [
    department({ id: departmentA, code: "A", name: "A", shortName: "A" }),
    department({ id: departmentB, code: "B", name: "B", shortName: "B" }),
    department({ id: medbrand, code: "MEDBRAND", name: "Media Branding", shortName: "Medbrand", requiresPortfolio: true }),
    department({ id: komleg, code: "KOMLEG", name: "Komisi Legislasi", shortName: "Komleg", track: "LEGISLATIVE" }),
    department({ id: kompeng, code: "KOMPENG", name: "Komisi Pengawasan", shortName: "Kompeng", track: "LEGISLATIVE" }),
    // BADMEDBRND shares Medbrand's exact same (now-required) portfolio
    // field - ADR-043/ADR-045.
    department({ id: badmedbrnd, code: "BADMEDBRND", name: "Badan Media dan Branding", shortName: "Badmedbrnd", requiresPortfolio: true, track: "LEGISLATIVE" }),
    department({ id: komit, code: "KOMIT", name: "Biro Kolaborasi dan Kemitraan", shortName: "Komit", requiresMbti: true }),
    department({ id: adkesmah, code: "ADKESMAH", name: "Advokasi dan Kesejahteraan Mahasiswa", shortName: "Adkesmah", requiresAdkesmahFocus: true }),
    department({ id: komanggar, code: "KOMANGG", name: "Komisi Anggaran", shortName: "Komanggar", allowsBudgetPlan: true, track: "LEGISLATIVE" }),
    department({ id: senbud, code: "SENBUD", name: "Seni dan Budaya", shortName: "Senbud" }),
    department({ id: ristek, code: "RISTEK", name: "Riset dan Teknologi", shortName: "Ristek" }),
  ],
};

const motivation = Array.from({ length: 100 }, (_, index) => `kata${index}`).join(" ");
const driveUrl = "https://drive.google.com/file/d/fixture-id/view";

function payload(): RegistrationPayload {
  return {
    periodId: config.periodId,
    guidebookAcknowledged: true,
    identity: {
      name: "Peserta Sintetis",
      nim: "I-123 TEST",
      cohortCode: 63,
      entryYear: 2026,
      className: "Kelas Test",
      studyProgram: "Program Studi Test",
      phone: "0812 0000 0000",
      email: "Peserta@Example.test",
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
      followEvidence: { id: "40000000-0000-4000-8000-000000000003", kind: "FOLLOW_EVIDENCE", name: "bukti.pdf", sizeBytes: 100, mimeType: "application/pdf" },
      paymentEvidence: { id: "40000000-0000-4000-8000-000000000004", kind: "PAYMENT_EVIDENCE", name: "bukti-bayar.pdf", sizeBytes: 100, mimeType: "application/pdf" },
      senbudInstagramEvidence: null,
    },
    essays: { organizationExperience: "Sintetis", contribution: "Sintetis", academicBalance: "Sintetis" },
    departmentFields: {},
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

  it("menolak pendaftaran tanpa bukti follow dan share (wajib untuk semua pendaftar)", () => {
    const input = payload();
    input.uploads.followEvidence = null;
    const result = validateRegistrationPayload(input, config);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors["uploads.followEvidence"]).toBeTruthy();
  });

  // "Guidebook, ketentuan, dan pembayaran".
  it("menolak pendaftaran tanpa checkbox guidebook dicentang", () => {
    const input = payload();
    input.guidebookAcknowledged = false;
    const result = validateRegistrationPayload(input, config);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.guidebookAcknowledged).toBeTruthy();
  });

  // "Perubahan Sistem Pembayaran" (ADR-048): tidak ada lagi kode unik untuk
  // divalidasi - nominal tetap untuk semua pendaftar, hanya bukti
  // pembayaran yang tetap wajib.
  it("menolak pendaftaran tanpa bukti pembayaran (wajib untuk semua pendaftar)", () => {
    const withoutEvidence = payload();
    withoutEvidence.uploads.paymentEvidence = null;
    const evidenceResult = validateRegistrationPayload(withoutEvidence, config);
    expect(evidenceResult.success).toBe(false);
    if (!evidenceResult.success) expect(evidenceResult.errors["uploads.paymentEvidence"]).toBeTruthy();
  });

  it("menolak consent yang belum dicentang dengan pesan Indonesia, bukan pesan Zod mentah", () => {
    const input = payload();
    input.consent.truthful = false as unknown as true;
    input.consent.processing = false as unknown as true;
    const result = validateRegistrationPayload(input, config);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors["consent.truthful"]).toBe("Pernyataan kebenaran data wajib disetujui.");
      expect(result.errors["consent.processing"]).toBe("Persetujuan pemrosesan data wajib diberikan.");
      // Guards specifically against the bug found in live UAT: Zod's
      // default literal-mismatch message ("Invalid input: expected true")
      // leaking straight to the user instead of a translated message.
      expect(result.errors["consent.truthful"]).not.toMatch(/invalid input/iu);
      expect(result.errors["consent.processing"]).not.toMatch(/invalid input/iu);
    }
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

  describe("Phase D - portofolio via URL Google Drive", () => {
    it("mengenali URL Google Drive yang valid dan menolak host lain", () => {
      expect(isValidGoogleDriveUrl("https://drive.google.com/file/d/abc/view", 2048)).toBe(true);
      expect(isValidGoogleDriveUrl("http://drive.google.com/file/d/abc/view", 2048)).toBe(false);
      expect(isValidGoogleDriveUrl("https://www.behance.net/fixture", 2048)).toBe(false);
      // Deliberately NOT fooled by a naive "starts with" string check -
      // a subdomain-suffix trick like this must still be rejected.
      expect(isValidGoogleDriveUrl("https://drive.google.com.evil.test/x", 2048)).toBe(false);
    });

    it("menolak Medbrand di Pilihan 1 atau Pilihan 2 tanpa link Google Drive", () => {
      for (const index of [0, 1] as const) {
        const input = payload();
        input.choices[index].departmentId = medbrand;
        expect(validateRegistrationPayload(input, config)).toMatchObject({
          success: false,
          errors: { "departmentFields.portfolioUrl": expect.any(String) },
        });
      }
    });

    it("menerima Medbrand dengan link Google Drive valid, menolak link non-Drive", () => {
      const invalid = payload();
      invalid.choices[0].departmentId = medbrand;
      invalid.departmentFields.portfolioUrl = "https://www.behance.net/fixture";
      expect(validateRegistrationPayload(invalid, config)).toMatchObject({
        success: false,
        errors: { "departmentFields.portfolioUrl": expect.any(String) },
      });

      const valid = payload();
      valid.choices[0].departmentId = medbrand;
      valid.departmentFields.portfolioUrl = driveUrl;
      expect(validateRegistrationPayload(valid, config).success).toBe(true);
    });
  });

  describe("Phase A - jalur legislatif", () => {
    it("menolak pasangan pilihan lintas jalur (satu eksekutif, satu legislatif)", () => {
      const input = payload();
      input.choices[1].departmentId = komleg;
      const result = validateRegistrationPayload(input, config);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors["choices.1.departmentId"]).toMatch(/jalur/iu);
      }
    });

    it("menerima pasangan pilihan yang keduanya legislatif", () => {
      const input = payload();
      input.choices = [
        { departmentId: komleg, motivation },
        { departmentId: kompeng, motivation },
      ];
      input.track = "LEGISLATIVE";
      expect(validateRegistrationPayload(input, config).success).toBe(true);
    });

    it("menolak field track eksplisit yang tidak sesuai jalur Birdep yang dipilih", () => {
      const input = payload();
      input.choices = [
        { departmentId: komleg, motivation },
        { departmentId: badmedbrnd, motivation },
      ];
      input.track = "EXECUTIVE";
      const result = validateRegistrationPayload(input, config);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.track).toBeTruthy();
      }
    });

    it("menerima payload tanpa field track sama sekali (default EXECUTIVE tersirat, form lama)", () => {
      const input = payload();
      expect(input.track).toBeUndefined();
      expect(validateRegistrationPayload(input, config).success).toBe(true);
    });
  });

  describe("Phase C - field khusus per Birdep", () => {
    it("menolak Komit tanpa MBTI, menerima dengan MBTI valid", () => {
      const withoutMbti = payload();
      withoutMbti.choices[0].departmentId = komit;
      const rejected = validateRegistrationPayload(withoutMbti, config);
      expect(rejected.success).toBe(false);
      if (!rejected.success) expect(rejected.errors["departmentFields.komitMbti"]).toBeTruthy();

      const withMbti = payload();
      withMbti.choices[0].departmentId = komit;
      withMbti.departmentFields.komitMbti = "intj";
      const accepted = validateRegistrationPayload(withMbti, config);
      expect(accepted.success).toBe(true);
      // Uppercase normalization happens server-side too, not just in the UI.
      if (accepted.success) expect(accepted.data.departmentFields.komitMbti).toBe("INTJ");
    });

    it("menolak format MBTI yang bukan kombinasi valid", () => {
      const input = payload();
      input.choices[0].departmentId = komit;
      input.departmentFields.komitMbti = "ABCD";
      const result = validateRegistrationPayload(input, config);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.errors["departmentFields.komitMbti"]).toMatch(/MBTI/u);
    });

    it("menolak Adkesmah tanpa bidang fokus, menerima dengan salah satu pilihan", () => {
      const withoutFocus = payload();
      withoutFocus.choices[0].departmentId = adkesmah;
      const rejected = validateRegistrationPayload(withoutFocus, config);
      expect(rejected.success).toBe(false);
      if (!rejected.success) expect(rejected.errors["departmentFields.adkesmahFocus"]).toBeTruthy();

      const withFocus = payload();
      withFocus.choices[0].departmentId = adkesmah;
      withFocus.departmentFields.adkesmahFocus = "WELFARE";
      expect(validateRegistrationPayload(withFocus, config).success).toBe(true);
    });

    it("menolak Badan Media dan Branding (legislatif) tanpa link portofolio - sama seperti Medbrand", () => {
      const input = payload();
      input.choices = [
        { departmentId: komleg, motivation },
        { departmentId: badmedbrnd, motivation },
      ];
      input.track = "LEGISLATIVE";
      expect(validateRegistrationPayload(input, config)).toMatchObject({
        success: false,
        errors: { "departmentFields.portfolioUrl": expect.any(String) },
      });
    });

    it("menerima Komisi Anggaran tanpa RAB (opsional, nilai plus), menerima dengan link Google Drive valid", () => {
      const withoutRab = payload();
      withoutRab.choices = [
        { departmentId: komleg, motivation },
        { departmentId: komanggar, motivation },
      ];
      withoutRab.track = "LEGISLATIVE";
      expect(validateRegistrationPayload(withoutRab, config).success).toBe(true);

      const withRab = payload();
      withRab.choices = [
        { departmentId: komleg, motivation },
        { departmentId: komanggar, motivation },
      ];
      withRab.track = "LEGISLATIVE";
      withRab.departmentFields.budgetPlanUrl = driveUrl;
      expect(validateRegistrationPayload(withRab, config).success).toBe(true);
    });

    it("menolak RAB Komisi Anggaran dengan link non-Google-Drive", () => {
      const input = payload();
      input.choices = [
        { departmentId: komleg, motivation },
        { departmentId: komanggar, motivation },
      ];
      input.track = "LEGISLATIVE";
      input.departmentFields.budgetPlanUrl = "https://example.test/rab.pdf";
      expect(validateRegistrationPayload(input, config)).toMatchObject({
        success: false,
        errors: { "departmentFields.budgetPlanUrl": expect.any(String) },
      });
    });
  });

  // "Tambahan Field Khusus Senbud".
  describe("Field khusus Senbud", () => {
    it("menolak Senbud tanpa bukti Instagram, menerima dengan bukti", () => {
      const withoutEvidence = payload();
      withoutEvidence.choices[0].departmentId = senbud;
      const rejected = validateRegistrationPayload(withoutEvidence, config);
      expect(rejected.success).toBe(false);
      if (!rejected.success) expect(rejected.errors["uploads.senbudInstagramEvidence"]).toBeTruthy();

      const withEvidence = payload();
      withEvidence.choices[0].departmentId = senbud;
      withEvidence.uploads.senbudInstagramEvidence = {
        id: "40000000-0000-4000-8000-000000000005",
        kind: "SENBUD_INSTAGRAM",
        name: "bukti-ig.jpg",
        sizeBytes: 100,
        mimeType: "image/jpeg",
      };
      expect(validateRegistrationPayload(withEvidence, config).success).toBe(true);
    });

    it("menerima Senbud tanpa link portofolio (opsional), menerima dengan link Google Drive valid", () => {
      const withoutPortfolio = payload();
      withoutPortfolio.choices[0].departmentId = senbud;
      withoutPortfolio.uploads.senbudInstagramEvidence = {
        id: "40000000-0000-4000-8000-000000000005",
        kind: "SENBUD_INSTAGRAM",
        name: "bukti-ig.jpg",
        sizeBytes: 100,
        mimeType: "image/jpeg",
      };
      expect(validateRegistrationPayload(withoutPortfolio, config).success).toBe(true);

      const withPortfolio = { ...withoutPortfolio, departmentFields: { ...withoutPortfolio.departmentFields, senbudPortfolioUrl: driveUrl } };
      expect(validateRegistrationPayload(withPortfolio, config).success).toBe(true);
    });

    it("menolak link portofolio Senbud non-Google-Drive", () => {
      const input = payload();
      input.choices[0].departmentId = senbud;
      input.uploads.senbudInstagramEvidence = {
        id: "40000000-0000-4000-8000-000000000005",
        kind: "SENBUD_INSTAGRAM",
        name: "bukti-ig.jpg",
        sizeBytes: 100,
        mimeType: "image/jpeg",
      };
      input.departmentFields.senbudPortfolioUrl = "https://example.test/portfolio";
      expect(validateRegistrationPayload(input, config)).toMatchObject({
        success: false,
        errors: { "departmentFields.senbudPortfolioUrl": expect.any(String) },
      });
    });

    it("tidak wajib bukti Instagram jika Senbud bukan salah satu pilihan", () => {
      expect(validateRegistrationPayload(payload(), config).success).toBe(true);
    });
  });

  // "Tambahan Field Khusus Ristek".
  describe("Field khusus Ristek", () => {
    it("menerima Ristek tanpa link portofolio (opsional)", () => {
      const input = payload();
      input.choices[0].departmentId = ristek;
      expect(validateRegistrationPayload(input, config).success).toBe(true);
    });

    it("menerima Ristek dengan link Google Drive valid", () => {
      const input = payload();
      input.choices[0].departmentId = ristek;
      input.departmentFields.ristekPortfolioUrl = driveUrl;
      expect(validateRegistrationPayload(input, config).success).toBe(true);
    });

    it("menolak link portofolio Ristek non-Google-Drive", () => {
      const input = payload();
      input.choices[0].departmentId = ristek;
      input.departmentFields.ristekPortfolioUrl = "https://example.test/portfolio";
      expect(validateRegistrationPayload(input, config)).toMatchObject({
        success: false,
        errors: { "departmentFields.ristekPortfolioUrl": expect.any(String) },
      });
    });
  });
});
