-- "Perubahan Sistem Pembayaran": reverts the per-registrant unique payment
-- code ("Guidebook, ketentuan, dan pembayaran", migration
-- 20260907150000_guidebook_and_payment) back to a single fixed amount
-- (Rp 15.001) shown to every registrant - no per-candidate code/amount to
-- store at all, since the figure is now plain, identical content rather
-- than data. See ADR-048.
--
-- Dropped:
--   - Candidate.paymentCode / Candidate.paymentAmount columns
--   - The (periodId, paymentCode) unique index
--   - RecruitmentPeriod.paymentCodeSequence (the atomic counter that
--     issued codes) - not explicitly listed in the request, but it has no
--     remaining reader/writer once the code-issuing endpoint and its
--     candidate.create() usage are removed in the same change, so leaving
--     it would be pure dead schema. Flagged in the phase report.
--
-- Data loss (same disclosure precedent as ADR-045's candidate_portfolios
-- drop): the 8 dev fixture candidates existing at the time of this
-- migration each had a paymentCode (001-008) and paymentAmount
-- (15001-15008) from the prior scheme - both are permanently lost, no
-- migration path preserves them (there is nothing meaningful to migrate
-- them TO - the new scheme has no per-candidate payment field at all).
-- Accepted because submission production has never been activated
-- (ADR-018) and all 8 rows are synthetic fixture data.
--
-- No backfill needed (per request) - columns are being removed, not added.
--
-- Rollback:
--   ALTER TABLE "recruitment_periods" ADD COLUMN "paymentCodeSequence" INTEGER NOT NULL DEFAULT 0;
--   ALTER TABLE "candidates" ADD COLUMN "paymentCode" TEXT;
--   ALTER TABLE "candidates" ADD COLUMN "paymentAmount" INTEGER;
--   -- Backfill required before re-tightening to NOT NULL + unique - the
--   -- original per-candidate values above are gone; a fresh sequential
--   -- backfill (same ROW_NUMBER() approach as the original migration)
--   -- would assign NEW codes, not restore the old ones:
--   --   WITH numbered AS (
--   --     SELECT "id", ROW_NUMBER() OVER (PARTITION BY "periodId" ORDER BY "submittedAt", "id") AS "rn"
--   --     FROM "candidates" WHERE "paymentCode" IS NULL
--   --   )
--   --   UPDATE "candidates" AS c SET "paymentCode" = LPAD(numbered."rn"::text, 3, '0')
--   --   FROM numbered WHERE c."id" = numbered."id";
--   --   UPDATE "candidates" SET "paymentAmount" = 15000 + CAST("paymentCode" AS INTEGER) WHERE "paymentAmount" IS NULL;
--   ALTER TABLE "candidates" ALTER COLUMN "paymentCode" SET NOT NULL;
--   ALTER TABLE "candidates" ALTER COLUMN "paymentAmount" SET NOT NULL;
--   CREATE UNIQUE INDEX "candidates_periodId_paymentCode_key" ON "candidates"("periodId", "paymentCode");
--   -- (UploadKind.PAYMENT_EVIDENCE is untouched by this migration either
--   -- direction - the evidence upload mechanism is unaffected by this
--   -- change, only the code/amount columns are.)

-- DropIndex
DROP INDEX "candidates_periodId_paymentCode_key";

-- AlterTable
ALTER TABLE "candidates" DROP COLUMN "paymentCode";
ALTER TABLE "candidates" DROP COLUMN "paymentAmount";

-- AlterTable
ALTER TABLE "recruitment_periods" DROP COLUMN "paymentCodeSequence";
