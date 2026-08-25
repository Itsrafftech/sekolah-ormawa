import type { PlacementStatusValue } from "@/features/candidates/contracts";

export type LockActionInput = {
  reason: string;
};

export type UnlockActionInput = {
  reason: string;
};

export type PlacementUpdateInput = {
  status: PlacementStatusValue;
  mentorLabel?: string;
  reason?: string;
};
