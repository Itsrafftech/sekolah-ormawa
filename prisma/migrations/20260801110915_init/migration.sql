-- CreateEnum
CREATE TYPE "ConfigStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('BPH', 'BIRO', 'DEPARTEMEN');

-- CreateEnum
CREATE TYPE "PeriodStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CandidateStatus" AS ENUM ('SUBMITTED', 'LOCKED', 'WITHDRAWN', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ChoiceRank" AS ENUM ('PRIMARY', 'SECONDARY');

-- CreateEnum
CREATE TYPE "UploadKind" AS ENUM ('CV', 'PHOTO', 'STUDENT_CARD');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('PENDING', 'UPLOADED', 'VALIDATED', 'FINALIZED', 'REJECTED', 'ORPHANED');

-- CreateEnum
CREATE TYPE "IdempotencyStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "EmailOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'SOFT_DELETE', 'RESTORE', 'LOGIN', 'LOGIN_DENIED', 'PASSWORD_RESET', 'SESSION_REVOKE', 'LOCK', 'UNLOCK', 'OVERRIDE', 'EXPORT', 'BROADCAST');

-- CreateEnum
CREATE TYPE "PlacementStatus" AS ENUM ('UNDER_REVIEW', 'PLACED', 'WAITLISTED', 'NOT_SELECTED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "roles" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "permissions" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleCode" TEXT NOT NULL,
    "permissionCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleCode","permissionCode")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "unitType" "UnitType" NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "configStatus" "ConfigStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'DEPT_PJ',
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "banReason" TEXT,
    "banExpires" TIMESTAMP(3),
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "temporaryPasswordExpiresAt" TIMESTAMP(3),
    "departmentId" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "passwordChangedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "impersonatedBy" TEXT,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifications" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limits" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruitment_periods" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "PeriodStatus" NOT NULL DEFAULT 'DRAFT',
    "configStatus" "ConfigStatus" NOT NULL DEFAULT 'DRAFT',
    "cohortCode" INTEGER NOT NULL DEFAULT 63,
    "entryYear" INTEGER,
    "registrationPrefix" TEXT,
    "registrationSequence" INTEGER NOT NULL DEFAULT 0,
    "opensAt" TIMESTAMP(3),
    "closesAt" TIMESTAMP(3),
    "choice2Required" BOOLEAN NOT NULL DEFAULT true,
    "allowUnlock" BOOLEAN NOT NULL DEFAULT false,
    "consentVersion" TEXT,
    "retentionDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recruitment_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "period_departments" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "acceptsApplications" BOOLEAN NOT NULL DEFAULT false,
    "quota" INTEGER,
    "contributionPrompt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "period_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_programs" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "configStatus" "ConfigStatus" NOT NULL DEFAULT 'DRAFT',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "study_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidates" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "registrationNumber" TEXT,
    "name" TEXT NOT NULL,
    "nim" TEXT NOT NULL,
    "normalizedNim" TEXT NOT NULL,
    "cohortCode" INTEGER NOT NULL,
    "entryYear" INTEGER,
    "className" TEXT NOT NULL,
    "studyProgramId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "normalizedEmail" TEXT NOT NULL,
    "gpa" DECIMAL(3,2) NOT NULL,
    "domicile" TEXT NOT NULL,
    "essayOrgExperience" TEXT NOT NULL,
    "essayContribution" TEXT NOT NULL,
    "essayBalance" TEXT NOT NULL,
    "status" "CandidateStatus" NOT NULL DEFAULT 'SUBMITTED',
    "consentVersion" TEXT,
    "consentedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_choices" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "rank" "ChoiceRank" NOT NULL,
    "motivation" TEXT NOT NULL,
    "contribution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidate_choices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_uploads" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT,
    "periodId" TEXT NOT NULL,
    "kind" "UploadKind" NOT NULL,
    "status" "UploadStatus" NOT NULL DEFAULT 'PENDING',
    "bucket" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "declaredMimeType" TEXT NOT NULL,
    "detectedMimeType" TEXT,
    "sizeBytes" INTEGER NOT NULL,
    "checksumSha256" TEXT,
    "ownerTokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedAt" TIMESTAMP(3),
    "finalizedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_notes" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "department_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_locks" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "lockedByUserId" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unlockedAt" TIMESTAMP(3),
    "unlockedByUserId" TEXT,
    "lockReason" TEXT,
    "unlockReason" TEXT,
    "overrideReason" TEXT,

    CONSTRAINT "candidate_locks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_placements" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "status" "PlacementStatus" NOT NULL DEFAULT 'UNDER_REVIEW',
    "mentorLabel" TEXT,
    "reason" TEXT,
    "placedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidate_placements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" "IdempotencyStatus" NOT NULL DEFAULT 'PROCESSING',
    "responseCode" INTEGER,
    "responseBody" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "departmentId" TEXT,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "reason" TEXT,
    "requestId" TEXT NOT NULL,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_outbox" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "recipientHash" TEXT NOT NULL,
    "encryptedPayload" TEXT NOT NULL,
    "status" "EmailOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE INDEX "departments_isActive_sortOrder_idx" ON "departments"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "users_departmentId_idx" ON "users"("departmentId");

-- CreateIndex
CREATE INDEX "users_role_banned_idx" ON "users"("role", "banned");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_providerId_accountId_key" ON "accounts"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "verifications_identifier_idx" ON "verifications"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "rate_limits_key_key" ON "rate_limits"("key");

-- CreateIndex
CREATE UNIQUE INDEX "recruitment_periods_code_key" ON "recruitment_periods"("code");

-- CreateIndex
CREATE INDEX "recruitment_periods_status_opensAt_closesAt_idx" ON "recruitment_periods"("status", "opensAt", "closesAt");

-- CreateIndex
CREATE INDEX "period_departments_periodId_acceptsApplications_idx" ON "period_departments"("periodId", "acceptsApplications");

-- CreateIndex
CREATE UNIQUE INDEX "period_departments_periodId_departmentId_key" ON "period_departments"("periodId", "departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "study_programs_code_key" ON "study_programs"("code");

-- CreateIndex
CREATE UNIQUE INDEX "candidates_registrationNumber_key" ON "candidates"("registrationNumber");

-- CreateIndex
CREATE INDEX "candidates_periodId_status_submittedAt_id_idx" ON "candidates"("periodId", "status", "submittedAt", "id");

-- CreateIndex
CREATE INDEX "candidates_deletedAt_idx" ON "candidates"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "candidates_periodId_normalizedNim_key" ON "candidates"("periodId", "normalizedNim");

-- CreateIndex
CREATE UNIQUE INDEX "candidates_periodId_normalizedEmail_key" ON "candidates"("periodId", "normalizedEmail");

-- CreateIndex
CREATE INDEX "candidate_choices_departmentId_rank_candidateId_idx" ON "candidate_choices"("departmentId", "rank", "candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "candidate_choices_candidateId_rank_key" ON "candidate_choices"("candidateId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "candidate_choices_candidateId_departmentId_key" ON "candidate_choices"("candidateId", "departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "file_uploads_objectKey_key" ON "file_uploads"("objectKey");

-- CreateIndex
CREATE INDEX "file_uploads_periodId_status_expiresAt_idx" ON "file_uploads"("periodId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "file_uploads_candidateId_kind_idx" ON "file_uploads"("candidateId", "kind");

-- CreateIndex
CREATE INDEX "department_notes_candidateId_departmentId_deletedAt_idx" ON "department_notes"("candidateId", "departmentId", "deletedAt");

-- CreateIndex
CREATE INDEX "candidate_locks_candidateId_unlockedAt_idx" ON "candidate_locks"("candidateId", "unlockedAt");

-- CreateIndex
CREATE INDEX "candidate_locks_departmentId_unlockedAt_idx" ON "candidate_locks"("departmentId", "unlockedAt");

-- CreateIndex
CREATE UNIQUE INDEX "candidate_placements_candidateId_key" ON "candidate_placements"("candidateId");

-- CreateIndex
CREATE INDEX "candidate_placements_departmentId_status_idx" ON "candidate_placements"("departmentId", "status");

-- CreateIndex
CREATE INDEX "idempotency_records_expiresAt_idx" ON "idempotency_records"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_scope_keyHash_key" ON "idempotency_records"("scope", "keyHash");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_createdAt_idx" ON "audit_logs"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_actorUserId_createdAt_idx" ON "audit_logs"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_departmentId_createdAt_idx" ON "audit_logs"("departmentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "email_outbox_idempotencyKey_key" ON "email_outbox"("idempotencyKey");

-- CreateIndex
CREATE INDEX "email_outbox_status_nextAttemptAt_idx" ON "email_outbox"("status", "nextAttemptAt");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleCode_fkey" FOREIGN KEY ("roleCode") REFERENCES "roles"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionCode_fkey" FOREIGN KEY ("permissionCode") REFERENCES "permissions"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_fkey" FOREIGN KEY ("role") REFERENCES "roles"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "period_departments" ADD CONSTRAINT "period_departments_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "recruitment_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "period_departments" ADD CONSTRAINT "period_departments_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "recruitment_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_studyProgramId_fkey" FOREIGN KEY ("studyProgramId") REFERENCES "study_programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_choices" ADD CONSTRAINT "candidate_choices_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_choices" ADD CONSTRAINT "candidate_choices_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_uploads" ADD CONSTRAINT "file_uploads_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_notes" ADD CONSTRAINT "department_notes_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_notes" ADD CONSTRAINT "department_notes_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_locks" ADD CONSTRAINT "candidate_locks_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_locks" ADD CONSTRAINT "candidate_locks_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_placements" ADD CONSTRAINT "candidate_placements_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_placements" ADD CONSTRAINT "candidate_placements_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Domain constraints that Prisma cannot express in the schema DSL.
-- Authorization still runs in the backend; these checks provide a final
-- database boundary for invalid scope and recruitment data.
ALTER TABLE "users"
  ADD CONSTRAINT "users_role_department_scope_check"
  CHECK (
    ("role" = 'SUPER_ADMIN' AND "departmentId" IS NULL)
    OR
    ("role" = 'DEPT_PJ' AND "departmentId" IS NOT NULL)
  );

ALTER TABLE "candidates"
  ADD CONSTRAINT "candidates_gpa_check"
  CHECK ("gpa" >= 0.00 AND "gpa" <= 4.00);

ALTER TABLE "period_departments"
  ADD CONSTRAINT "period_departments_quota_check"
  CHECK ("quota" IS NULL OR "quota" >= 0);

ALTER TABLE "recruitment_periods"
  ADD CONSTRAINT "recruitment_periods_sequence_check"
  CHECK ("registrationSequence" >= 0),
  ADD CONSTRAINT "recruitment_periods_schedule_check"
  CHECK ("opensAt" IS NULL OR "closesAt" IS NULL OR "opensAt" < "closesAt"),
  ADD CONSTRAINT "recruitment_periods_retention_check"
  CHECK ("retentionDays" IS NULL OR "retentionDays" > 0);

ALTER TABLE "file_uploads"
  ADD CONSTRAINT "file_uploads_size_check"
  CHECK ("sizeBytes" > 0);

CREATE UNIQUE INDEX "candidate_locks_one_active_per_candidate_key"
  ON "candidate_locks"("candidateId")
  WHERE "unlockedAt" IS NULL;
