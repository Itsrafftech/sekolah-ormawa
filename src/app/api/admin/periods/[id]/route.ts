import { validateUpdatePeriod } from "@/features/admin/period-validation";
import { updatePeriod } from "@/server/admin/periods";
import { authErrorResponse, readJsonObject } from "@/server/auth/api-response";
import { requireAuthenticatedUser, requireSuperAdmin } from "@/server/auth/guard";
import { noStoreJson } from "@/server/auth/http";
import { assertValidCsrf } from "@/server/auth/security";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, routeContext: RouteContext) {
  try {
    assertValidCsrf(request);
    const { id } = await routeContext.params;
    const context = await requireAuthenticatedUser(request.headers);
    await requireSuperAdmin(context, request.headers);

    const body = await readJsonObject(request);
    const parsed = validateUpdatePeriod(body);
    if (!parsed.success) {
      return noStoreJson({ data: null, error: { code: "VALIDATION_ERROR", message: "Data periode tidak valid.", fields: parsed.errors } }, 400);
    }

    const period = await updatePeriod({
      periodId: id,
      changes: parsed.data,
      actorUserId: context.userId,
      headers: request.headers,
    });
    if (!period) {
      return noStoreJson({ data: null, error: { code: "RESOURCE_NOT_FOUND", message: "Periode tidak ditemukan." } }, 404);
    }
    return noStoreJson({ data: period, error: null });
  } catch (error) {
    return authErrorResponse(error);
  }
}
