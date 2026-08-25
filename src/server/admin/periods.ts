import "server-only";

import type {
  PeriodDepartmentItem,
  PeriodListItem,
  UpdatePeriodDepartmentInput,
  UpdatePeriodInput,
} from "@/features/admin/period-contracts";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/server/auth/audit";

function toListItem(period: {
  id: string;
  code: string;
  name: string;
  status: string;
  configStatus: string;
  cohortCode: number;
  entryYear: number | null;
  registrationPrefix: string | null;
  opensAt: Date | null;
  closesAt: Date | null;
  choice2Required: boolean;
  allowUnlock: boolean;
  consentVersion: string | null;
  retentionDays: number | null;
  _count: { candidates: number };
}): PeriodListItem {
  return {
    id: period.id,
    code: period.code,
    name: period.name,
    status: period.status as PeriodListItem["status"],
    configStatus: period.configStatus as PeriodListItem["configStatus"],
    cohortCode: period.cohortCode,
    entryYear: period.entryYear,
    registrationPrefix: period.registrationPrefix,
    opensAt: period.opensAt ? period.opensAt.toISOString() : null,
    closesAt: period.closesAt ? period.closesAt.toISOString() : null,
    choice2Required: period.choice2Required,
    allowUnlock: period.allowUnlock,
    consentVersion: period.consentVersion,
    retentionDays: period.retentionDays,
    candidateCount: period._count.candidates,
  };
}

export async function listPeriods(): Promise<PeriodListItem[]> {
  const periods = await prisma.recruitmentPeriod.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { candidates: true } } },
  });
  return periods.map(toListItem);
}

export async function updatePeriod(input: {
  periodId: string;
  changes: UpdatePeriodInput;
  actorUserId: string;
  headers: Headers;
}): Promise<PeriodListItem | null> {
  const existing = await prisma.recruitmentPeriod.findUnique({ where: { id: input.periodId } });
  if (!existing) return null;

  const { opensAt, closesAt, ...rest } = input.changes;
  const updated = await prisma.recruitmentPeriod.update({
    where: { id: existing.id },
    data: {
      ...rest,
      ...(opensAt !== undefined ? { opensAt: opensAt ? new Date(opensAt) : null } : {}),
      ...(closesAt !== undefined ? { closesAt: closesAt ? new Date(closesAt) : null } : {}),
    },
    include: { _count: { select: { candidates: true } } },
  });

  await writeAuditLog({
    action: "UPDATE",
    headers: input.headers,
    actorUserId: input.actorUserId,
    entityType: "RECRUITMENT_PERIOD",
    entityId: updated.id,
    beforeJson: { status: existing.status, configStatus: existing.configStatus, allowUnlock: existing.allowUnlock },
    afterJson: { status: updated.status, configStatus: updated.configStatus, allowUnlock: updated.allowUnlock },
  });

  return toListItem(updated);
}

export async function listPeriodDepartments(periodId: string): Promise<PeriodDepartmentItem[] | null> {
  const period = await prisma.recruitmentPeriod.findUnique({ where: { id: periodId } });
  if (!period) return null;

  const rows = await prisma.periodDepartment.findMany({
    where: { periodId },
    include: { department: { select: { name: true, code: true } } },
    orderBy: { department: { sortOrder: "asc" } },
  });
  return rows.map((row) => ({
    departmentId: row.departmentId,
    departmentName: row.department.name,
    departmentCode: row.department.code,
    acceptsApplications: row.acceptsApplications,
    quota: row.quota,
  }));
}

export async function updatePeriodDepartment(input: {
  periodId: string;
  departmentId: string;
  changes: UpdatePeriodDepartmentInput;
  actorUserId: string;
  headers: Headers;
}): Promise<PeriodDepartmentItem | null> {
  const existing = await prisma.periodDepartment.findUnique({
    where: { periodId_departmentId: { periodId: input.periodId, departmentId: input.departmentId } },
    include: { department: { select: { name: true, code: true } } },
  });
  if (!existing) return null;

  const updated = await prisma.periodDepartment.update({
    where: { id: existing.id },
    data: input.changes,
    include: { department: { select: { name: true, code: true } } },
  });

  await writeAuditLog({
    action: "UPDATE",
    headers: input.headers,
    actorUserId: input.actorUserId,
    entityType: "PERIOD_DEPARTMENT",
    entityId: updated.id,
    departmentId: updated.departmentId,
    beforeJson: { acceptsApplications: existing.acceptsApplications, quota: existing.quota },
    afterJson: { acceptsApplications: updated.acceptsApplications, quota: updated.quota },
  });

  return {
    departmentId: updated.departmentId,
    departmentName: updated.department.name,
    departmentCode: updated.department.code,
    acceptsApplications: updated.acceptsApplications,
    quota: updated.quota,
  };
}
