import { validateSelectionActionInput } from "@/features/candidates/selection-validation";
import { authErrorResponse, readJsonObject } from "@/server/auth/api-response";
import { requireAuthenticatedUser, requirePermission } from "@/server/auth/guard";
import { noStoreJson } from "@/server/auth/http";
import { assertValidCsrf } from "@/server/auth/security";
import { forwardToSecondary, SelectionDecisionError } from "@/server/candidates/selection";
import { resolveRequestDepartmentId } from "@/server/candidates/request-scope";

type RouteContext = { params: Promise<{ id: string }> };

function selectionErrorResponse(error: unknown): Response | null {
  if (error instanceof SelectionDecisionError) {
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

    const parsed = validateSelectionActionInput(await readJsonObject(request));
    if (!parsed.success) {
      return noStoreJson({ data: null, error: { code: "VALIDATION_ERROR", message: "Data tidak valid.", fields: parsed.errors } }, 400);
    }

    const result = await forwardToSecondary({
      candidateId: id,
      departmentId,
      actorUserId: context.userId,
      reason: parsed.data.reason,
      headers: request.headers,
    });
    return noStoreJson({ data: result, error: null });
  } catch (error) {
    return selectionErrorResponse(error) ?? authErrorResponse(error);
  }
}
