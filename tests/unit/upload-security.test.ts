import { describe, expect, it } from "vitest";

import {
  detectMimeType,
  UploadValidationError,
  validateUploadFile,
} from "@/features/registration/file-validation";

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1]);
const pdf = new TextEncoder().encode("%PDF-1.4 fixture");

describe("private upload validation", () => {
  it("mendeteksi magic byte PDF, JPEG, dan PNG", () => {
    expect(detectMimeType(pdf)).toEqual(["application/pdf"]);
    expect(detectMimeType(jpeg)).toEqual(["image/jpeg"]);
    expect(detectMimeType(png)).toEqual(["image/png"]);
  });

  it("mengembalikan array kosong untuk byte yang tidak dikenali", () => {
    expect(detectMimeType(new Uint8Array([1, 2, 3]))).toEqual([]);
  });

  it("menerima CV PDF dan foto PNG valid", () => {
    expect(validateUploadFile({ kind: "CV", fileName: "fixture.pdf", declaredMimeType: "application/pdf", bytes: pdf }).detectedMimeType).toBe("application/pdf");
    expect(validateUploadFile({ kind: "PHOTO", fileName: "fixture.png", declaredMimeType: "image/png", bytes: png }).detectedMimeType).toBe("image/png");
  });

  it("menolak extension palsu dan MIME tidak cocok", () => {
    expect(() => validateUploadFile({ kind: "CV", fileName: "fixture.pdf", declaredMimeType: "application/pdf", bytes: png })).toThrow(UploadValidationError);
    expect(() => validateUploadFile({ kind: "PHOTO", fileName: "fixture.exe", declaredMimeType: "image/png", bytes: png })).toThrow("Ekstensi");
  });

  it("menolak file di atas batas", () => {
    const oversized = new Uint8Array(1024 * 1024 + 1);
    oversized.set(png);
    expect(() => validateUploadFile({ kind: "PHOTO", fileName: "fixture.png", declaredMimeType: "image/png", bytes: oversized })).toThrow("Ukuran");
  });

  // Phase D - "Portofolio via URL Google Drive" (ADR-045): PORTFOLIO and
  // BUDGET_PLAN are retired as upload kinds - policyFor() returns an
  // impossible-to-satisfy policy for both so any attempted upload of
  // either kind is rejected outright, regardless of file content.
  it("menolak PORTFOLIO dan BUDGET_PLAN - kind upload yang sudah pensiun", () => {
    expect(() =>
      validateUploadFile({ kind: "PORTFOLIO", fileName: "fixture.png", declaredMimeType: "image/png", bytes: png }),
    ).toThrow(UploadValidationError);
    expect(() =>
      validateUploadFile({ kind: "BUDGET_PLAN", fileName: "rab.pdf", declaredMimeType: "application/pdf", bytes: pdf }),
    ).toThrow(UploadValidationError);
  });

  // UAT feedback - "persyaratan follow dan share": PDF only, 10MB cap.
  it("menerima FOLLOW_EVIDENCE PDF valid, menolak non-PDF dan file di atas 10MB", () => {
    expect(validateUploadFile({ kind: "FOLLOW_EVIDENCE", fileName: "bukti.pdf", declaredMimeType: "application/pdf", bytes: pdf }).detectedMimeType).toBe("application/pdf");
    expect(() =>
      validateUploadFile({ kind: "FOLLOW_EVIDENCE", fileName: "bukti.png", declaredMimeType: "image/png", bytes: png }),
    ).toThrow("Ekstensi");
    const oversized = new Uint8Array(10 * 1024 * 1024 + 1);
    oversized.set(pdf);
    expect(() =>
      validateUploadFile({ kind: "FOLLOW_EVIDENCE", fileName: "bukti.pdf", declaredMimeType: "application/pdf", bytes: oversized }),
    ).toThrow("Ukuran");
  });

  // "Guidebook, ketentuan, dan pembayaran": JPG/PNG/PDF, 5MB cap.
  it("menerima PAYMENT_EVIDENCE PDF/JPG/PNG valid, menolak ekstensi lain dan file di atas 5MB", () => {
    expect(validateUploadFile({ kind: "PAYMENT_EVIDENCE", fileName: "bayar.pdf", declaredMimeType: "application/pdf", bytes: pdf }).detectedMimeType).toBe("application/pdf");
    expect(validateUploadFile({ kind: "PAYMENT_EVIDENCE", fileName: "bayar.png", declaredMimeType: "image/png", bytes: png }).detectedMimeType).toBe("image/png");
    expect(validateUploadFile({ kind: "PAYMENT_EVIDENCE", fileName: "bayar.jpg", declaredMimeType: "image/jpeg", bytes: jpeg }).detectedMimeType).toBe("image/jpeg");
    expect(() =>
      validateUploadFile({ kind: "PAYMENT_EVIDENCE", fileName: "bayar.exe", declaredMimeType: "image/png", bytes: png }),
    ).toThrow("Ekstensi");
    const oversized = new Uint8Array(5 * 1024 * 1024 + 1);
    oversized.set(pdf);
    expect(() =>
      validateUploadFile({ kind: "PAYMENT_EVIDENCE", fileName: "bayar.pdf", declaredMimeType: "application/pdf", bytes: oversized }),
    ).toThrow("Ukuran");
  });

  // "Tambahan Field Khusus Senbud": JPG/PNG only (no PDF, unlike
  // PAYMENT_EVIDENCE/STUDENT_CARD), 5MB cap.
  it("menerima SENBUD_INSTAGRAM JPG/PNG valid, menolak PDF dan file di atas 5MB", () => {
    expect(validateUploadFile({ kind: "SENBUD_INSTAGRAM", fileName: "bukti-ig.png", declaredMimeType: "image/png", bytes: png }).detectedMimeType).toBe("image/png");
    expect(validateUploadFile({ kind: "SENBUD_INSTAGRAM", fileName: "bukti-ig.jpg", declaredMimeType: "image/jpeg", bytes: jpeg }).detectedMimeType).toBe("image/jpeg");
    expect(() =>
      validateUploadFile({ kind: "SENBUD_INSTAGRAM", fileName: "bukti-ig.pdf", declaredMimeType: "application/pdf", bytes: pdf }),
    ).toThrow("Ekstensi");
    const oversized = new Uint8Array(5 * 1024 * 1024 + 1);
    oversized.set(png);
    expect(() =>
      validateUploadFile({ kind: "SENBUD_INSTAGRAM", fileName: "bukti-ig.png", declaredMimeType: "image/png", bytes: oversized }),
    ).toThrow("Ukuran");
  });
});
