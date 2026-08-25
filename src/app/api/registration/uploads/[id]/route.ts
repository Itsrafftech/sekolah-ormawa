import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { sha256 } from "@/lib/security/crypto";
import { AuthServiceError } from "@/server/auth/errors";
import { consumeAuthRateLimit } from "@/server/auth/rate-limit";
import { assertValidCsrf, clientIpHash } from "@/server/auth/security";
import { readRegistrationOwner } from "@/server/registration/owner";
import {
  removeOwnedUpload,
  verifyDownloadSignature,
} from "@/server/registration/uploads";
import { getPrivateStorage } from "@/server/storage/private-storage";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await consumeAuthRateLimit({
      scope: "REGISTRATION_DOWNLOAD",
      identity: "public",
      ipHash: clientIpHash(request.headers),
      maximum: 60,
    });
  } catch {
    return NextResponse.json({ error: "Terlalu banyak percobaan. Tunggu sebelum mencoba kembali." }, { status: 429 });
  }

  const { id } = await context.params;
  const ownerToken = readRegistrationOwner(request);
  const expiresAt = Number(request.nextUrl.searchParams.get("expires"));
  const signature = request.nextUrl.searchParams.get("signature") ?? "";
  if (!ownerToken || !Number.isSafeInteger(expiresAt) ||
      !verifyDownloadSignature(id, expiresAt, signature)) {
    return NextResponse.json({ error: "Akses file tidak sah atau kedaluwarsa." }, { status: 401 });
  }

  const upload = await prisma.fileUpload.findFirst({
    where: { id, ownerTokenHash: sha256(ownerToken), status: { in: ["VALIDATED", "FINALIZED"] } },
  });
  if (!upload) return NextResponse.json({ error: "File tidak ditemukan." }, { status: 404 });

  const bytes = await getPrivateStorage().read(upload.objectKey);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(upload.originalFileName)}"`,
      "Content-Type": upload.detectedMimeType ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    assertValidCsrf(request);
  } catch (error) {
    const message = error instanceof AuthServiceError ? error.message : "Request state-changing tidak sah.";
    return NextResponse.json({ error: message }, { status: 403 });
  }
  const { id } = await context.params;
  const ownerToken = readRegistrationOwner(request);
  if (!ownerToken) return NextResponse.json({ error: "Ownership upload tidak tersedia." }, { status: 401 });
  const removed = await removeOwnedUpload(id, ownerToken);
  return removed
    ? new NextResponse(null, { status: 204 })
    : NextResponse.json({ error: "Upload tidak ditemukan atau sudah difinalisasi." }, { status: 404 });
}
