import { authErrorResponse } from "@/server/auth/api-response";
import { requireAuthenticatedUser, requirePermission } from "@/server/auth/guard";
import { consumeAuthRateLimit } from "@/server/auth/rate-limit";
import { clientIpHash } from "@/server/auth/security";
import { readScopedCandidateFile } from "@/server/candidates/files";
import { resolveRequestDepartmentId } from "@/server/candidates/request-scope";

type RouteContext = { params: Promise<{ id: string; fileId: string }> };

export async function GET(request: Request, routeContext: RouteContext) {
  try {
    const { id, fileId } = await routeContext.params;
    const context = await requireAuthenticatedUser(request.headers);
    await requirePermission(context, "sekolah.candidate.read.own_birdep", request.headers);
    const departmentId = await resolveRequestDepartmentId(context, request);
    await consumeAuthRateLimit({
      scope: "ADMIN_FILE_ACCESS",
      identity: context.userId,
      ipHash: clientIpHash(request.headers),
      maximum: 60,
    });

    const file = await readScopedCandidateFile({
      candidateId: id,
      fileId,
      departmentId,
      actorUserId: context.userId,
      headers: request.headers,
    });
    if (!file) {
      return new Response(JSON.stringify({ error: "File tidak ditemukan." }), {
        status: 404,
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
      });
    }

    return new Response(new Uint8Array(file.bytes), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="${encodeURIComponent(file.originalFileName)}"`,
        "Content-Type": file.detectedMimeType ?? "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
