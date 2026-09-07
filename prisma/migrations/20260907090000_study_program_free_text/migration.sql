-- UAT feedback (post-Phase D): "Program Studi" on the registration form
-- changes from a dropdown backed by master data (StudyProgram, foreign
-- key) to free text - the fixture master-data list was incomplete and
-- blocked candidates from registering under their actual program.
--
-- `candidates.studyProgram` (new, TEXT) replaces `candidates.studyProgramId`
-- (FK to study_programs). Existing rows are backfilled from their current
-- StudyProgram.name before the old column is dropped, so no candidate
-- data is lost - added nullable, backfilled, then set NOT NULL (same safe
-- pattern as Candidate.track in 20260905173817_add_track_legislative).
-- `study_programs` itself is NOT dropped - Candidate is simply
-- disconnected from it; deleting the table is a separate, irreversible
-- decision that wasn't requested.
--
-- Rollback:
--   ALTER TABLE "candidates" ADD COLUMN "studyProgramId" TEXT;
--   UPDATE "candidates" c SET "studyProgramId" = sp.id
--     FROM "study_programs" sp WHERE sp.name = c."studyProgram";
--   -- Any candidate whose free-typed studyProgram text does not exactly
--   -- match an existing study_programs.name (very likely for rows
--   -- created after this migration, since free text was never
--   -- constrained to that list) is left with studyProgramId = NULL here
--   -- and MUST be resolved manually (map to a real StudyProgram row, or
--   -- create one) before the NOT NULL/FK constraints below can succeed -
--   -- this rollback is not a lossless round trip once free-text data
--   -- exists, and is not hidden as though it were.
--   ALTER TABLE "candidates" ALTER COLUMN "studyProgramId" SET NOT NULL;
--   ALTER TABLE "candidates" ADD CONSTRAINT "candidates_studyProgramId_fkey"
--     FOREIGN KEY ("studyProgramId") REFERENCES "study_programs"("id");
--   ALTER TABLE "candidates" DROP COLUMN "studyProgram";

-- AlterTable: add nullable first so existing rows aren't broken mid-migration.
ALTER TABLE "candidates" ADD COLUMN "studyProgram" TEXT;

-- Backfill from the current FK relationship.
UPDATE "candidates" c
SET "studyProgram" = sp.name
FROM "study_programs" sp
WHERE sp.id = c."studyProgramId";

-- Tighten to NOT NULL now that every existing row is backfilled.
ALTER TABLE "candidates" ALTER COLUMN "studyProgram" SET NOT NULL;

-- DropForeignKey
ALTER TABLE "candidates" DROP CONSTRAINT "candidates_studyProgramId_fkey";

-- AlterTable: drop the old FK column.
ALTER TABLE "candidates" DROP COLUMN "studyProgramId";
