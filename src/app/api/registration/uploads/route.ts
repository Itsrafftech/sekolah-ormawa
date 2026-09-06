import { NextRequest, NextResponse } from "next/server";

import type { UploadKind } from "@/generated/prisma/client";
import { getRegistrationAvailability } from "@/server/registration/config";
import {
  attachRegistrationOwner,
  ensureRegistrationOwner,
} from "@/server/registration/owner";
import { MAX_DOCUMENT_UPLOAD_BYTES, UploadValidationError } from "@/features/registration/file-validation";
import { createPrivateUpload } from "@/server/registration/uploads";
import { AuthServiceError } from "@/server/auth/errors";
import { consumeAuthRateLimit } from "@/server/auth/rate-limit";
import { assertValidCsrf, clientIpHash } from "@/server/auth/security";

// Overhead budget for multipart boundaries/field headers around the file
// itself, so legitimate uploads at the configured max size are not rejected.
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

// PORTFOLIO and BUDGET_PLAN deliberately excluded (Phase D - "Portofolio
// via URL Google Drive", ADR-045): Medbrand/Badmedbrnd's portfolio and
// Komanggar's RAB are no longer uploads - a request for either kind is
// now rejected here as an invalid payload, same as any unrecognized kind.
const uploadKinds = new Set<UploadKind>(["CV", "PHOTO", "STUDENT_CARD"]);

export async function POST(request: NextRequest) {
  try {
    assertValidCsrf(request);
  } catch (error) {
    const message = error instanceof AuthServiceError ? error.message : "Request state-changing tidak sah.";
    return NextResponse.json({ error: message }, { status: 403 });
  }

  try {
    await consumeAuthRateLimit({
      scope: "REGISTRATION_UPLOAD",
      identity: "public",
      ipHash: clientIpHash(request.headers),
      maximum: 30,
    });
  } catch {
    return NextResponse.json(
      { error: "Terlalu banyak percobaan unggah. Tunggu sebelum mencoba kembali." },
      { status: 429 },
    );
  }

  const availability = await getRegistrationAvailability();
  if (availability.state !== "OPEN") {
    return NextResponse.json({ error: availability.detail }, { status: 409 });
  }

  // Reject oversized requests from the Content-Length header before ever
  // buffering the body: file-validation.ts only checks size after
  // request.formData() has already read the whole payload into memory,
  // which by itself does not protect against a large-body memory
  // exhaustion attempt.
  const declaredLength = Number(request.headers.get("content-length") ?? "");
  // `kind` isn't known yet at this point (it's still inside the
  // not-yet-parsed multipart body) - use the largest cap among the still-
  // accepted kinds (CV/PHOTO/STUDENT_CARD) so none is falsely rejected
  // here before file-validation ever gets to apply the kind-specific
  // limit for real.
  const maxAllowedBytes = MAX_DOCUMENT_UPLOAD_BYTES + MULTIPART_OVERHEAD_BYTES;
  if (Number.isFinite(declaredLength) && declaredLength > maxAllowedBytes) {
    return NextResponse.json({ error: "Ukuran file melebihi batas yang diizinkan." }, { status: 413 });
  }

  const formData = await request.formData();
  const periodId = formData.get("periodId");
  const kind = formData.get("kind");
  const file = formData.get("file");
  if (
    typeof periodId !== "string" || periodId !== availability.config.periodId ||
    typeof kind !== "string" || !uploadKinds.has(kind as UploadKind) ||
    !(file instanceof File)
  ) {
    return NextResponse.json({ error: "Payload upload tidak valid." }, { status: 400 });
  }

  const owner = ensureRegistrationOwner(request);
  try {
    const upload = await createPrivateUpload({
      periodId,
      ownerToken: owner.token,
      kind: kind as UploadKind,
      fileName: file.name,
      declaredMimeType: file.type,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    const response = NextResponse.json({
      upload: {
        id: upload.id,
        kind: upload.kind,
        name: upload.originalFileName,
        sizeBytes: upload.sizeBytes,
        mimeType: upload.detectedMimeType,
      },
    }, { status: 201 });
    if (owner.created) attachRegistrationOwner(response, owner.token);
    return response;
  } catch (error) {
    if (error instanceof UploadValidationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 422 });
    }
    return NextResponse.json({ error: "Upload privat gagal diproses." }, { status: 500 });
  }
}
