import "server-only";

import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/server/auth/audit";
import { findScopedCandidateId } from "@/server/candidates/scope";
import { getPrivateStorage } from "@/server/storage/private-storage";

export type ScopedCandidateFile = {
  originalFileName: string;
  detectedMimeType: string | null;
  bytes: Buffer;
};

/**
 * Serves a candidate document (CV/photo/student card/portfolio file) to an
 * authorized PJ/Super Admin. Authorization is enforced per-request against
 * the session's department scope (RUNBOOK.md: dashboard replaces the
 * owner-token/HMAC policy used by the public registration flow), and every
 * successful access is written to the audit trail.
 */
export async function readScopedCandidateFile(input: {
  candidateId: string;
  fileId: string;
  departmentId: string;
  actorUserId: string;
  headers: Headers;
}): Promise<ScopedCandidateFile | null> {
  const scopedId = await findScopedCandidateId(input.candidateId, input.departmentId);
  if (!scopedId) return null;

  const upload = await prisma.fileUpload.findFirst({
    where: {
      id: input.fileId,
      candidateId: scopedId,
      status: { in: ["VALIDATED", "FINALIZED"] },
    },
  });
  if (!upload) return null;

  const bytes = await getPrivateStorage().read(upload.objectKey);

  await writeAuditLog({
    action: "FILE_VIEW",
    headers: input.headers,
    actorUserId: input.actorUserId,
    entityType: "FILE_UPLOAD",
    entityId: upload.id,
    departmentId: input.departmentId,
    afterJson: { candidateId: scopedId, kind: upload.kind },
  });

  return {
    originalFileName: upload.originalFileName,
    detectedMimeType: upload.detectedMimeType,
    bytes,
  };
}
