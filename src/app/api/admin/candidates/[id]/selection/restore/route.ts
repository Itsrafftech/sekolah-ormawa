import { validateSelectionAdminActionInput } from "@/features/candidates/selection-validation";
import { authErrorResponse, readJsonObject } from "@/server/auth/api-response";
import { requireAuthenticatedUser, requireSuperAdmin } from "@/server/auth/guard";
import { noStoreJson } from "@/server/auth/http";
import { assertValidCsrf } from "@/server/auth/security";
import { restoreEliminatedCandidate, SelectionDecisionError } from "@/server/candidates/selection";

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
    await requireSuperAdmin(context, request.headers);

    const parsed = validateSelectionAdminActionInput(await readJsonObject(request));
    if (!parsed.success) {
      return noStoreJson({ data: null, error: { code: "VALIDATION_ERROR", message: "Alasan restore wajib diisi.", fields: parsed.errors } }, 400);
    }

    const result = await restoreEliminatedCandidate({
      candidateId: id,
      actorUserId: context.userId,
      reason: parsed.data.reason,
      headers: request.headers,
    });
    return noStoreJson({ data: result, error: null });
  } catch (error) {
    return selectionErrorResponse(error) ?? authErrorResponse(error);
  }
}
