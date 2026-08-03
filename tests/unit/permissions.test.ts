import { describe, expect, it } from "vitest";

import { assertValidDepartmentScope } from "@/lib/auth/permissions";

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
});
