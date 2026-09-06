-- Phase C - "Field Khusus Per Birdep": adds storage for the two
-- text/choice fields collected only for specific departments (KOMIT's
-- MBTI type, Adkesmah's focus area) via a new 1:1 supplementary table
-- (candidate_supplemental_data), following the same
-- one-row-per-candidate precedent as candidate_placements /
-- selection_decisions rather than a JSON blob or an EAV table - see
-- DECISIONS.md for the write-up. Also extends UploadKind with
-- BUDGET_PLAN for Komisi Anggaran's optional RAB document; the
-- BADMEDBRND design-portfolio field reuses the existing PORTFOLIO kind
-- (its policy is widened in application code, not here - no schema
-- change needed for that part).
--
-- Rollback:
--   ALTER TABLE "candidate_supplemental_data" DROP CONSTRAINT "candidate_supplemental_data_candidateId_fkey";
--   DROP TABLE "candidate_supplemental_data";
--   DROP TYPE "AdkesmahFocus";
--   -- UploadKind's new 'BUDGET_PLAN' value cannot be dropped with ALTER
--   -- TYPE (Postgres has no "remove enum value" statement). As long as no
--   -- row has been written with kind = 'BUDGET_PLAN' yet (true immediately
--   -- after this migration, and checkable via
--   -- `SELECT 1 FROM file_uploads WHERE kind = 'BUDGET_PLAN'`), the value
--   -- is inert and safe to just leave in place. A byte-for-byte rollback
--   -- of UploadKind itself requires recreating the type end-to-end:
--   --   ALTER TYPE "UploadKind" RENAME TO "UploadKind_old";
--   --   CREATE TYPE "UploadKind" AS ENUM ('CV', 'PHOTO', 'STUDENT_CARD', 'PORTFOLIO');
--   --   ALTER TABLE "file_uploads" ALTER COLUMN "kind" TYPE "UploadKind" USING ("kind"::text::"UploadKind");
--   --   DROP TYPE "UploadKind_old";

-- CreateEnum
CREATE TYPE "AdkesmahFocus" AS ENUM ('ADVOCACY', 'WELFARE');

-- AlterEnum
ALTER TYPE "UploadKind" ADD VALUE 'BUDGET_PLAN';

-- CreateTable
CREATE TABLE "candidate_supplemental_data" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "komitMbti" TEXT,
    "adkesmahFocus" "AdkesmahFocus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidate_supplemental_data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "candidate_supplemental_data_candidateId_key" ON "candidate_supplemental_data"("candidateId");

-- AddForeignKey
ALTER TABLE "candidate_supplemental_data" ADD CONSTRAINT "candidate_supplemental_data_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
