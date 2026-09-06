-- Phase D - "Portofolio via URL Google Drive" (ADR-045): replaces the
-- in-app file-upload mechanism for Medbrand/Badmedbrnd's portfolio and
-- Komisi Anggaran's RAB with a plain URL text field. `candidate_portfolios`
-- existed solely to back that file-upload flow (no other Birdep used it),
-- so it is dropped entirely rather than left unused; the two new URL
-- columns land on the existing `candidate_supplemental_data` table
-- (Phase C, ADR-043) alongside `komitMbti`/`adkesmahFocus`, since they are
-- now the same kind of value: a per-candidate, department-triggered text
-- field with no file/storage involvement.
--
-- Data impact: any pre-existing `candidate_portfolios` rows (portfolio
-- files/links already submitted by fixture/UAT candidates before this
-- migration) are PERMANENTLY DELETED by the DROP TABLE below - there is
-- no column-level migration path from "many portfolio items" to "one URL
-- string". Acceptable here because production submission has never been
-- enabled (ADR-018) and all current rows are synthetic fixture/UAT data;
-- flagged explicitly in the phase report for visibility, not hidden.
--
-- UploadKind.PORTFOLIO/BUDGET_PLAN are NOT removed from the enum by this
-- migration - Postgres has no "drop enum value" statement, only a full
-- type recreation (rename -> create -> convert column -> drop old), which
-- is unnecessary risk for two now-unused, harmless values. See the enum's
-- doc comment in schema.prisma.
--
-- Rollback:
--   ALTER TABLE "candidate_supplemental_data" DROP COLUMN "portfolioUrl";
--   ALTER TABLE "candidate_supplemental_data" DROP COLUMN "budgetPlanUrl";
--   CREATE TYPE "PortfolioItemType" AS ENUM ('FILE', 'EXTERNAL_LINK');
--   CREATE TABLE "candidate_portfolios" (
--       "id" TEXT NOT NULL,
--       "candidateId" TEXT NOT NULL,
--       "type" "PortfolioItemType" NOT NULL,
--       "fileUploadId" TEXT,
--       "externalUrl" TEXT,
--       "title" TEXT,
--       "description" TEXT,
--       "applicantRole" TEXT,
--       "creationYear" INTEGER,
--       "sortOrder" INTEGER NOT NULL DEFAULT 0,
--       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
--       "updatedAt" TIMESTAMP(3) NOT NULL,
--       CONSTRAINT "candidate_portfolios_pkey" PRIMARY KEY ("id")
--   );
--   CREATE UNIQUE INDEX "candidate_portfolios_fileUploadId_key" ON "candidate_portfolios"("fileUploadId");
--   CREATE INDEX "candidate_portfolios_candidateId_sortOrder_idx" ON "candidate_portfolios"("candidateId", "sortOrder");
--   ALTER TABLE "candidate_portfolios" ADD CONSTRAINT "candidate_portfolios_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
--   ALTER TABLE "candidate_portfolios" ADD CONSTRAINT "candidate_portfolios_fileUploadId_fkey" FOREIGN KEY ("fileUploadId") REFERENCES "file_uploads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- (recreates the empty table/type structure only - the deleted row data
-- itself is not recoverable from this rollback, only from a database
-- backup taken before this migration ran.)

-- DropForeignKey
ALTER TABLE "candidate_portfolios" DROP CONSTRAINT "candidate_portfolios_candidateId_fkey";

-- DropForeignKey
ALTER TABLE "candidate_portfolios" DROP CONSTRAINT "candidate_portfolios_fileUploadId_fkey";

-- AlterTable
ALTER TABLE "candidate_supplemental_data" ADD COLUMN     "budgetPlanUrl" TEXT,
ADD COLUMN     "portfolioUrl" TEXT;

-- DropTable
DROP TABLE "candidate_portfolios";

-- DropEnum
DROP TYPE "PortfolioItemType";
