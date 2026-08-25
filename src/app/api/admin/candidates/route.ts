import { parseCandidateListQuery } from "@/features/candidates/validation";
import { authErrorResponse } from "@/server/auth/api-response";
import { requireAuthenticatedUser, requirePermission } from "@/server/auth/guard";
import { noStoreJson } from "@/server/auth/http";
import { listCandidatesForDepartment } from "@/server/candidates/list";
import { resolveDashboardPeriod } from "@/server/candidates/period";
import { resolveRequestDepartmentId } from "@/server/candidates/request-scope";

export async function GET(request: Request) {
  try {
    const context = await requireAuthenticatedUser(request.headers);
    await requirePermission(context, "sekolah.candidate.read.own_birdep", request.headers);
    const departmentId = await resolveRequestDepartmentId(context, request);

    const parsed = parseCandidateListQuery(new URL(request.url).searchParams);
    if (!parsed.success) {
      return noStoreJson({ data: null, error: { code: "VALIDATION_ERROR", message: "Parameter tidak valid.", fields: parsed.errors } }, 400);
    }

    const period = await resolveDashboardPeriod();
    if (!period) {
      return noStoreJson({
        data: {
          period: null,
          items: [],
          nextCursor: null,
          counts: { PRIMARY: 0, SECONDARY: 0, LOCKED: 0 },
          departmentId,
        },
        error: null,
      });
    }

    const result = await listCandidatesForDepartment({
      departmentId,
      periodId: period.id,
      query: parsed.data,
    });

    return noStoreJson({
      data: { period, departmentId, ...result },
      error: null,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
