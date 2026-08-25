import "server-only";

import type { DepartmentOption } from "@/features/candidates/contracts";
import { prisma } from "@/lib/db";

/**
 * Departments that can own a Dashboard PJ candidate queue. BPH is excluded
 * because it never accepts applicants (same rule as the public registration
 * config in src/server/registration/config.ts).
 */
export async function listCandidateOwningDepartments(): Promise<DepartmentOption[]> {
  const departments = await prisma.department.findMany({
    where: { isActive: true, unitType: { not: "BPH" } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, code: true, name: true, shortName: true },
  });
  return departments;
}

export async function isCandidateOwningDepartment(departmentId: string): Promise<boolean> {
  const department = await prisma.department.findFirst({
    where: { id: departmentId, isActive: true, unitType: { not: "BPH" } },
    select: { id: true },
  });
  return department !== null;
}
