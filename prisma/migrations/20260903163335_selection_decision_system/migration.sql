-- Two-stage selection decision system (replaces candidate_locks as the
-- active claiming mechanism - see product decision "PERUBAHAN SISTEM
-- SELEKSI"). candidate_locks is intentionally NOT touched/dropped by this
-- migration - kept for historical reference only.
--
-- Rollback: this migration is purely additive (new enum, new enum values,
-- new table) and does not touch existing data, so roll-forward is safe by
-- default. A genuine rollback would be:
--   DROP TABLE "selection_decisions";
--   DROP TYPE "SelectionStatus";
-- Removing the 6 new AuditAction enum values is NOT safely scriptable in
-- Postgres (ALTER TYPE ... DROP VALUE does not exist) without recreating
-- the whole enum type and remapping every existing audit_logs row - only
-- attempt that if truly necessary, and only after confirming no
-- audit_logs rows use the new values yet.

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'SELECTION_TAKE';
ALTER TYPE "AuditAction" ADD VALUE 'SELECTION_HESITANT';
ALTER TYPE "AuditAction" ADD VALUE 'SELECTION_FORWARD';
ALTER TYPE "AuditAction" ADD VALUE 'SELECTION_ELIMINATE';
ALTER TYPE "AuditAction" ADD VALUE 'SELECTION_RESET';
ALTER TYPE "AuditAction" ADD VALUE 'SELECTION_RESTORE';

-- CreateEnum
CREATE TYPE "SelectionStatus" AS ENUM ('PENDING', 'TAKEN', 'HESITANT_P1', 'FORWARDED', 'TAKEN_P2', 'HESITANT_P2', 'ELIMINATED');

-- CreateTable
CREATE TABLE "selection_decisions" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "primaryDeptId" TEXT NOT NULL,
    "secondaryDeptId" TEXT NOT NULL,
    "status" "SelectionStatus" NOT NULL DEFAULT 'PENDING',
    "decidedByP1UserId" TEXT,
    "decidedByP2UserId" TEXT,
    "p1DecidedAt" TIMESTAMP(3),
    "p2DecidedAt" TIMESTAMP(3),
    "p1Reason" TEXT,
    "p2Reason" TEXT,
    "overrideByAdminId" TEXT,
    "overrideReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "selection_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "selection_decisions_candidateId_key" ON "selection_decisions"("candidateId");

-- CreateIndex
CREATE INDEX "selection_decisions_primaryDeptId_status_idx" ON "selection_decisions"("primaryDeptId", "status");

-- CreateIndex
CREATE INDEX "selection_decisions_secondaryDeptId_status_idx" ON "selection_decisions"("secondaryDeptId", "status");

-- CreateIndex
CREATE INDEX "selection_decisions_periodId_status_idx" ON "selection_decisions"("periodId", "status");

-- AddForeignKey
ALTER TABLE "selection_decisions" ADD CONSTRAINT "selection_decisions_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "selection_decisions" ADD CONSTRAINT "selection_decisions_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "recruitment_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "selection_decisions" ADD CONSTRAINT "selection_decisions_primaryDeptId_fkey" FOREIGN KEY ("primaryDeptId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "selection_decisions" ADD CONSTRAINT "selection_decisions_secondaryDeptId_fkey" FOREIGN KEY ("secondaryDeptId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
