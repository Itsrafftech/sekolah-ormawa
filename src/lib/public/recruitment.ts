import "server-only";

import type {
  ConfigStatus,
  PeriodStatus,
  UnitType,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getServerEnvironment } from "@/lib/env";
import {
  resolveRegistrationState,
  type PublicRegistration,
} from "@/lib/public/registration-state";

export { resolveRegistrationState } from "@/lib/public/registration-state";
export type { PublicRegistration } from "@/lib/public/registration-state";

export type PublicPeriod = {
  id: string;
  name: string;
  status: PeriodStatus;
  configStatus: ConfigStatus;
  cohortCode: number;
  opensAt: Date | null;
  closesAt: Date | null;
};

export type PublicDepartment = {
  id: string;
  code: string;
  name: string;
  shortName: string;
  unitType: UnitType;
  description: string | null;
  configStatus: ConfigStatus;
  acceptsApplications: boolean;
  requiresPortfolio: boolean;
};

export type PublicLandingData = {
  source: "database" | "error";
  registration: PublicRegistration;
  departments: PublicDepartment[];
};

function chooseRelevantPeriod(periods: PublicPeriod[], now: Date): PublicPeriod | null {
  const openPeriod = periods.find(
    (period) => resolveRegistrationState(period, now).state === "OPEN",
  );

  return openPeriod ?? periods[0] ?? null;
}

export async function getPublicLandingData(
  now = new Date(),
): Promise<PublicLandingData> {
  try {
    const [periods, departments] = await Promise.all([
      prisma.recruitmentPeriod.findMany({
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          id: true,
          name: true,
          status: true,
          configStatus: true,
          cohortCode: true,
          opensAt: true,
          closesAt: true,
        },
      }),
      prisma.department.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          code: true,
          name: true,
          shortName: true,
          unitType: true,
          description: true,
          configStatus: true,
        },
      }),
    ]);

    const period = chooseRelevantPeriod(periods, now);
    const registration = resolveRegistrationState(period, now);
    const submissionEnabled = getServerEnvironment().REGISTRATION_SUBMISSION_ENABLED;
    const availability = period
      ? await prisma.periodDepartment.findMany({
          where: { periodId: period.id },
          select: { departmentId: true, acceptsApplications: true },
        })
      : [];
    const acceptanceByDepartment = new Map(
      availability.map((item) => [item.departmentId, item.acceptsApplications]),
    );

    return {
      source: "database",
      registration:
        registration.state === "OPEN" && !submissionEnabled
          ? {
              ...registration,
              state: "UPCOMING",
              label: "Pendaftaran belum diaktifkan",
              detail: "Form masih dikunci oleh konfigurasi rilis.",
              href: null,
            }
          : registration,
      departments: departments.map((department) => ({
        ...department,
        acceptsApplications:
          period?.status === "OPEN" &&
          period.configStatus === "ACTIVE" &&
          acceptanceByDepartment.get(department.id) === true,
        requiresPortfolio: department.code === "MEDBRAND",
      })),
    };
  } catch {
    return {
      source: "error",
      registration: {
        state: "UNAVAILABLE",
        label: "Status belum tersedia",
        detail: "Status pendaftaran tidak dapat dimuat. Coba kembali nanti.",
        href: null,
        periodName: null,
      },
      departments: [],
    };
  }
}
