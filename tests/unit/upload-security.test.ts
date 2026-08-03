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
    expect(detectMimeType(pdf)).toBe("application/pdf");
    expect(detectMimeType(jpeg)).toBe("image/jpeg");
    expect(detectMimeType(png)).toBe("image/png");
  });

  it("menerima CV PDF dan portfolio JPG/PNG valid", () => {
    expect(validateUploadFile({ kind: "CV", fileName: "fixture.pdf", declaredMimeType: "application/pdf", bytes: pdf }).detectedMimeType).toBe("application/pdf");
    expect(validateUploadFile({ kind: "PORTFOLIO", fileName: "fixture.png", declaredMimeType: "image/png", bytes: png }).detectedMimeType).toBe("image/png");
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
});
