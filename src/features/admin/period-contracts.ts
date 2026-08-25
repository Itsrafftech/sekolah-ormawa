export type PeriodStatusValue = "DRAFT" | "OPEN" | "CLOSED" | "ARCHIVED";
export type ConfigStatusValue = "DRAFT" | "ACTIVE" | "ARCHIVED";

export const PERIOD_STATUS_VALUES: readonly PeriodStatusValue[] = [
  "DRAFT",
  "OPEN",
  "CLOSED",
  "ARCHIVED",
];

export const CONFIG_STATUS_VALUES: readonly ConfigStatusValue[] = [
  "DRAFT",
  "ACTIVE",
  "ARCHIVED",
];

export type PeriodListItem = {
  id: string;
  code: string;
  name: string;
  status: PeriodStatusValue;
  configStatus: ConfigStatusValue;
  cohortCode: number;
  entryYear: number | null;
  registrationPrefix: string | null;
  opensAt: string | null;
  closesAt: string | null;
  choice2Required: boolean;
  allowUnlock: boolean;
  consentVersion: string | null;
  retentionDays: number | null;
  candidateCount: number;
};

export type UpdatePeriodInput = {
  name?: string;
  status?: PeriodStatusValue;
  configStatus?: ConfigStatusValue;
  entryYear?: number | null;
  registrationPrefix?: string | null;
  opensAt?: string | null;
  closesAt?: string | null;
  choice2Required?: boolean;
  allowUnlock?: boolean;
  consentVersion?: string | null;
  retentionDays?: number | null;
};

export type PeriodDepartmentItem = {
  departmentId: string;
  departmentName: string;
  departmentCode: string;
  acceptsApplications: boolean;
  quota: number | null;
};

export type UpdatePeriodDepartmentInput = {
  acceptsApplications?: boolean;
  quota?: number | null;
};
