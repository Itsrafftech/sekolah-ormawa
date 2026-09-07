-- "Guidebook, ketentuan, dan pembayaran": adds a required payment step to
-- registration.
--
-- 1. RecruitmentPeriod.paymentCodeSequence - atomic per-period counter for
--    Candidate.paymentCode, same pattern as registrationSequence (a
--    single-row UPDATE...increment). Incremented by GET
--    /api/registration/payment-code when a registrant reaches the Payment
--    step (not at final submit), since the code must be shown/paid before
--    submission.
-- 2. Candidate.paymentCode (String, NOT NULL) / paymentAmount (Int, NOT
--    NULL) - dedicated columns per the spec (not the generic FileUpload
--    mechanism, unlike the payment evidence file itself). Added nullable,
--    backfilled, then tightened to NOT NULL - same safe two-phase pattern
--    as the `track` column (see 20260905173817_add_track_legislative).
-- 3. UploadKind +PAYMENT_EVIDENCE - the payment screenshot/receipt reuses
--    the generic FileUpload mechanism exactly like FOLLOW_EVIDENCE.
--
-- Backfill: existing candidates (fixture data - no real production
-- database exists yet, see ADR-018) get synthetic sequential codes
-- per period (001, 002, ... ordered by submittedAt) via ROW_NUMBER(),
-- and RecruitmentPeriod.paymentCodeSequence is bootstrapped to the
-- highest backfilled code per period so the NEXT real code issued by the
-- app never collides with a backfilled one.
--
-- Rollback:
--   DROP INDEX "candidates_periodId_paymentCode_key";
--   ALTER TABLE "candidates" DROP COLUMN "paymentCode";
--   ALTER TABLE "candidates" DROP COLUMN "paymentAmount";
--   ALTER TABLE "recruitment_periods" DROP COLUMN "paymentCodeSequence";
--   -- UploadKind: Postgres has no "drop a single enum value" statement -
--   -- removing PAYMENT_EVIDENCE requires a full type recreation (same
--   -- caveat as FOLLOW_EVIDENCE/PORTFOLIO/BUDGET_PLAN before it):
--   --   ALTER TYPE "UploadKind" RENAME TO "UploadKind_old";
--   --   CREATE TYPE "UploadKind" AS ENUM ('CV', 'PHOTO', 'STUDENT_CARD', 'PORTFOLIO', 'BUDGET_PLAN', 'FOLLOW_EVIDENCE');
--   --   ALTER TABLE "file_uploads" ALTER COLUMN "kind" TYPE "UploadKind" USING ("kind"::text::"UploadKind");
--   --   DROP TYPE "UploadKind_old";
--   -- Fails if any file_uploads row still has kind = 'PAYMENT_EVIDENCE' -
--   -- such rows must be deleted or re-kinded first. Not run automatically
--   -- here, same reasoning as every prior retired/added upload kind: more
--   -- risk than benefit for a single unused-when-rolled-back value.

-- AlterTable: RecruitmentPeriod payment code counter.
ALTER TABLE "recruitment_periods" ADD COLUMN "paymentCodeSequence" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: Candidate payment columns, added nullable first.
ALTER TABLE "candidates" ADD COLUMN "paymentCode" TEXT;
ALTER TABLE "candidates" ADD COLUMN "paymentAmount" INTEGER;

-- Backfill: sequential 3-digit code per period, ordered by submittedAt
-- (stable, reproducible) - synthetic placeholder for existing fixture
-- candidates only (see ADR note above).
WITH numbered AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "periodId" ORDER BY "submittedAt", "id") AS "rn"
  FROM "candidates"
  WHERE "paymentCode" IS NULL
)
UPDATE "candidates" AS c
SET "paymentCode" = LPAD(numbered."rn"::text, 3, '0')
FROM numbered
WHERE c."id" = numbered."id";

-- Backfill: paymentAmount = 15000 (PAYMENT_BASE_AMOUNT default, see
-- src/lib/env.ts) + the numeric value of the code just assigned above.
UPDATE "candidates"
SET "paymentAmount" = 15000 + CAST("paymentCode" AS INTEGER)
WHERE "paymentAmount" IS NULL;

-- Bootstrap the per-period counter so the next code issued by the app
-- (GET /api/registration/payment-code) continues after the highest
-- backfilled code, never colliding with one.
UPDATE "recruitment_periods" AS p
SET "paymentCodeSequence" = GREATEST(p."paymentCodeSequence", COALESCE(sub."maxCode", 0))
FROM (
  SELECT "periodId", MAX(CAST("paymentCode" AS INTEGER)) AS "maxCode"
  FROM "candidates"
  GROUP BY "periodId"
) AS sub
WHERE p."id" = sub."periodId";

-- AlterTable: tighten to NOT NULL now that every existing row has a value.
ALTER TABLE "candidates" ALTER COLUMN "paymentCode" SET NOT NULL;
ALTER TABLE "candidates" ALTER COLUMN "paymentAmount" SET NOT NULL;

-- CreateIndex: one payment code per period, DB-level backstop on top of
-- the atomic counter.
CREATE UNIQUE INDEX "candidates_periodId_paymentCode_key" ON "candidates"("periodId", "paymentCode");

-- AlterEnum
ALTER TYPE "UploadKind" ADD VALUE 'PAYMENT_EVIDENCE';
