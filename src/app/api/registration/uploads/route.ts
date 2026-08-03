import { NextRequest, NextResponse } from "next/server";

import type { UploadKind } from "@/generated/prisma/client";
import { getRegistrationAvailability } from "@/server/registration/config";
import {
  attachRegistrationOwner,
  ensureRegistrationOwner,
} from "@/server/registration/owner";
import { UploadValidationError } from "@/features/registration/file-validation";
import { createPrivateUpload } from "@/server/registration/uploads";

const uploadKinds = new Set<UploadKind>(["CV", "PHOTO", "STUDENT_CARD", "PORTFOLIO"]);

export async function POST(request: NextRequest) {
  const availability = await getRegistrationAvailability();
  if (availability.state !== "OPEN") {
    return NextResponse.json({ error: availability.detail }, { status: 409 });
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
