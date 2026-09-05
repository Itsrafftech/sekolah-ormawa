import "server-only";

import { randomBytes, randomUUID } from "node:crypto";

import type { RegistrationSuccessResponse } from "@/features/registration/contracts";
import {
  normalizeEmail,
  normalizeNim,
  normalizePhone,
  validateRegistrationPayload,
  type FieldErrors,
} from "@/features/registration/validation";
import { prisma } from "@/lib/db";
import { getServerEnvironment } from "@/lib/env";
import { decryptJson, encryptJson, sha256 } from "@/lib/security/crypto";
import { ensureSelectionDecision } from "@/server/candidates/selection";
import { getRegistrationAvailability } from "@/server/registration/config";

export class RegistrationSubmissionError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly fieldErrors: FieldErrors = {},
  ) {
    super(message);
  }
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function assertIdempotencyKey(value: string): void {
  if (!/^[A-Za-z0-9_-]{16,200}$/u.test(value)) {
    throw new RegistrationSubmissionError(
      "Idempotency-Key tidak valid.",
      400,
      "INVALID_IDEMPOTENCY_KEY",
    );
  }
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && "code" in error && error.code === "P2002",
  );
}

function isSerializationFailure(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && "code" in error && error.code === "P2034",
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Phase 8 P4 load test: a registration-deadline traffic spike (many
// concurrent submitters) hits repeated Serializable conflicts on the shared
// recruitmentPeriod.registrationSequence row. 3 immediate retries with no
// backoff left most concurrent submitters colliding again on every retry;
// jittered, increasing backoff spreads retries out so the conflict rate
// drops with each attempt.
const SUBMIT_MAX_ATTEMPTS = 6;
function retryBackoffMs(attempt: number): number {
  return 20 * 2 ** attempt + Math.floor(Math.random() * 20);
}

function assertPeriodStillOpen(
  period: {
    status: string;
    configStatus: string;
    opensAt: Date | null;
    closesAt: Date | null;
    entryYear: number | null;
    registrationPrefix: string | null;
    consentVersion: string | null;
  },
  now: Date,
): asserts period is typeof period & {
  entryYear: number;
  registrationPrefix: string;
  consentVersion: string;
} {
  if (
    period.status !== "OPEN" || period.configStatus !== "ACTIVE" ||
    (period.opensAt !== null && now < period.opensAt) ||
    (period.closesAt !== null && now >= period.closesAt)
  ) {
    throw new RegistrationSubmissionError(
      "Periode tidak sedang menerima pendaftaran.",
      409,
      "PERIOD_CLOSED",
    );
  }
  if (!period.entryYear || !period.registrationPrefix || !period.consentVersion) {
    throw new RegistrationSubmissionError(
      "Konfigurasi periode belum lengkap.",
      409,
      "PERIOD_CONFIG_INCOMPLETE",
    );
  }
  if (
    process.env.NODE_ENV === "production" &&
    period.consentVersion.toUpperCase().includes("DRAFT")
  ) {
    throw new RegistrationSubmissionError(
      "Consent resmi belum tersedia.",
      409,
      "CONSENT_NOT_FINAL",
    );
  }
}

export async function submitRegistration(input: {
  payload: unknown;
  idempotencyKey: string;
  ownerToken: string;
  requestId?: string;
  now?: Date;
}): Promise<RegistrationSuccessResponse> {
  assertIdempotencyKey(input.idempotencyKey);
  const environment = getServerEnvironment();
  if (!environment.REGISTRATION_SUBMISSION_ENABLED) {
    throw new RegistrationSubmissionError(
      "Submission dikunci oleh konfigurasi rilis.",
      409,
      "SUBMISSION_DISABLED",
    );
  }

  const availability = await getRegistrationAvailability(input.now);
  if (availability.state !== "OPEN") {
    throw new RegistrationSubmissionError(availability.detail, 409, "PERIOD_CLOSED");
  }
  const validation = validateRegistrationPayload(input.payload, availability.config);
  if (!validation.success) {
    throw new RegistrationSubmissionError(
      "Periksa kembali field yang bermasalah.",
      422,
      "VALIDATION_FAILED",
      validation.errors,
    );
  }

  const payload = validation.data;
  const requestHash = sha256(stableStringify(payload));
  const keyHash = sha256(input.idempotencyKey);
  const ownerTokenHash = sha256(input.ownerToken);
  const now = input.now ?? new Date();
  const requestId = input.requestId ?? randomUUID();

  // The registration-number counter is the one row every concurrent
  // submitter writes regardless of which candidate/department they picked,
  // so under Serializable isolation it was the dominant source of
  // conflicts during a deadline traffic spike (Phase 8 P4 load test: 60
  // concurrent submissions saw a ~72-85% conflict/retry-exhaustion rate).
  // A single-row UPDATE...increment is already atomic and race-free under
  // Postgres's default read-committed locking without Serializable, so it
  // is issued once here, outside the retryable transaction below, leaving
  // that transaction's remaining reads/writes (all scoped to this specific
  // candidate/upload/idempotency-key) to keep their Serializable guarantee.
  // A retried/replayed Idempotency-Key still burns a sequence number even
  // when the cached response is returned unchanged below - the same
  // accepted gap behavior as a duplicate-NIM rejection or any DB sequence.
  const { registrationSequence } = await prisma.recruitmentPeriod.update({
    where: { id: payload.periodId },
    data: { registrationSequence: { increment: 1 } },
    select: { registrationSequence: true },
  });

  for (let attempt = 0; attempt < SUBMIT_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT 1::int AS locked
        FROM pg_advisory_xact_lock(hashtext(${`registration:${keyHash}`}))
      `;

      const existing = await transaction.idempotencyRecord.findUnique({
        where: { scope_keyHash: { scope: "PUBLIC_REGISTRATION", keyHash } },
      });
      if (existing) {
        if (existing.requestHash !== requestHash) {
          throw new RegistrationSubmissionError(
            "Idempotency-Key telah digunakan untuk payload berbeda.",
            409,
            "IDEMPOTENCY_PAYLOAD_MISMATCH",
          );
        }
        if (existing.status === "COMPLETED" && existing.responseSecretCiphertext) {
          return decryptJson<RegistrationSuccessResponse>(
            existing.responseSecretCiphertext,
            environment.AUTH_SECRET,
          );
        }
        await transaction.idempotencyRecord.update({
          where: { id: existing.id },
          data: { status: "PROCESSING", responseCode: null, responseSecretCiphertext: null },
        });
      } else {
        await transaction.idempotencyRecord.create({
          data: {
            scope: "PUBLIC_REGISTRATION",
            keyHash,
            requestHash,
            expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
          },
        });
      }

      const period = await transaction.recruitmentPeriod.findUniqueOrThrow({
        where: { id: payload.periodId },
      });
      assertPeriodStillOpen(period, now);

      const selectedDepartments = await transaction.periodDepartment.findMany({
        where: {
          periodId: period.id,
          departmentId: { in: payload.choices.map((choice) => choice.departmentId) },
          acceptsApplications: true,
          department: { isActive: true, unitType: { not: "BPH" } },
        },
        include: { department: true },
      });
      if (selectedDepartments.length !== 2) {
        throw new RegistrationSubmissionError(
          "Pilihan Birdep tidak tersedia pada periode ini.",
          422,
          "INVALID_DEPARTMENT_CHOICE",
          { choices: "Pilih dua Birdep aktif yang menerima pendaftaran." },
        );
      }

      const studyProgram = await transaction.studyProgram.findFirst({
        where: {
          id: payload.identity.studyProgramId,
          isActive: true,
          configStatus: "ACTIVE",
        },
      });
      if (!studyProgram) {
        throw new RegistrationSubmissionError(
          "Program studi tidak tersedia.",
          422,
          "INVALID_STUDY_PROGRAM",
          { "identity.studyProgramId": "Program studi tidak aktif." },
        );
      }

      const documentIds = [
        payload.uploads.cv?.id,
        payload.uploads.photo?.id,
        payload.uploads.studentCard?.id,
      ].filter((value): value is string => Boolean(value));
      const portfolioFileIds = payload.portfolio
        .filter((item) => item.type === "FILE")
        .map((item) => item.fileUploadId)
        .filter((value): value is string => Boolean(value));
      const allUploadIds = [...documentIds, ...portfolioFileIds];
      if (new Set(allUploadIds).size !== allUploadIds.length) {
        throw new RegistrationSubmissionError(
          "Satu upload tidak boleh digunakan untuk lebih dari satu item.",
          422,
          "DUPLICATE_UPLOAD_REFERENCE",
        );
      }

      const uploads = await transaction.fileUpload.findMany({
        where: {
          id: { in: allUploadIds },
          periodId: period.id,
          ownerTokenHash,
          candidateId: null,
          status: "VALIDATED",
          expiresAt: { gt: now },
        },
      });
      if (uploads.length !== allUploadIds.length) {
        throw new RegistrationSubmissionError(
          "Upload tidak lengkap, bukan milik draft ini, atau sudah kedaluwarsa.",
          422,
          "INVALID_UPLOAD_OWNERSHIP",
          { uploads: "Unggah ulang dokumen yang belum valid." },
        );
      }

      const kindById = new Map(uploads.map((upload) => [upload.id, upload.kind]));
      if (
        !payload.uploads.cv || kindById.get(payload.uploads.cv.id) !== "CV" ||
        !payload.uploads.photo || kindById.get(payload.uploads.photo.id) !== "PHOTO" ||
        (payload.uploads.studentCard && kindById.get(payload.uploads.studentCard.id) !== "STUDENT_CARD") ||
        portfolioFileIds.some((id) => kindById.get(id) !== "PORTFOLIO")
      ) {
        throw new RegistrationSubmissionError(
          "Jenis upload tidak sesuai field dokumen.",
          422,
          "UPLOAD_KIND_MISMATCH",
        );
      }

      const medbrandSelected = selectedDepartments.some(
        ({ department }) => department.code === "MEDBRAND",
      );
      if (medbrandSelected && payload.portfolio.length === 0) {
        throw new RegistrationSubmissionError(
          "Portofolio wajib untuk pilihan Media Branding.",
          422,
          "PORTFOLIO_REQUIRED",
          { portfolio: "Tambahkan minimal satu file atau tautan HTTPS." },
        );
      }

      const registrationNumber =
        `${period.registrationPrefix}-${String(registrationSequence).padStart(4, "0")}`;
      const candidate = await transaction.candidate.create({
        data: {
          periodId: period.id,
          registrationNumber,
          name: payload.identity.name.trim(),
          nim: payload.identity.nim.trim(),
          normalizedNim: normalizeNim(payload.identity.nim),
          cohortCode: period.cohortCode,
          entryYear: period.entryYear,
          className: payload.identity.className.trim(),
          studyProgramId: studyProgram.id,
          phone: normalizePhone(payload.identity.phone),
          email: payload.identity.email.trim(),
          normalizedEmail: normalizeEmail(payload.identity.email),
          domicile: payload.identity.domicile.trim(),
          essayOrgExperience: payload.essays.organizationExperience.trim(),
          essayContribution: payload.essays.contribution.trim(),
          essayBalance: payload.essays.academicBalance.trim(),
          consentVersion: period.consentVersion,
          consentedAt: now,
          submittedAt: now,
          choices: {
            create: payload.choices.map((choice, index) => ({
              departmentId: choice.departmentId,
              rank: index === 0 ? "PRIMARY" : "SECONDARY",
              motivation: choice.motivation.trim(),
            })),
          },
        },
      });

      await transaction.fileUpload.updateMany({
        where: { id: { in: allUploadIds }, ownerTokenHash, candidateId: null },
        data: { candidateId: candidate.id, status: "FINALIZED", finalizedAt: now },
      });

      // Selection decision system (replaces candidate_locks going forward -
      // see product decision "PERUBAHAN SISTEM SELEKSI"): every candidate
      // starts with a PENDING decision between their Pilihan 1/2 depts.
      await ensureSelectionDecision(transaction, {
        candidateId: candidate.id,
        periodId: period.id,
        primaryDeptId: payload.choices[0].departmentId,
        secondaryDeptId: payload.choices[1].departmentId,
      });

      if (payload.portfolio.length > 0) {
        await transaction.candidatePortfolio.createMany({
          data: payload.portfolio.map((item, index) => ({
            candidateId: candidate.id,
            type: item.type,
            fileUploadId: item.type === "FILE" ? item.fileUploadId : null,
            externalUrl:
              item.type === "EXTERNAL_LINK" && item.externalUrl
                ? new URL(item.externalUrl).toString()
                : null,
            title: item.title?.trim() || null,
            description: item.description?.trim() || null,
            applicantRole: item.applicantRole?.trim() || null,
            creationYear: item.creationYear ?? null,
            sortOrder: item.sortOrder ?? index,
          })),
        });
      }

      const confirmationToken = randomBytes(32).toString("base64url");
      const confirmationExpiresAt = new Date(
        now.getTime() + environment.REGISTRATION_CONFIRMATION_TTL_SECONDS * 1000,
      );
      await transaction.registrationConfirmation.create({
        data: {
          candidateId: candidate.id,
          tokenHash: sha256(confirmationToken),
          expiresAt: confirmationExpiresAt,
        },
      });

      const choiceNames = payload.choices.map((choice) =>
        selectedDepartments.find(({ departmentId }) => departmentId === choice.departmentId)!
          .department.name,
      ) as [string, string];
      await transaction.emailOutbox.create({
        data: {
          type: "REGISTRATION_CONFIRMATION",
          recipientHash: sha256(normalizeEmail(payload.identity.email)),
          encryptedPayload: encryptJson({
            recipient: normalizeEmail(payload.identity.email),
            participantName: payload.identity.name.trim(),
            registrationNumber,
            submittedAt: now.toISOString(),
            choices: choiceNames,
          }, environment.AUTH_SECRET),
          maxAttempts: environment.EMAIL_OUTBOX_MAX_ATTEMPTS,
          idempotencyKey: `registration-confirmation:${candidate.id}`,
        },
      });

      await transaction.auditLog.create({
        data: {
          action: "SUBMIT",
          entityType: "Candidate",
          entityId: candidate.id,
          requestId,
          reason: "PUBLIC_REGISTRATION_SUBMITTED",
          afterJson: {
            periodId: period.id,
            registrationNumber,
            portfolioItemCount: payload.portfolio.length,
          },
        },
      });

      const response: RegistrationSuccessResponse = {
        registrationNumber,
        confirmationToken,
        confirmationExpiresAt: confirmationExpiresAt.toISOString(),
      };
      await transaction.idempotencyRecord.update({
        where: { scope_keyHash: { scope: "PUBLIC_REGISTRATION", keyHash } },
        data: {
          status: "COMPLETED",
          responseCode: 201,
          responseBody: { registrationNumber },
          responseSecretCiphertext: encryptJson(response, environment.AUTH_SECRET),
        },
      });
      return response;
      // Serializable isolation is not load-bearing for this transaction's
      // correctness: idempotency-key replay safety comes from the
      // pg_advisory_xact_lock above (isolation-independent), NIM/email
      // uniqueness from the DB unique constraint (P2002 below, any
      // isolation), the registration-number counter is now a pre-assigned
      // atomic increment outside this transaction, and the upload-claim
      // update's WHERE candidateId=null guard is safe under Postgres's
      // read-committed "match against latest committed row" UPDATE
      // semantics. Serializable's whole-transaction read/write dependency
      // tracking was instead the dominant source of aborts under a
      // registration-deadline traffic spike (Phase 8 P4 load test) even
      // after the counter was extracted, so this now runs at Postgres's
      // default read-committed isolation; the retry loop above remains as
      // a safety net for genuine deadlocks.
      }, { timeout: 20_000 });
    } catch (error) {
      if (error instanceof RegistrationSubmissionError) throw error;
      if (isUniqueViolation(error)) {
        throw new RegistrationSubmissionError(
          "NIM atau email sudah terdaftar pada periode ini.",
          409,
          "DUPLICATE_CANDIDATE",
        );
      }
      // A serialization failure on the final attempt must fall through to
      // the TRANSACTION_RETRY_EXHAUSTED response below, not leak the raw
      // driver error - previously `attempt < 2` was false on that last
      // attempt and this branch re-threw the unwrapped PrismaClientKnownRequestError.
      if (isSerializationFailure(error)) {
        if (attempt < SUBMIT_MAX_ATTEMPTS - 1) {
          await sleep(retryBackoffMs(attempt));
          continue;
        }
        break;
      }
      throw error;
    }
  }
  throw new RegistrationSubmissionError(
    "Konflik transaksi berulang. Coba kembali dengan kunci idempotensi yang sama.",
    409,
    "TRANSACTION_RETRY_EXHAUSTED",
  );
}

export async function getRegistrationConfirmation(token: string, now = new Date()) {
  if (!/^[A-Za-z0-9_-]{32,100}$/u.test(token)) return null;
  return prisma.registrationConfirmation.findFirst({
    where: { tokenHash: sha256(token), expiresAt: { gt: now } },
    select: {
      expiresAt: true,
      candidate: {
        select: {
          name: true,
          registrationNumber: true,
          submittedAt: true,
          choices: {
            orderBy: { rank: "asc" },
            select: { rank: true, department: { select: { name: true } } },
          },
        },
      },
    },
  });
}
