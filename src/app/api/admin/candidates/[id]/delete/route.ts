import { CandidateAdminError, softDeleteCandidate } from "@/server/admin/candidate-admin";
import { authErrorResponse } from "@/server/auth/api-response";
import { requireAuthenticatedUser, requireSuperAdmin } from "@/server/auth/guard";
import { noStoreJson } from "@/server/auth/http";
import { assertValidCsrf } from "@/server/auth/security";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, routeContext: RouteContext) {
  try {
    assertValidCsrf(request);
    const { id } = await routeContext.params;
    const context = await requireAuthenticatedUser(request.headers);
    await requireSuperAdmin(context, request.headers);

    const deleted = await softDeleteCandidate({
      candidateId: id,
      actorUserId: context.userId,
      headers: request.headers,
    });
    if (!deleted) {
      return noStoreJson({ data: null, error: { code: "RESOURCE_NOT_FOUND", message: "Kandidat tidak ditemukan." } }, 404);
    }
    return noStoreJson({ data: { deleted: true }, error: null });
  } catch (error) {
    if (error instanceof CandidateAdminError) {
      return noStoreJson({ data: null, error: { code: error.code, message: error.message } }, error.status);
    }
    return authErrorResponse(error);
  }
}
