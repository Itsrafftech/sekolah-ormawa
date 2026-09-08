import { authErrorResponse } from "@/server/auth/api-response";
import { requireAnyPermission, requireAuthenticatedUser } from "@/server/auth/guard";
import { noStoreJson } from "@/server/auth/http";
import { getCandidateDetail } from "@/server/candidates/detail";
import { resolveRequestDepartmentId } from "@/server/candidates/request-scope";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, routeContext: RouteContext) {
  try {
    const { id } = await routeContext.params;
    const context = await requireAuthenticatedUser(request.headers);
    await requireAnyPermission(context, ["sekolah.candidate.read.own_birdep", "sekolah.candidate.read.all"], request.headers);
    const departmentId = await resolveRequestDepartmentId(context, request);

    const detail = await getCandidateDetail(id, departmentId);
    if (!detail) {
      return noStoreJson({ data: null, error: { code: "RESOURCE_NOT_FOUND", message: "Kandidat tidak ditemukan." } }, 404);
    }
    return noStoreJson({ data: detail, error: null });
  } catch (error) {
    return authErrorResponse(error);
  }
}
