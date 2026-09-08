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

      // Phase A - "Jalur Legislatif": authoritative server-side guard
      // against fresh DB data (validateRegistrationPayload's own check is
      // a fast-fail against a client-supplied config snapshot, not a
      // substitute for this). Both choices must share one track; if the
      // client declared a track explicitly, it must agree too - defaults
      // to EXECUTIVE when omitted so the existing, track-unaware form
      // keeps submitting successfully unchanged.
      const departmentById = new Map(
        selectedDepartments.map(({ department }) => [department.id, department]),
      );
      const choiceTracks = payload.choices.map(
        (choice) => departmentById.get(choice.departmentId)!.track,
      );
      const declaredTrack = payload.track ?? "EXECUTIVE";
      if (choiceTracks[0] !== choiceTracks[1] || choiceTracks[0] !== declaredTrack) {
        throw new RegistrationSubmissionError(
          "Kedua pilihan Birdep harus berasal dari jalur yang sama.",
          422,
          "CROSS_TRACK_CHOICE",
          { "choices.1.departmentId": "Pilihan Birdep harus berasal dari jalur (Eksekutif/Legislatif) yang sama." },
        );
      }
      const track = choiceTracks[0];

      const allUploadIds = [
        payload.uploads.cv?.id,
        payload.uploads.photo?.id,
        payload.uploads.studentCard?.id,
        payload.uploads.followEvidence?.id,
        payload.uploads.paymentEvidence?.id,
        payload.uploads.senbudInstagramEvidence?.id,
      ].filter((value): value is string => Boolean(value));
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
        !payload.uploads.followEvidence || kindById.get(payload.uploads.followEvidence.id) !== "FOLLOW_EVIDENCE" ||
        !payload.uploads.paymentEvidence || kindById.get(payload.uploads.paymentEvidence.id) !== "PAYMENT_EVIDENCE" ||
        (payload.uploads.senbudInstagramEvidence && kindById.get(payload.uploads.senbudInstagramEvidence.id) !== "SENBUD_INSTAGRAM")
      ) {
        throw new RegistrationSubmissionError(
          "Jenis upload tidak sesuai field dokumen.",
          422,
          "UPLOAD_KIND_MISMATCH",
        );
      }

      // Phase C - "Field Khusus Per Birdep" (ADR-043): BADMEDBRND
      // legislatif shares Medbrand eksekutif's exact same portfolio
      // requirement - both authoritative checks against fresh DB data.
      // Phase D (ADR-045): the field itself is a Google Drive URL now,
      // not an uploaded file.
      const portfolioRequired = selectedDepartments.some(
        ({ department }) => department.code === "MEDBRAND" || department.code === "BADMEDBRND",
      );
      if (portfolioRequired && !payload.departmentFields.portfolioUrl) {
        throw new RegistrationSubmissionError(
          "Link Google Drive portofolio wajib untuk pilihan Media Branding.",
          422,
          "PORTFOLIO_REQUIRED",
          { "departmentFields.portfolioUrl": "Isi link Google Drive portofolio kamu." },
        );
      }

      // Phase C - "Field Khusus Per Birdep" (ADR-043): MBTI (Komit) dan
      // fokus (Adkesmah) wajib hanya jika Birdep terkait benar-benar
      // dipilih - dicek ulang di sini terhadap data DB segar, bukan cuma
      // mengandalkan validateRegistrationPayload's fast-fail di atas.
      const komitSelected = selectedDepartments.some(({ department }) => department.code === "KOMIT");
      if (komitSelected && !payload.departmentFields.komitMbti) {
        throw new RegistrationSubmissionError(
          "Tipe MBTI wajib untuk pilihan Biro Kolaborasi dan Kemitraan.",
          422,
          "MBTI_REQUIRED",
          { "departmentFields.komitMbti": "Isi tipe MBTI kamu." },
        );
      }
      const adkesmahSelected = selectedDepartments.some(({ department }) => department.code === "ADKESMAH");
      if (adkesmahSelected && !payload.departmentFields.adkesmahFocus) {
        throw new RegistrationSubmissionError(
          "Bidang fokus wajib untuk pilihan Departemen Advokasi dan Kesejahteraan Mahasiswa.",
          422,
          "ADKESMAH_FOCUS_REQUIRED",
          { "departmentFields.adkesmahFocus": "Pilih bidang fokus kamu." },
        );
      }
      // "Tambahan Field Khusus Senbud": Instagram evidence upload wajib
      // hanya jika Senbud benar-benar dipilih - portfolio link tetap
      // opsional (formatnya sudah dicek oleh validateRegistrationPayload
      // di atas, tidak perlu diulang di sini).
      const senbudSelected = selectedDepartments.some(({ department }) => department.code === "SENBUD");
      if (senbudSelected && !payload.uploads.senbudInstagramEvidence) {
        throw new RegistrationSubmissionError(
          "Bukti upload story/post Instagram wajib untuk pilihan Seni dan Budaya.",
          422,
          "SENBUD_INSTAGRAM_REQUIRED",
          { "uploads.senbudInstagramEvidence": "Unggah bukti story/post Instagram kamu." },
        );
      }

      const registrationNumber =
        `${period.registrationPrefix}-${String(registrationSequence).padStart(4, "0")}`;
      const candidate = await transaction.candidate.create({
        data: {
          periodId: period.id,
          registrationNumber,
          track,
          name: payload.identity.name.trim(),
          nim: payload.identity.nim.trim(),
          normalizedNim: normalizeNim(payload.identity.nim),
          cohortCode: period.cohortCode,
          entryYear: period.entryYear,
          className: payload.identity.className.trim(),
          studyProgram: payload.identity.studyProgram.trim(),
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

      // Phase C - "Field Khusus Per Birdep" (ADR-043), extended Phase D
      // (ADR-045) with portfolioUrl/budgetPlanUrl: one row only when at
      // least one of the four fields was actually submitted - "don't
      // write rows nobody needed".
      if (
        payload.departmentFields.komitMbti || payload.departmentFields.adkesmahFocus ||
        payload.departmentFields.portfolioUrl || payload.departmentFields.budgetPlanUrl ||
        payload.departmentFields.senbudPortfolioUrl || payload.departmentFields.ristekPortfolioUrl
      ) {
        await transaction.candidateSupplementalData.create({
          data: {
            candidateId: candidate.id,
            komitMbti: payload.departmentFields.komitMbti ?? null,
            adkesmahFocus: payload.departmentFields.adkesmahFocus ?? null,
            portfolioUrl: payload.departmentFields.portfolioUrl ?? null,
            budgetPlanUrl: payload.departmentFields.budgetPlanUrl ?? null,
            senbudPortfolioUrl: payload.departmentFields.senbudPortfolioUrl ?? null,
            ristekPortfolioUrl: payload.departmentFields.ristekPortfolioUrl ?? null,
          },
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
            hasPortfolioUrl: Boolean(payload.departmentFields.portfolioUrl),
            hasBudgetPlanUrl: Boolean(payload.departmentFields.budgetPlanUrl),
            hasSenbudPortfolioUrl: Boolean(payload.departmentFields.senbudPortfolioUrl),
            hasRistekPortfolioUrl: Boolean(payload.departmentFields.ristekPortfolioUrl),
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
