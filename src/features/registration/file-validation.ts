import path from "node:path";

import type { UploadKind } from "@/generated/prisma/client";

const MEBIBYTE = 1024 * 1024;

type UploadPolicy = {
  extensions: string[];
  mimeTypes: string[];
  maxBytes: number;
};

function policyFor(kind: UploadKind, portfolioMaxBytes: number): UploadPolicy {
  switch (kind) {
    case "CV":
      return { extensions: [".pdf"], mimeTypes: ["application/pdf"], maxBytes: 2 * MEBIBYTE };
    case "PHOTO":
      return { extensions: [".jpg", ".jpeg", ".png"], mimeTypes: ["image/jpeg", "image/png"], maxBytes: MEBIBYTE };
    case "STUDENT_CARD":
      return { extensions: [".jpg", ".jpeg", ".png", ".pdf"], mimeTypes: ["image/jpeg", "image/png", "application/pdf"], maxBytes: MEBIBYTE };
    case "PORTFOLIO":
      return { extensions: [".jpg", ".jpeg", ".png"], mimeTypes: ["image/jpeg", "image/png"], maxBytes: portfolioMaxBytes };
  }
}

export function detectMimeType(bytes: Uint8Array): string | null {
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) return "application/pdf";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)) return "image/png";
  return null;
}

export class UploadValidationError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
  }
}

export function validateUploadFile(input: {
  kind: UploadKind;
  fileName: string;
  declaredMimeType: string;
  bytes: Uint8Array;
  portfolioMaxBytes?: number;
}): { detectedMimeType: string; extension: string; maxBytes: number } {
  const policy = policyFor(input.kind, input.portfolioMaxBytes ?? 5 * MEBIBYTE);
  const extension = path.extname(input.fileName).toLowerCase();
  if (!policy.extensions.includes(extension)) throw new UploadValidationError("Ekstensi file tidak diizinkan.", "INVALID_EXTENSION");
  if (!policy.mimeTypes.includes(input.declaredMimeType)) throw new UploadValidationError("MIME file tidak diizinkan.", "INVALID_DECLARED_MIME");
  if (input.bytes.byteLength === 0 || input.bytes.byteLength > policy.maxBytes) throw new UploadValidationError("Ukuran file melewati batas yang diizinkan.", "INVALID_SIZE");
  const detectedMimeType = detectMimeType(input.bytes);
  if (!detectedMimeType || detectedMimeType !== input.declaredMimeType) throw new UploadValidationError("Isi file tidak sesuai MIME yang dinyatakan.", "MIME_MISMATCH");
  if (!policy.mimeTypes.includes(detectedMimeType)) throw new UploadValidationError("Magic byte file tidak diizinkan.", "INVALID_MAGIC_BYTE");
  return { detectedMimeType, extension, maxBytes: policy.maxBytes };
}
