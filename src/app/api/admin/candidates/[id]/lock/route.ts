import { validateLockInput, validateUnlockInput } from "@/features/candidates/lock-validation";
import { authErrorResponse, readJsonObject } from "@/server/auth/api-response";
import { requireAuthenticatedUser, requirePermission } from "@/server/auth/guard";
import { noStoreJson } from "@/server/auth/http";
import { assertValidCsrf } from "@/server/auth/security";
import { CandidateLockError, lockCandidate, unlockCandidate } from "@/server/candidates/lock";
import { resolveRequestDepartmentId } from "@/server/candidates/request-scope";

type RouteContext = { params: Promise<{ id: string }> };

function lockErrorResponse(error: unknown): Response | null {
  if (error instanceof CandidateLockError) {
    return noStoreJson({ data: null, error: { code: error.code, message: error.message } }, error.status);
  }
  return null;
}

export async function POST(request: Request, routeContext: RouteContext) {
  try {
    assertValidCsrf(request);
    const { id } = await routeContext.params;
    const context = await requireAuthenticatedUser(request.headers);
    await requirePermission(context, "sekolah.candidate.lock.own_birdep", request.headers);
    const departmentId = await resolveRequestDepartmentId(context, request);

    const body = await readJsonObject(request);
    const parsed = validateLockInput(body);
    if (!parsed.success) {
      return noStoreJson({ data: null, error: { code: "VALIDATION_ERROR", message: "Alasan lock wajib diisi.", fields: parsed.errors } }, 400);
    }

    const lock = await lockCandidate({
      candidateId: id,
      departmentId,
      actorUserId: context.userId,
      actorName: context.name,
      reason: parsed.data.reason,
      headers: request.headers,
    });
    return noStoreJson({ data: lock, error: null }, 201);
  } catch (error) {
    return lockErrorResponse(error) ?? authErrorResponse(error);
  }
}

export async function DELETE(request: Request, routeContext: RouteContext) {
  try {
    assertValidCsrf(request);
    const { id } = await routeContext.params;
    const context = await requireAuthenticatedUser(request.headers);
    await requirePermission(context, "sekolah.candidate.lock.own_birdep", request.headers);
    const departmentId = await resolveRequestDepartmentId(context, request);

    const body = await readJsonObject(request);
    const parsed = validateUnlockInput(body);
    if (!parsed.success) {
      return noStoreJson({ data: null, error: { code: "VALIDATION_ERROR", message: "Alasan unlock wajib diisi.", fields: parsed.errors } }, 400);
    }

    const unlocked = await unlockCandidate({
      candidateId: id,
      departmentId,
      actorUserId: context.userId,
      reason: parsed.data.reason,
      headers: request.headers,
    });
    if (!unlocked) {
      return noStoreJson({ data: null, error: { code: "RESOURCE_NOT_FOUND", message: "Tidak ada lock aktif milik Birdep ini." } }, 404);
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    return lockErrorResponse(error) ?? authErrorResponse(error);
  }
}
