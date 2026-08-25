-- UAT feedback: IPK (GPA) removed from the registration flow. Angkatan 63
-- registers as new students before their first semester, so they have no
-- GPA yet - see ADR-040 (docs/sekolah-ormawa/DECISIONS.md). Column kept
-- (not dropped) so existing candidate rows with a gpa value are untouched;
-- the existing candidates_gpa_check CHECK constraint (0.00-4.00) still
-- applies to any non-null value and is automatically satisfied by NULL.

-- AlterTable
ALTER TABLE "candidates" ALTER COLUMN "gpa" DROP NOT NULL;
