import { validateUpdatePeriodDepartment } from "@/features/admin/period-validation";
import { updatePeriodDepartment } from "@/server/admin/periods";
import { authErrorResponse, readJsonObject } from "@/server/auth/api-response";
import { requireAuthenticatedUser, requireSuperAdmin } from "@/server/auth/guard";
import { noStoreJson } from "@/server/auth/http";
import { assertValidCsrf } from "@/server/auth/security";

type RouteContext = { params: Promise<{ id: string; departmentId: string }> };

export async function PATCH(request: Request, routeContext: RouteContext) {
  try {
    assertValidCsrf(request);
    const { id, departmentId } = await routeContext.params;
    const context = await requireAuthenticatedUser(request.headers);
    await requireSuperAdmin(context, request.headers);

    const body = await readJsonObject(request);
    const parsed = validateUpdatePeriodDepartment(body);
    if (!parsed.success) {
      return noStoreJson({ data: null, error: { code: "VALIDATION_ERROR", message: "Data konfigurasi Birdep tidak valid.", fields: parsed.errors } }, 400);
    }

    const result = await updatePeriodDepartment({
      periodId: id,
      departmentId,
      changes: parsed.data,
      actorUserId: context.userId,
      headers: request.headers,
    });
    if (!result) {
      return noStoreJson({ data: null, error: { code: "RESOURCE_NOT_FOUND", message: "Konfigurasi periode-Birdep tidak ditemukan." } }, 404);
    }
    return noStoreJson({ data: result, error: null });
  } catch (error) {
    return authErrorResponse(error);
  }
}
