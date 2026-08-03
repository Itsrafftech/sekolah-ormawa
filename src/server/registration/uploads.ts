import "server-only";

import { randomUUID } from "node:crypto";
import path from "node:path";

import type { UploadKind } from "@/generated/prisma/client";
import { validateUploadFile } from "@/features/registration/file-validation";
import { prisma } from "@/lib/db";
import { getServerEnvironment } from "@/lib/env";
import { sha256, signValue, verifySignature } from "@/lib/security/crypto";
import { getPrivateStorage, type PrivateStorageAdapter } from "@/server/storage/private-storage";

function safeOriginalFileName(value: string): string {
  return path.basename(value).replace(/[\u0000-\u001f\u007f]/gu, "").slice(0, 255) || "upload";
}

export async function createPrivateUpload(input: {
  periodId: string;
  ownerToken: string;
  kind: UploadKind;
  fileName: string;
  declaredMimeType: string;
  bytes: Uint8Array;
  storage?: PrivateStorageAdapter;
}) {
  const environment = getServerEnvironment();
  const { detectedMimeType, extension } = validateUploadFile({
    ...input,
    portfolioMaxBytes: environment.PORTFOLIO_MAX_FILE_BYTES,
  });
  const objectKey = `${input.periodId}/${randomUUID()}${extension}`;
  const storage = input.storage ?? getPrivateStorage();
  await storage.put(objectKey, input.bytes);
  try {
    return await prisma.fileUpload.create({
      data: {
        periodId: input.periodId,
        kind: input.kind,
        status: "VALIDATED",
        bucket: "development-private",
        objectKey,
        originalFileName: safeOriginalFileName(input.fileName),
        declaredMimeType: input.declaredMimeType,
        detectedMimeType,
        sizeBytes: input.bytes.byteLength,
        checksumSha256: sha256(input.bytes),
        ownerTokenHash: sha256(input.ownerToken),
        uploadedAt: new Date(),
        expiresAt: new Date(Date.now() + environment.REGISTRATION_UPLOAD_TTL_SECONDS * 1000),
      },
      select: {
        id: true,
        kind: true,
        originalFileName: true,
        sizeBytes: true,
        detectedMimeType: true,
      },
    });
  } catch (error) {
    await storage.delete(objectKey);
    throw error;
  }
}

export async function removeOwnedUpload(
  uploadId: string,
  ownerToken: string,
  storage = getPrivateStorage(),
): Promise<boolean> {
  const upload = await prisma.fileUpload.findFirst({
    where: {
      id: uploadId,
      ownerTokenHash: sha256(ownerToken),
      candidateId: null,
      status: { in: ["PENDING", "UPLOADED", "VALIDATED"] },
    },
  });
  if (!upload) return false;
  await storage.delete(upload.objectKey);
  await prisma.fileUpload.update({ where: { id: upload.id }, data: { status: "ORPHANED" } });
  return true;
}

export async function cleanupOrphanUploads(
  now = new Date(),
  storage = getPrivateStorage(),
): Promise<number> {
  const uploads = await prisma.fileUpload.findMany({
    where: { candidateId: null, expiresAt: { lte: now }, status: { not: "FINALIZED" } },
    take: 100,
  });
  for (const upload of uploads) {
    await storage.delete(upload.objectKey);
    await prisma.fileUpload.update({ where: { id: upload.id }, data: { status: "ORPHANED" } });
  }
  return uploads.length;
}

export function createDownloadSignature(uploadId: string, expiresAt: number): string {
  return signValue(`${uploadId}.${expiresAt}`, getServerEnvironment().AUTH_SECRET);
}

export function verifyDownloadSignature(
  uploadId: string,
  expiresAt: number,
  signature: string,
  now = Date.now(),
): boolean {
  return expiresAt > now && verifySignature(
    `${uploadId}.${expiresAt}`,
    signature,
    getServerEnvironment().AUTH_SECRET,
  );
}
