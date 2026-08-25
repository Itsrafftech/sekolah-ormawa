import { validateUnlockInput } from "@/features/candidates/lock-validation";
import { authErrorResponse, readJsonObject } from "@/server/auth/api-response";
import { requireAuthenticatedUser, requireSuperAdmin } from "@/server/auth/guard";
import { noStoreJson } from "@/server/auth/http";
import { assertValidCsrf } from "@/server/auth/security";
import { CandidateLockError, overrideUnlockCandidate } from "@/server/candidates/lock";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, routeContext: RouteContext) {
  try {
    assertValidCsrf(request);
    const { id } = await routeContext.params;
    const context = await requireAuthenticatedUser(request.headers);
    await requireSuperAdmin(context, request.headers);

    const parsed = validateUnlockInput(await readJsonObject(request));
    if (!parsed.success) {
      return noStoreJson({ data: null, error: { code: "VALIDATION_ERROR", message: "Alasan override wajib diisi.", fields: parsed.errors } }, 400);
    }

    const overridden = await overrideUnlockCandidate({
      candidateId: id,
      actorUserId: context.userId,
      reason: parsed.data.reason,
      headers: request.headers,
    });
    if (!overridden) {
      return noStoreJson({ data: null, error: { code: "RESOURCE_NOT_FOUND", message: "Tidak ada lock aktif pada kandidat ini." } }, 404);
    }
    return noStoreJson({ data: { overridden: true }, error: null });
  } catch (error) {
    if (error instanceof CandidateLockError) {
      return noStoreJson({ data: null, error: { code: error.code, message: error.message } }, error.status);
    }
    return authErrorResponse(error);
  }
}
