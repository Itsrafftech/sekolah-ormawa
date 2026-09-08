import { buildCandidateExportCsv } from "@/server/candidates/export";
import { authErrorResponse } from "@/server/auth/api-response";
import { requireAnyPermission, requireAuthenticatedUser } from "@/server/auth/guard";
import { consumeAuthRateLimit } from "@/server/auth/rate-limit";
import { clientIpHash } from "@/server/auth/security";
import { resolveDashboardPeriod } from "@/server/candidates/period";
import { resolveRequestDepartmentId } from "@/server/candidates/request-scope";

export async function GET(request: Request) {
  try {
    const context = await requireAuthenticatedUser(request.headers);
    await requireAnyPermission(context, ["sekolah.export.own_birdep", "sekolah.export.all"], request.headers);
    const departmentId = await resolveRequestDepartmentId(context, request);
    await consumeAuthRateLimit({
      scope: "ADMIN_EXPORT",
      identity: context.userId,
      ipHash: clientIpHash(request.headers),
      maximum: 10,
    });

    const period = await resolveDashboardPeriod();
    const csv = period
      ? await buildCandidateExportCsv({ departmentId, periodId: period.id })
      : "";

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="kandidat-${departmentId}.csv"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
