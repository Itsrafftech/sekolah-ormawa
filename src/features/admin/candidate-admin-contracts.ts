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
  /**
   * True when this candidate was soft-deleted by the selection decision
   * system's "Gugurkan" action (SelectionDecision.status === "ELIMINATED"),
   * as opposed to a plain Super Admin danger-zone delete. Restoring an
   * eliminated candidate must also reset their decision back to PENDING,
   * so the UI routes it through a different endpoint (and requires a
   * reason) than a plain restore.
   */
  eliminated: boolean;
};
