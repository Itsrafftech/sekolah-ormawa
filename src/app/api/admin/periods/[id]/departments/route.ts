import { listPeriodDepartments } from "@/server/admin/periods";
import { authErrorResponse } from "@/server/auth/api-response";
import { requireAuthenticatedUser, requireSuperAdmin } from "@/server/auth/guard";
import { noStoreJson } from "@/server/auth/http";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, routeContext: RouteContext) {
  try {
    const { id } = await routeContext.params;
    const context = await requireAuthenticatedUser(request.headers);
    await requireSuperAdmin(context, request.headers);
    const departments = await listPeriodDepartments(id);
    if (!departments) {
      return noStoreJson({ data: null, error: { code: "RESOURCE_NOT_FOUND", message: "Periode tidak ditemukan." } }, 404);
    }
    return noStoreJson({ data: { departments }, error: null });
  } catch (error) {
    return authErrorResponse(error);
  }
}
