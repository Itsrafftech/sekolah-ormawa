import { describe, expect, it } from "vitest";

import {
  sanitizeAdminRedirect,
  validatePasswordPolicy,
} from "@/features/auth/contracts";
import {
  SCHOOL_PERMISSIONS,
  hasSchoolPermission,
  permissionsForRole,
} from "@/lib/auth/permissions";
import { AuthServiceError } from "@/server/auth/errors";
import { assertValidCsrf } from "@/server/auth/security";

describe("Phase 4 auth security foundation", () => {
  it("menerima passphrase panjang dan menolak batas di luar 12-128 tanpa memotong", () => {
    expect(validatePasswordPolicy("passphrase panjang yang aman", 128)).toBeNull();
    expect(validatePasswordPolicy("pendek", 128)).toContain("minimal");
    expect(validatePasswordPolicy("x".repeat(129), 128)).toContain("maksimal");
  });

  it("menolak open redirect dan hanya menerima path admin internal", () => {
    expect(sanitizeAdminRedirect("https://evil.example/admin/dashboard")).toBe("/admin/dashboard");
    expect(sanitizeAdminRedirect("//evil.example/admin/dashboard")).toBe("/admin/dashboard");
    expect(sanitizeAdminRedirect("/admin/login?next=https://evil.example")).toBe("/admin/dashboard");
    expect(sanitizeAdminRedirect("/admin/dashboard?tab=session")).toBe("/admin/dashboard?tab=session");
  });

  it("memisahkan permission SUPER_ADMIN dan DEPT_PJ", () => {
    expect(hasSchoolPermission("SUPER_ADMIN", SCHOOL_PERMISSIONS.ADMIN_ALL)).toBe(true);
    expect(hasSchoolPermission("DEPT_PJ", SCHOOL_PERMISSIONS.ADMIN_ALL)).toBe(false);
    expect(permissionsForRole("DEPT_PJ")).toEqual(expect.arrayContaining([
      SCHOOL_PERMISSIONS.CANDIDATE_READ_OWN,
      SCHOOL_PERMISSIONS.CANDIDATE_LOCK_OWN,
      SCHOOL_PERMISSIONS.NOTE_MANAGE_OWN,
      SCHOOL_PERMISSIONS.EXPORT_OWN,
    ]));
  });

  it("menolak state-changing request tanpa origin atau dari origin asing", () => {
    expect(() => assertValidCsrf(new Request("http://localhost:3000/api/admin/auth/logout", {
      method: "POST",
    }), "http://localhost:3000")).toThrow(AuthServiceError);
    expect(() => assertValidCsrf(new Request("http://localhost:3000/api/admin/auth/logout", {
      method: "POST",
      headers: { Origin: "https://evil.example", "Sec-Fetch-Site": "cross-site" },
    }), "http://localhost:3000")).toThrow("tidak sah");
    expect(() => assertValidCsrf(new Request("http://localhost:3000/api/admin/auth/logout", {
      method: "POST",
      headers: { Origin: "http://localhost:3000", "Sec-Fetch-Site": "same-origin" },
    }), "http://localhost:3000")).not.toThrow();
  });
});
