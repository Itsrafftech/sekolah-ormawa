import "server-only";

import { headers as nextHeaders } from "next/headers";

import { auth } from "@/lib/auth";
import {
  hasSchoolPermission,
  isAppRole,
  permissionsForRole,
  type AppRole,
  type SchoolPermission,
} from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { getServerEnvironment } from "@/lib/env";
import { writeAuthAudit } from "@/server/auth/audit";
import { AuthServiceError } from "@/server/auth/errors";

export type AdminContext = {
  userId: string;
  sessionId: string;
  name: string;
  email: string;
  role: AppRole;
  departmentId: string | null;
  departmentName: string | null;
  mustChangePassword: boolean;
  permissions: SchoolPermission[];
};

async function invalidateSession(sessionId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { id: sessionId } });
}

export async function requireAuthenticatedUser(
  requestHeaders?: Headers,
  now = new Date(),
): Promise<AdminContext> {
  const headers = requestHeaders ?? await nextHeaders();
  const session = await auth.api.getSession({ headers });
  if (!session) {
    throw new AuthServiceError("UNAUTHENTICATED", 401, "Sesi tidak tersedia atau telah berakhir.");
  }

  const record = await prisma.session.findUnique({
    where: { id: session.session.id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          departmentId: true,
          department: { select: { name: true, isActive: true } },
          mustChangePassword: true,
          temporaryPasswordExpiresAt: true,
          banned: true,
          isActive: true,
          sessionVersion: true,
        },
      },
    },
  });
  if (!record) {
    throw new AuthServiceError("SESSION_REVOKED", 401, "Sesi telah dicabut.");
  }

  const idleDeadline = new Date(
    record.updatedAt.getTime() + getServerEnvironment().SESSION_IDLE_TIMEOUT_SECONDS * 1000,
  );
  if (record.expiresAt <= now || record.absoluteExpiresAt <= now || idleDeadline <= now) {
    await invalidateSession(record.id);
    throw new AuthServiceError("SESSION_EXPIRED", 401, "Sesi telah berakhir.");
  }

  const user = record.user;
  if (record.sessionVersion !== user.sessionVersion) {
    await invalidateSession(record.id);
    throw new AuthServiceError("SESSION_REVOKED", 401, "Sesi telah dicabut.");
  }
  if (!user.isActive || user.banned || !isAppRole(user.role)) {
    await invalidateSession(record.id);
    throw new AuthServiceError("FORBIDDEN", 403, "Akun tidak dapat mengakses area admin.");
  }
  if (user.role === "DEPT_PJ" && (!user.departmentId || !user.department?.isActive)) {
    await invalidateSession(record.id);
    throw new AuthServiceError("INVALID_DEPARTMENT_SCOPE", 403, "Scope Birdep tidak valid.");
  }
  if (user.role === "SUPER_ADMIN" && user.departmentId) {
    await invalidateSession(record.id);
    throw new AuthServiceError("INVALID_DEPARTMENT_SCOPE", 403, "Scope Super Admin tidak valid.");
  }
  if (
    user.mustChangePassword &&
    user.temporaryPasswordExpiresAt &&
    user.temporaryPasswordExpiresAt <= now
  ) {
    throw new AuthServiceError(
      "TEMPORARY_PASSWORD_EXPIRED",
      403,
      "Password sementara telah kedaluwarsa. Gunakan reset password.",
    );
  }

  return {
    userId: user.id,
    sessionId: record.id,
    name: user.name,
    email: user.email,
    role: user.role,
    departmentId: user.departmentId,
    departmentName: user.department?.name ?? null,
    mustChangePassword: user.mustChangePassword,
    permissions: permissionsForRole(user.role),
  };
}

export async function requireAdminContext(): Promise<AdminContext> {
  return requireAuthenticatedUser();
}

export function requirePasswordChanged(context: AdminContext): AdminContext {
  if (context.mustChangePassword) {
    throw new AuthServiceError(
      "PASSWORD_CHANGE_REQUIRED",
      403,
      "Password wajib diganti sebelum melanjutkan.",
    );
  }
  return context;
}

async function auditDenied(
  context: AdminContext,
  requestHeaders: Headers | undefined,
  reason: string,
): Promise<void> {
  if (!requestHeaders) return;
  await writeAuthAudit({
    action: "AUTHORIZATION_DENIED",
    headers: requestHeaders,
    actorUserId: context.userId,
    entityId: context.userId,
    reason,
  });
}

export async function requirePermission(
  context: AdminContext,
  permission: SchoolPermission,
  requestHeaders?: Headers,
): Promise<AdminContext> {
  requirePasswordChanged(context);
  if (!hasSchoolPermission(context.role, permission)) {
    await auditDenied(context, requestHeaders, `permission:${permission}`);
    throw new AuthServiceError("FORBIDDEN", 403, "Akses tidak diizinkan.");
  }
  return context;
}

export async function requireSuperAdmin(
  context: AdminContext,
  requestHeaders?: Headers,
): Promise<AdminContext> {
  requirePasswordChanged(context);
  if (context.role !== "SUPER_ADMIN") {
    await auditDenied(context, requestHeaders, "role:SUPER_ADMIN");
    throw new AuthServiceError("FORBIDDEN", 403, "Akses tidak diizinkan.");
  }
  return context;
}

export function requireDepartmentScope(context: AdminContext): string {
  requirePasswordChanged(context);
  if (context.role !== "DEPT_PJ" || !context.departmentId) {
    throw new AuthServiceError("INVALID_DEPARTMENT_SCOPE", 403, "Scope Birdep wajib tersedia.");
  }
  return context.departmentId;
}

export async function requireDepartmentResourceScope(
  context: AdminContext,
  resourceDepartmentId: string,
  requestHeaders?: Headers,
): Promise<string> {
  const departmentId = requireDepartmentScope(context);
  if (resourceDepartmentId !== departmentId) {
    await auditDenied(context, requestHeaders, "resource-outside-department-scope");
    throw new AuthServiceError("RESOURCE_NOT_FOUND", 404, "Resource tidak ditemukan.");
  }
  return departmentId;
}

/**
 * Resolve the department a request is allowed to operate on for shared
 * PJ/Super Admin dashboard resources (Phase 5+). SUPER_ADMIN may access any
 * department; DEPT_PJ is always pinned to their own session department and
 * any mismatch is treated as an out-of-scope resource (404), matching
 * ADR-025's enumeration-reduction rule used elsewhere in the guard.
 */
export async function requireDepartmentAccess(
  context: AdminContext,
  requestedDepartmentId: string | null,
  requestHeaders?: Headers,
): Promise<string> {
  requirePasswordChanged(context);
  if (context.role === "SUPER_ADMIN") {
    if (!requestedDepartmentId) {
      throw new AuthServiceError("VALIDATION_ERROR", 400, "Department wajib dipilih.");
    }
    return requestedDepartmentId;
  }
  const departmentId = requireDepartmentScope(context);
  if (requestedDepartmentId && requestedDepartmentId !== departmentId) {
    await auditDenied(context, requestHeaders, "resource-outside-department-scope");
    throw new AuthServiceError("RESOURCE_NOT_FOUND", 404, "Resource tidak ditemukan.");
  }
  return departmentId;
}
