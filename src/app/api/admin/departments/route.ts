import { authErrorResponse } from "@/server/auth/api-response";
import { requireAuthenticatedUser, requirePasswordChanged } from "@/server/auth/guard";
import { noStoreJson } from "@/server/auth/http";
import { listCandidateOwningDepartments } from "@/server/candidates/departments";

export async function GET(request: Request) {
  try {
    const context = requirePasswordChanged(
      await requireAuthenticatedUser(request.headers),
    );
    const departments = await listCandidateOwningDepartments();
    return noStoreJson({
      data: {
        departments,
        ownDepartmentId: context.role === "DEPT_PJ" ? context.departmentId : null,
      },
      error: null,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
