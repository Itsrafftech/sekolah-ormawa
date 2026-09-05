export const SELECTION_STATUS_VALUES = [
  "PENDING",
  "TAKEN",
  "HESITANT_P1",
  "FORWARDED",
  "TAKEN_P2",
  "HESITANT_P2",
  "ELIMINATED",
] as const;

export type SelectionStatusValue = (typeof SELECTION_STATUS_VALUES)[number];

export type SelectionDecisionSummary = {
  id: string;
  candidateId: string;
  status: SelectionStatusValue;
  primaryDeptId: string;
  secondaryDeptId: string;
  decidedByP1UserId: string | null;
  decidedByP2UserId: string | null;
  p1DecidedAt: string | null;
  p2DecidedAt: string | null;
  p1Reason: string | null;
  p2Reason: string | null;
  overrideByAdminId: string | null;
  overrideReason: string | null;
  updatedAt: string;
};

export type SelectionActionInput = {
  reason?: string;
};

export type SelectionAdminActionInput = {
  reason: string;
};
