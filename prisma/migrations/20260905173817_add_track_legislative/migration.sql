-- Phase A - "Jalur Legislatif": introduces the Track enum (EXECUTIVE /
-- LEGISLATIVE) so a Department can belong to either organizational branch,
-- and a Candidate records which branch their (same-track) pair of choices
-- belongs to. Purely structural - the 5 new legislative Department rows
-- and the backfill of existing data are handled by prisma/seed.ts
-- (idempotent upserts), not baked into this migration, so this migration
-- stays safely re-runnable/rollback-able on its own.
--
-- Rollback:
--   ALTER TABLE "candidates" DROP COLUMN "track";
--   DROP INDEX "departments_track_isActive_sortOrder_idx";
--   ALTER TABLE "departments" DROP COLUMN "track";
--   DROP TYPE "Track";
-- (drop the enum last - both columns must be gone first, since Postgres
-- won't drop a type still referenced by a column).

-- CreateEnum
CREATE TYPE "Track" AS ENUM ('EXECUTIVE', 'LEGISLATIVE');

-- AlterTable: departments.track has a real DB-level DEFAULT (matches its
-- @default(EXECUTIVE) in schema.prisma) - Postgres backfills all existing
-- rows (the 13 executive Birdep) to EXECUTIVE as part of adding the
-- column, no separate UPDATE needed.
ALTER TABLE "departments" ADD COLUMN "track" "Track" NOT NULL DEFAULT 'EXECUTIVE';

-- CreateIndex
CREATE INDEX "departments_track_isActive_sortOrder_idx" ON "departments"("track", "isActive", "sortOrder");

-- AlterTable: candidates.track is required with NO DB-level default (see
-- schema.prisma's doc comment on the field) - added nullable, backfilled,
-- then tightened to NOT NULL, so existing candidate rows aren't left in a
-- broken state mid-migration.
ALTER TABLE "candidates" ADD COLUMN "track" "Track";
UPDATE "candidates" SET "track" = 'EXECUTIVE' WHERE "track" IS NULL;
ALTER TABLE "candidates" ALTER COLUMN "track" SET NOT NULL;
