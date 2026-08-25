export type LockedCandidateItem = {
  candidateId: string;
  candidateName: string;
  registrationNumber: string | null;
  departmentId: string;
  departmentName: string;
  lockedByName: string;
  lockedAt: string;
  lockReason: string | null;
};

export type DeletedCandidateItem = {
  id: string;
  name: string;
  registrationNumber: string | null;
  deletedAt: string;
};
