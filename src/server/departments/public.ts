import "server-only";

import type { DepartmentsByTrack, PublicDepartmentOption } from "@/features/registration/contracts";
import { prisma } from "@/lib/db";

export type { DepartmentsByTrack, PublicDepartmentOption };

/**
 * Public, unauthenticated department listing grouped by organizational
 * branch (Phase A - "Jalur Legislatif"). Same active/non-BPH filter as
 * listCandidateOwningDepartments (src/server/candidates/departments.ts) -
 * BPH never accepts applicants under either track.
 */
export async function listDepartmentsByTrack(): Promise<DepartmentsByTrack> {
  const departments = await prisma.department.findMany({
    where: { isActive: true, unitType: { not: "BPH" } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, code: true, name: true, shortName: true, track: true },
  });

  const executive: PublicDepartmentOption[] = [];
  const legislative: PublicDepartmentOption[] = [];
  for (const { track, ...option } of departments) {
    (track === "LEGISLATIVE" ? legislative : executive).push(option);
  }
  return { executive, legislative };
}
