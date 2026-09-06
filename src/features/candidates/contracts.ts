import type { SelectionStatusValue } from "@/features/candidates/selection-contracts";

// "LOCKED" is a legacy key name (candidate_locks era) kept to avoid a wide
// rename - its meaning is now "Diterima Birdep ini" (accepted via the
// selection decision system: TAKEN as Pilihan 1, or TAKEN_P2 as Pilihan 2).
export type CandidateSegment = "PRIMARY" | "SECONDARY" | "LOCKED";

export type SelectionRole = "P1" | "P2";

export type CandidateSelectionInfo = {
  status: SelectionStatusValue;
  role: SelectionRole;
};

export const CANDIDATE_SORT_KEYS = [
  "submittedAt_asc",
  "submittedAt_desc",
  "name_asc",
  "name_desc",
] as const;

export type CandidateSortKey = (typeof CANDIDATE_SORT_KEYS)[number];

export type CandidateListQuery = {
  segment: CandidateSegment;
  search: string | null;
  cursor: string | null;
  limit: number;
  sort: CandidateSortKey;
  departmentId: string | null;
};

export type CandidateListItem = {
  id: string;
  registrationNumber: string | null;
  name: string;
  nim: string;
  studyProgramName: string;
  rank: "PRIMARY" | "SECONDARY";
  status: "SUBMITTED" | "LOCKED" | "WITHDRAWN" | "ARCHIVED";
  submittedAt: string;
  selection: CandidateSelectionInfo | null;
};

export type CandidateListResult = {
  items: CandidateListItem[];
  nextCursor: string | null;
  counts: Record<CandidateSegment, number>;
};

// Phase D (ADR-045): PORTFOLIO/BUDGET_PLAN removed - both retired as
// upload kinds, replaced by a Google Drive URL (see
// CandidateSupplementalSummary.portfolioUrl/budgetPlanUrl below).
export type CandidateUploadSummary = {
  id: string;
  kind: "CV" | "PHOTO" | "STUDENT_CARD";
  originalFileName: string;
  sizeBytes: number;
  detectedMimeType: string | null;
};

export type CandidateChoiceSummary = {
  departmentId: string;
  departmentName: string;
  departmentCode: string;
  rank: "PRIMARY" | "SECONDARY";
  motivation: string;
  contribution: string | null;
};

export type CandidateLockSummary = {
  id: string;
  departmentId: string;
  departmentName: string;
  lockedByName: string;
  lockedAt: string;
  lockReason: string | null;
};

export type PlacementStatusValue =
  | "UNDER_REVIEW"
  | "PLACED"
  | "WAITLISTED"
  | "NOT_SELECTED"
  | "WITHDRAWN";

export const PLACEMENT_STATUS_VALUES: readonly PlacementStatusValue[] = [
  "UNDER_REVIEW",
  "PLACED",
  "WAITLISTED",
  "NOT_SELECTED",
  "WITHDRAWN",
];

export type CandidatePlacementSummary = {
  status: PlacementStatusValue;
  mentorLabel: string | null;
  reason: string | null;
  placedAt: string | null;
  updatedAt: string;
};

// Phase C - "Field Khusus Per Birdep" (ADR-043). Each field is nulled out
// server-side (src/server/candidates/detail.ts) unless the viewer's
// CURRENT department scope (their own department for DEPT_PJ - always
// fixed - or whichever department Super Admin has switched into, per the
// department-switcher pattern from ADR-028) is the one that field
// belongs to. `null` on the whole object means none of these fields are
// visible/applicable for this viewer+candidate pair, not that the section
// should render empty - the UI hides the section entirely in that case.
// Phase D (ADR-045): portfolioUrl (Medbrand/Badmedbrnd) and budgetPlanUrl
// (Komanggar) are plain Google Drive URL strings, scoped the same way as
// komitMbti/adkesmahFocus - no more CandidateUploadSummary/file involved.
export type CandidateSupplementalSummary = {
  komitMbti: string | null;
  adkesmahFocus: "ADVOCACY" | "WELFARE" | null;
  portfolioUrl: string | null;
  budgetPlanUrl: string | null;
};

export type CandidateSelectionDetail = {
  status: SelectionStatusValue;
  role: SelectionRole;
  primaryDeptId: string;
  primaryDeptName: string;
  secondaryDeptId: string;
  secondaryDeptName: string;
  p1Reason: string | null;
  p2Reason: string | null;
  p1DecidedAt: string | null;
  p2DecidedAt: string | null;
};

export type CandidateDetail = {
  id: string;
  registrationNumber: string | null;
  name: string;
  nim: string;
  className: string;
  studyProgramName: string;
  phone: string;
  email: string;
  domicile: string;
  essayOrgExperience: string;
  essayContribution: string;
  essayBalance: string;
  status: "SUBMITTED" | "LOCKED" | "WITHDRAWN" | "ARCHIVED";
  submittedAt: string;
  choices: CandidateChoiceSummary[];
  uploads: CandidateUploadSummary[];
  supplemental: CandidateSupplementalSummary | null;
  activeLock: CandidateLockSummary | null;
  placement: CandidatePlacementSummary | null;
  selection: CandidateSelectionDetail | null;
};

export type DepartmentNoteDto = {
  id: string;
  candidateId: string;
  body: string;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
};

export type DepartmentOption = {
  id: string;
  code: string;
  name: string;
  shortName: string;
};
