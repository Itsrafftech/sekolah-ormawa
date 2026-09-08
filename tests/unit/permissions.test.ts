import { describe, expect, it } from "vitest";

import {
  assertValidDepartmentScope,
  hasAllDepartmentAccess,
  hasSchoolPermission,
  SCHOOL_PERMISSIONS,
} from "@/lib/auth/permissions";

describe("role dan department scope", () => {
  it("menerima SUPER_ADMIN tanpa department", () => {
    expect(() =>
      assertValidDepartmentScope({
        role: "SUPER_ADMIN",
        departmentId: null,
      }),
    ).not.toThrow();
  });

  it("menerima DEPT_PJ dengan department", () => {
    expect(() =>
      assertValidDepartmentScope({
        role: "DEPT_PJ",
        departmentId: "department-fixture",
      }),
    ).not.toThrow();
  });

  it("menolak kombinasi scope yang tidak valid", () => {
    expect(() =>
      assertValidDepartmentScope({ role: "DEPT_PJ", departmentId: null }),
    ).toThrow("DEPT_PJ wajib memiliki departmentId");

    expect(() =>
      assertValidDepartmentScope({
        role: "SUPER_ADMIN",
        departmentId: "department-fixture",
      }),
    ).toThrow("SUPER_ADMIN tidak boleh memiliki departmentId");
  });

  // "Tambah Role Baru dan 2 Akun": KETUA_PELAKSANA - seperti SUPER_ADMIN,
  // tidak boleh punya departmentId (lintas-Birdep lewat switcher, bukan
  // scope tetap).
  it("menerima KETUA_PELAKSANA tanpa department, menolak dengan department", () => {
    expect(() =>
      assertValidDepartmentScope({ role: "KETUA_PELAKSANA", departmentId: null }),
    ).not.toThrow();

    expect(() =>
      assertValidDepartmentScope({
        role: "KETUA_PELAKSANA",
        departmentId: "department-fixture",
      }),
    ).toThrow("KETUA_PELAKSANA tidak boleh memiliki departmentId");
  });
});

// "Tambah Role Baru dan 2 Akun": matriks BISA/TIDAK BISA persis spesifikasi
// - dicek langsung terhadap hasSchoolPermission, bukan lewat HTTP (itu
// tugas tests/integration/authorization-matrix.test.ts).
describe("permission KETUA_PELAKSANA", () => {
  it("bisa: read-all kandidat, export-all, broadcast, audit log", () => {
    expect(hasSchoolPermission("KETUA_PELAKSANA", SCHOOL_PERMISSIONS.CANDIDATE_READ_ALL)).toBe(true);
    expect(hasSchoolPermission("KETUA_PELAKSANA", SCHOOL_PERMISSIONS.EXPORT_ALL)).toBe(true);
    expect(hasSchoolPermission("KETUA_PELAKSANA", SCHOOL_PERMISSIONS.BROADCAST_SEND)).toBe(true);
    expect(hasSchoolPermission("KETUA_PELAKSANA", SCHOOL_PERMISSIONS.LOGS_READ)).toBe(true);
    expect(hasAllDepartmentAccess("KETUA_PELAKSANA")).toBe(true);
  });

  it("tidak bisa: sekolah.admin.all atau permission scope-own_birdep milik DEPT_PJ", () => {
    expect(hasSchoolPermission("KETUA_PELAKSANA", SCHOOL_PERMISSIONS.ADMIN_ALL)).toBe(false);
    expect(hasSchoolPermission("KETUA_PELAKSANA", SCHOOL_PERMISSIONS.CANDIDATE_READ_OWN)).toBe(false);
    expect(hasSchoolPermission("KETUA_PELAKSANA", SCHOOL_PERMISSIONS.CANDIDATE_LOCK_OWN)).toBe(false);
    expect(hasSchoolPermission("KETUA_PELAKSANA", SCHOOL_PERMISSIONS.NOTE_MANAGE_OWN)).toBe(false);
    expect(hasSchoolPermission("KETUA_PELAKSANA", SCHOOL_PERMISSIONS.EXPORT_OWN)).toBe(false);
  });

  it("DEPT_PJ tidak mendapat permission baru KETUA_PELAKSANA", () => {
    expect(hasSchoolPermission("DEPT_PJ", SCHOOL_PERMISSIONS.CANDIDATE_READ_ALL)).toBe(false);
    expect(hasSchoolPermission("DEPT_PJ", SCHOOL_PERMISSIONS.EXPORT_ALL)).toBe(false);
    expect(hasSchoolPermission("DEPT_PJ", SCHOOL_PERMISSIONS.BROADCAST_SEND)).toBe(false);
    expect(hasSchoolPermission("DEPT_PJ", SCHOOL_PERMISSIONS.LOGS_READ)).toBe(false);
    expect(hasAllDepartmentAccess("DEPT_PJ")).toBe(false);
  });

  it("SUPER_ADMIN tetap punya semua permission termasuk yang baru", () => {
    expect(hasSchoolPermission("SUPER_ADMIN", SCHOOL_PERMISSIONS.CANDIDATE_READ_ALL)).toBe(true);
    expect(hasSchoolPermission("SUPER_ADMIN", SCHOOL_PERMISSIONS.EXPORT_ALL)).toBe(true);
    expect(hasSchoolPermission("SUPER_ADMIN", SCHOOL_PERMISSIONS.BROADCAST_SEND)).toBe(true);
    expect(hasSchoolPermission("SUPER_ADMIN", SCHOOL_PERMISSIONS.LOGS_READ)).toBe(true);
    expect(hasAllDepartmentAccess("SUPER_ADMIN")).toBe(true);
  });
});
