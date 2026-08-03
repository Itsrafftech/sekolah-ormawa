-- Phase 3 registration is additive. No existing application data is removed.
ALTER TYPE "UploadKind" ADD VALUE IF NOT EXISTS 'PORTFOLIO';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SUBMIT';

CREATE TYPE "PortfolioItemType" AS ENUM ('FILE', 'EXTERNAL_LINK');

ALTER TABLE "idempotency_records"
  ADD COLUMN "responseSecretCiphertext" TEXT;

CREATE TABLE "candidate_portfolios" (
  "id" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "type" "PortfolioItemType" NOT NULL,
  "fileUploadId" TEXT,
  "externalUrl" TEXT,
  "title" TEXT,
  "description" TEXT,
  "applicantRole" TEXT,
  "creationYear" INTEGER,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "candidate_portfolios_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "candidate_portfolios_source_check" CHECK (
    ("type" = 'FILE' AND "fileUploadId" IS NOT NULL AND "externalUrl" IS NULL)
    OR
    ("type" = 'EXTERNAL_LINK' AND "externalUrl" IS NOT NULL AND "fileUploadId" IS NULL)
  ),
  CONSTRAINT "candidate_portfolios_sort_order_check" CHECK ("sortOrder" >= 0)
);

CREATE TABLE "registration_confirmations" (
  "id" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "registration_confirmations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "candidate_portfolios_fileUploadId_key"
  ON "candidate_portfolios"("fileUploadId");
CREATE INDEX "candidate_portfolios_candidateId_sortOrder_idx"
  ON "candidate_portfolios"("candidateId", "sortOrder");
CREATE UNIQUE INDEX "registration_confirmations_tokenHash_key"
  ON "registration_confirmations"("tokenHash");
CREATE INDEX "registration_confirmations_expiresAt_idx"
  ON "registration_confirmations"("expiresAt");

ALTER TABLE "file_uploads"
  ADD CONSTRAINT "file_uploads_periodId_fkey"
  FOREIGN KEY ("periodId") REFERENCES "recruitment_periods"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "candidate_portfolios"
  ADD CONSTRAINT "candidate_portfolios_candidateId_fkey"
  FOREIGN KEY ("candidateId") REFERENCES "candidates"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "candidate_portfolios"
  ADD CONSTRAINT "candidate_portfolios_fileUploadId_fkey"
  FOREIGN KEY ("fileUploadId") REFERENCES "file_uploads"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "registration_confirmations"
  ADD CONSTRAINT "registration_confirmations_candidateId_fkey"
  FOREIGN KEY ("candidateId") REFERENCES "candidates"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
