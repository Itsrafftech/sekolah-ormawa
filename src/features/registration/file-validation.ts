import path from "node:path";

import type { UploadKind } from "@/generated/prisma/client";

const MEBIBYTE = 1024 * 1024;

// Largest cap among the upload kinds still accepted (FOLLOW_EVIDENCE's
// 10MB is the largest of CV/PHOTO/STUDENT_CARD/FOLLOW_EVIDENCE) -
// exported so the upload API route can size its pre-`formData()`
// Content-Length check without duplicating the policy numbers or
// reaching into a retired PORTFOLIO/BUDGET_PLAN cap.
export const MAX_DOCUMENT_UPLOAD_BYTES = 10 * MEBIBYTE;

type UploadPolicy = {
  extensions: string[];
  mimeTypes: string[];
  maxBytes: number;
};

function policyFor(kind: UploadKind): UploadPolicy {
  switch (kind) {
    case "CV":
      return { extensions: [".pdf"], mimeTypes: ["application/pdf"], maxBytes: 2 * MEBIBYTE };
    case "PHOTO":
      return { extensions: [".jpg", ".jpeg", ".png"], mimeTypes: ["image/jpeg", "image/png"], maxBytes: MEBIBYTE };
    case "STUDENT_CARD":
      return { extensions: [".jpg", ".jpeg", ".png", ".pdf"], mimeTypes: ["image/jpeg", "image/png", "application/pdf"], maxBytes: MEBIBYTE };
    // Retired Phase D (ADR-045): Medbrand/Badmedbrnd's portfolio and
    // Komanggar's RAB moved from in-app file upload to a plain Google
    // Drive URL (CandidateSupplementalData.portfolioUrl/budgetPlanUrl) -
    // no code path should ever call validateUploadFile() with either kind
    // (the upload API rejects them outright, src/app/api/registration/
    // uploads/route.ts), but this switch stays exhaustive over UploadKind
    // since Postgres can't drop the now-unused enum values. An
    // impossible-to-satisfy policy (empty allow-lists) keeps this safe
    // even if somehow reached.
    case "PORTFOLIO":
    case "BUDGET_PLAN":
      return { extensions: [], mimeTypes: [], maxBytes: 0 };
    // UAT feedback - "persyaratan follow dan share": one required PDF
    // (all screenshots combined) per candidate, 10MB cap - same shape as
    // CV's policy, just a larger size allowance since it can hold many
    // screenshots.
    case "FOLLOW_EVIDENCE":
      return { extensions: [".pdf"], mimeTypes: ["application/pdf"], maxBytes: 10 * MEBIBYTE };
  }
}

// Returns every MIME type consistent with the file's magic bytes, not a
// single best guess (kept as an array - see git history/ADR-043 - even
// though PDF/JPEG/PNG are each unambiguous on their own; ZIP/XLS/XLSX
// detection was removed in Phase D (ADR-045) along with the PORTFOLIO/
// BUDGET_PLAN upload kinds that were its only callers). Returns an empty
// array when nothing recognized matches.
export function detectMimeType(bytes: Uint8Array): string[] {
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) {
    return ["application/pdf"];
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return ["image/jpeg"];
  }
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)) {
    return ["image/png"];
  }
  return [];
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
}): { detectedMimeType: string; extension: string; maxBytes: number } {
  const policy = policyFor(input.kind);
  const extension = path.extname(input.fileName).toLowerCase();
  if (!policy.extensions.includes(extension)) throw new UploadValidationError("Ekstensi file tidak diizinkan.", "INVALID_EXTENSION");
  if (!policy.mimeTypes.includes(input.declaredMimeType)) throw new UploadValidationError("MIME file tidak diizinkan.", "INVALID_DECLARED_MIME");
  if (input.bytes.byteLength === 0 || input.bytes.byteLength > policy.maxBytes) throw new UploadValidationError("Ukuran file melewati batas yang diizinkan.", "INVALID_SIZE");
  const detectedMimeTypes = detectMimeType(input.bytes);
  if (detectedMimeTypes.length === 0 || !detectedMimeTypes.includes(input.declaredMimeType)) {
    throw new UploadValidationError("Isi file tidak sesuai MIME yang dinyatakan.", "MIME_MISMATCH");
  }
  if (!policy.mimeTypes.some((mimeType) => detectedMimeTypes.includes(mimeType))) {
    throw new UploadValidationError("Magic byte file tidak diizinkan.", "INVALID_MAGIC_BYTE");
  }
  return { detectedMimeType: input.declaredMimeType, extension, maxBytes: policy.maxBytes };
}
