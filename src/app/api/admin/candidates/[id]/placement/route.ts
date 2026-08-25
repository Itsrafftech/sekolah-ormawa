import { validatePlacementInput } from "@/features/candidates/lock-validation";
import { authErrorResponse, readJsonObject } from "@/server/auth/api-response";
import { requireAuthenticatedUser, requirePermission } from "@/server/auth/guard";
import { noStoreJson } from "@/server/auth/http";
import { assertValidCsrf } from "@/server/auth/security";
import { updateCandidatePlacement } from "@/server/candidates/placement";
import { resolveRequestDepartmentId } from "@/server/candidates/request-scope";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, routeContext: RouteContext) {
  try {
    assertValidCsrf(request);
    const { id } = await routeContext.params;
    const context = await requireAuthenticatedUser(request.headers);
    await requirePermission(context, "sekolah.candidate.lock.own_birdep", request.headers);
    const departmentId = await resolveRequestDepartmentId(context, request);

    const body = await readJsonObject(request);
    const parsed = validatePlacementInput(body);
    if (!parsed.success) {
      return noStoreJson({ data: null, error: { code: "VALIDATION_ERROR", message: "Status placement tidak valid.", fields: parsed.errors } }, 400);
    }

    const placement = await updateCandidatePlacement({
      candidateId: id,
      departmentId,
      actorUserId: context.userId,
      status: parsed.data.status,
      mentorLabel: parsed.data.mentorLabel,
      reason: parsed.data.reason,
      headers: request.headers,
    });
    if (!placement) {
      return noStoreJson({ data: null, error: { code: "RESOURCE_NOT_FOUND", message: "Kandidat tidak terkunci oleh Birdep ini." } }, 404);
    }
    return noStoreJson({ data: placement, error: null });
  } catch (error) {
    return authErrorResponse(error);
  }
}
