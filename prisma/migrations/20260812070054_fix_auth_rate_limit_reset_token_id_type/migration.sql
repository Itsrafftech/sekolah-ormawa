-- Phase 9: fix schema drift recorded since Phase 5 (see PHASE_STATUS.md).
-- auth_rate_limits.id and password_reset_tokens.id were created as native
-- Postgres UUID columns by the Phase 4 migration, but schema.prisma has
-- always declared them as plain `String @id @default(uuid())` (Prisma's
-- default text-backed id), matching every other table in this schema (none
-- use @db.Uuid). Neither column is referenced as a foreign key by another
-- table, and application code only ever generates/compares these ids as
-- strings (randomUUID()), so this is a metadata-only alignment with no
-- data loss and no application-visible behavior change.

-- AlterTable
ALTER TABLE "auth_rate_limits" DROP CONSTRAINT "auth_rate_limits_pkey",
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "auth_rate_limits_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "password_reset_tokens" DROP CONSTRAINT "password_reset_tokens_pkey",
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id");
