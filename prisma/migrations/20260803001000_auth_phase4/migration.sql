-- Phase 4 additive authentication/session hardening.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LOGOUT';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PASSWORD_CHANGE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PASSWORD_RESET_REQUEST';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'AUTHORIZATION_DENIED';

ALTER TABLE "users"
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "sessions"
  ADD COLUMN "absoluteExpiresAt" TIMESTAMP(3),
  ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

UPDATE "sessions"
SET "absoluteExpiresAt" = "expiresAt"
WHERE "absoluteExpiresAt" IS NULL;

ALTER TABLE "sessions"
  ALTER COLUMN "absoluteExpiresAt" SET NOT NULL;

DROP INDEX IF EXISTS "sessions_userId_idx";
CREATE INDEX "sessions_userId_sessionVersion_idx"
  ON "sessions"("userId", "sessionVersion");

CREATE TABLE "auth_rate_limits" (
  "id" UUID NOT NULL,
  "scope" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "windowStartedAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "auth_rate_limits_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "auth_rate_limits_count_check" CHECK ("count" >= 0)
);

CREATE UNIQUE INDEX "auth_rate_limits_scope_keyHash_key"
  ON "auth_rate_limits"("scope", "keyHash");
CREATE INDEX "auth_rate_limits_updatedAt_idx"
  ON "auth_rate_limits"("updatedAt");

CREATE TABLE "password_reset_tokens" (
  "id" UUID NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "requestedIpHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key"
  ON "password_reset_tokens"("tokenHash");
CREATE INDEX "password_reset_tokens_userId_usedAt_expiresAt_idx"
  ON "password_reset_tokens"("userId", "usedAt", "expiresAt");
CREATE INDEX "password_reset_tokens_expiresAt_idx"
  ON "password_reset_tokens"("expiresAt");

ALTER TABLE "password_reset_tokens"
  ADD CONSTRAINT "password_reset_tokens_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
