import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements,
} from "better-auth/plugins/admin/access";

export const SCHOOL_PERMISSIONS = {
  ADMIN_ALL: "sekolah.admin.all",
  CANDIDATE_READ_OWN: "sekolah.candidate.read.own_birdep",
  CANDIDATE_LOCK_OWN: "sekolah.candidate.lock.own_birdep",
  NOTE_MANAGE_OWN: "sekolah.note.manage.own_birdep",
  EXPORT_OWN: "sekolah.export.own_birdep",
} as const;

const statements = {
  ...defaultStatements,
  sekolah: [
    "admin-all",
    "candidate-read-own-birdep",
    "candidate-lock-own-birdep",
    "note-manage-own-birdep",
    "export-own-birdep",
  ],
} as const;

export const accessControl = createAccessControl(statements);

export const superAdminRole = accessControl.newRole({
  ...adminAc.statements,
  sekolah: [
    "admin-all",
    "candidate-read-own-birdep",
    "candidate-lock-own-birdep",
    "note-manage-own-birdep",
    "export-own-birdep",
  ],
});

export const departmentPjRole = accessControl.newRole({
  sekolah: [
    "candidate-read-own-birdep",
    "candidate-lock-own-birdep",
    "note-manage-own-birdep",
    "export-own-birdep",
  ],
});

export const authRoles = {
  SUPER_ADMIN: superAdminRole,
  DEPT_PJ: departmentPjRole,
};

export type AppRole = keyof typeof authRoles;
export type SchoolPermission = (typeof SCHOOL_PERMISSIONS)[keyof typeof SCHOOL_PERMISSIONS];

const rolePermissions: Record<AppRole, ReadonlySet<SchoolPermission>> = {
  SUPER_ADMIN: new Set(Object.values(SCHOOL_PERMISSIONS)),
  DEPT_PJ: new Set([
    SCHOOL_PERMISSIONS.CANDIDATE_READ_OWN,
    SCHOOL_PERMISSIONS.CANDIDATE_LOCK_OWN,
    SCHOOL_PERMISSIONS.NOTE_MANAGE_OWN,
    SCHOOL_PERMISSIONS.EXPORT_OWN,
  ]),
};

export function isAppRole(role: string): role is AppRole {
  return role === "SUPER_ADMIN" || role === "DEPT_PJ";
}

export function permissionsForRole(role: AppRole): SchoolPermission[] {
  return [...rolePermissions[role]];
}

export function hasSchoolPermission(
  role: AppRole,
  permission: SchoolPermission,
): boolean {
  return rolePermissions[role].has(permission);
}

export function assertValidDepartmentScope({
  role,
  departmentId,
}: {
  role: AppRole;
  departmentId: string | null;
}): void {
  if (role === "DEPT_PJ" && !departmentId) {
    throw new Error("DEPT_PJ wajib memiliki departmentId.");
  }

  if (role === "SUPER_ADMIN" && departmentId) {
    throw new Error("SUPER_ADMIN tidak boleh memiliki departmentId.");
  }
}
