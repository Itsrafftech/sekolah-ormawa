import "server-only";

import { hasAllDepartmentAccess } from "@/lib/auth/permissions";
import type { AdminContext } from "@/server/auth/guard";
import { requireDepartmentAccess } from "@/server/auth/guard";
import { AuthServiceError } from "@/server/auth/errors";
import { isCandidateOwningDepartment } from "@/server/candidates/departments";

/**
 * Resolves the department a candidate-dashboard request may operate on.
 * DEPT_PJ is always pinned to their own session department. A role with
 * all-department access (SUPER_ADMIN, and since "Tambah Role Baru dan 2
 * Akun" also KETUA_PELAKSANA) must pass ?departmentId=; the id is
 * validated against active, candidate-owning departments so an
 * arbitrary/foreign UUID cannot be probed.
 */
export async function resolveRequestDepartmentId(
  context: AdminContext,
  request: Request,
): Promise<string> {
  const requested = new URL(request.url).searchParams.get("departmentId");
  const departmentId = await requireDepartmentAccess(context, requested, request.headers);
  if (hasAllDepartmentAccess(context.role) && !(await isCandidateOwningDepartment(departmentId))) {
    throw new AuthServiceError("RESOURCE_NOT_FOUND", 404, "Department tidak ditemukan.");
  }
  return departmentId;
}
