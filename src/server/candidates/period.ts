import "server-only";

import { prisma } from "@/lib/db";

export type DashboardPeriod = {
  id: string;
  name: string;
  status: string;
};

/**
 * Phase 5 dashboards operate on a single implicit period: the most recently
 * created recruitment period, regardless of its OPEN/CLOSED status, so PJ
 * can keep reviewing candidates after registration closes. A period
 * selector for Super Admin belongs to Phase 7 (ADM-02) period management.
 */
export async function resolveDashboardPeriod(): Promise<DashboardPeriod | null> {
  const period = await prisma.recruitmentPeriod.findFirst({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, status: true },
  });
  return period;
}
