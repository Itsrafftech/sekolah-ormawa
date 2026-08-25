import type { PlacementStatusValue } from "@/features/candidates/contracts";

export type BroadcastFilter = {
  periodId: string;
  departmentId?: string;
  placementStatus?: PlacementStatusValue;
};

export type BroadcastContent = {
  subject: string;
  body: string;
};

export type BroadcastPreviewResult = {
  count: number;
  sample: string[];
  previewToken: string;
  expiresAt: string;
};

export type BroadcastSendResult = {
  sent: number;
};
