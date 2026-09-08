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
  // "Tambah Role Baru dan 2 Akun": KETUA_PELAKSANA - lintas-Birdep,
  // read-only (SUPER_ADMIN juga memilikinya lewat grant "semua permission").
  CANDIDATE_READ_ALL: "sekolah.candidate.read.all",
  EXPORT_ALL: "sekolah.export.all",
  BROADCAST_SEND: "sekolah.broadcast.send",
  LOGS_READ: "sekolah.logs.read",
} as const;

const statements = {
  ...defaultStatements,
  sekolah: [
    "admin-all",
    "candidate-read-own-birdep",
    "candidate-lock-own-birdep",
    "note-manage-own-birdep",
    "export-own-birdep",
    "candidate-read-all",
    "export-all",
    "broadcast-send",
    "logs-read",
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
    "candidate-read-all",
    "export-all",
    "broadcast-send",
    "logs-read",
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

// "Tambah Role Baru dan 2 Akun": read-only lintas-Birdep + export +
// broadcast + audit log - TIDAK ADA admin-all (kelola periode/akun/
// override/delete tetap eksklusif SUPER_ADMIN, lihat requireSuperAdmin).
export const ketuaPelaksanaRole = accessControl.newRole({
  sekolah: [
    "candidate-read-all",
    "export-all",
    "broadcast-send",
    "logs-read",
  ],
});

export const authRoles = {
  SUPER_ADMIN: superAdminRole,
  DEPT_PJ: departmentPjRole,
  KETUA_PELAKSANA: ketuaPelaksanaRole,
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
  KETUA_PELAKSANA: new Set([
    SCHOOL_PERMISSIONS.CANDIDATE_READ_ALL,
    SCHOOL_PERMISSIONS.EXPORT_ALL,
    SCHOOL_PERMISSIONS.BROADCAST_SEND,
    SCHOOL_PERMISSIONS.LOGS_READ,
  ]),
};

export function isAppRole(role: string): role is AppRole {
  return role === "SUPER_ADMIN" || role === "DEPT_PJ" || role === "KETUA_PELAKSANA";
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

// "Tambah Role Baru dan 2 Akun": KETUA_PELAKSANA tidak punya scope Birdep
// sendiri (seperti SUPER_ADMIN) - melihat lintas-Birdep lewat department
// switcher, bukan lewat departmentId tetap di sesi.
export function hasAllDepartmentAccess(role: AppRole): boolean {
  return role === "SUPER_ADMIN" || role === "KETUA_PELAKSANA";
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

  if (role !== "DEPT_PJ" && departmentId) {
    throw new Error(`${role} tidak boleh memiliki departmentId.`);
  }
}
