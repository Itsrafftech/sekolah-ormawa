import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { RegistrationPayload } from "@/features/registration/contracts";
import type { PrivateStorageAdapter } from "@/server/storage/private-storage";

// Phase 8 P4: load test simulating a registration-deadline traffic spike,
// plus a direct check that the production Prisma/pg pool (max: 20, see
// src/lib/db.ts) queues rather than errors once concurrency exceeds it.
const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) throw new Error("TEST_DATABASE_URL wajib untuk load test.");
process.env.DATABASE_URL = connectionString;
process.env.REGISTRATION_SUBMISSION_ENABLED = "true";

const pool = new Pool({ connectionString });
const periodId = "85100000-0000-4000-8000-000000000001";
const departmentA = "85200000-0000-4000-8000-000000000001";
const departmentB = "85200000-0000-4000-8000-000000000002";
const studyProgramId = "85300000-0000-4000-8000-000000000001";
const motivation = Array.from({ length: 100 }, (_, index) => `alasan${index}`).join(" ");
const pdf = new TextEncoder().encode("%PDF-1.4 synthetic load-test fixture");
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

class MemoryStorage implements PrivateStorageAdapter {
  readonly objects = new Map<string, Uint8Array>();
  async put(key: string, bytes: Uint8Array) { this.objects.set(key, bytes); }
  async read(key: string) { return Buffer.from(this.objects.get(key) ?? []); }
  async delete(key: string) { this.objects.delete(key); }
}
const storage = new MemoryStorage();

let createPrivateUpload: typeof import("@/server/registration/uploads").createPrivateUpload;
let submitRegistration: typeof import("@/server/registration/submit").submitRegistration;
let prisma: typeof import("@/lib/db").prisma;
let disconnectPrismaForTests: typeof import("@/lib/db").disconnectPrismaForTests;

function percentile(sortedMs: number[], p: number): number {
  const index = Math.min(sortedMs.length - 1, Math.ceil((p / 100) * sortedMs.length) - 1);
  return sortedMs[Math.max(0, index)];
}

function summarize(label: string, durationsMs: number[]) {
  const sorted = [...durationsMs].sort((a, b) => a - b);
  const sum = sorted.reduce((total, value) => total + value, 0);
  console.log(
    `[load-test] ${label}: n=${sorted.length} min=${sorted[0]}ms avg=${Math.round(sum / sorted.length)}ms ` +
    `p50=${percentile(sorted, 50)}ms p95=${percentile(sorted, 95)}ms max=${sorted[sorted.length - 1]}ms`,
  );
}

beforeAll(async () => {
  ({ createPrivateUpload } = await import("@/server/registration/uploads"));
  ({ submitRegistration } = await import("@/server/registration/submit"));
  ({ prisma, disconnectPrismaForTests } = await import("@/lib/db"));

  await pool.query(`
    TRUNCATE TABLE
      registration_confirmations, candidate_supplemental_data, candidate_locks,
      candidate_choices, file_uploads, candidates, email_outbox,
      idempotency_records, audit_logs, period_departments,
      study_programs, recruitment_periods, departments
    RESTART IDENTITY CASCADE
  `);
  await pool.query(
    `INSERT INTO departments
      (id, code, name, "shortName", "unitType", "sortOrder", "isActive", "configStatus", "createdAt", "updatedAt")
     VALUES ($1, 'LOAD-A', 'Birdep Load A', 'A', 'BIRO', 1, true, 'ACTIVE', now(), now()),
            ($2, 'LOAD-B', 'Birdep Load B', 'B', 'DEPARTEMEN', 2, true, 'ACTIVE', now(), now())`,
    [departmentA, departmentB],
  );
  await pool.query(
    `INSERT INTO recruitment_periods
      (id, code, name, status, "configStatus", "cohortCode", "entryYear", "registrationPrefix", "registrationSequence", "opensAt", "closesAt", "choice2Required", "allowUnlock", "consentVersion", "createdAt", "updatedAt")
     VALUES ($1, 'PHASE8-LOAD', 'Periode Sintetis Load Test', 'OPEN', 'ACTIVE', 63, 2026, 'LOAD63', 0, now() - interval '1 hour', now() + interval '1 day', true, false, 'DRAFT-CONSENT-LOAD', now(), now())`,
    [periodId],
  );
  for (const departmentId of [departmentA, departmentB]) {
    await pool.query(
      `INSERT INTO period_departments (id, "periodId", "departmentId", "acceptsApplications", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, true, now(), now())`,
      [randomUUID(), periodId, departmentId],
    );
  }
  await pool.query(
    `INSERT INTO study_programs (id, code, name, "configStatus", "isActive", "createdAt", "updatedAt")
     VALUES ($1, 'PRODI-LOAD', 'Program Studi Load Test', 'ACTIVE', true, now(), now())`,
    [studyProgramId],
  );
});

afterAll(async () => {
  await pool.query(`
    TRUNCATE TABLE
      registration_confirmations, candidate_supplemental_data, candidate_choices,
      file_uploads, candidates, email_outbox, idempotency_records, audit_logs,
      period_departments, study_programs, recruitment_periods, departments
    RESTART IDENTITY CASCADE
  `);
  await disconnectPrismaForTests();
  await pool.end();
});

// "Guidebook, ketentuan, dan pembayaran": periodId+paymentCode is now
// unique, so every concurrently-built payload in the P4 spike test below
// needs a distinct code - a module-level counter incremented at the very
// top of buildPayload(), before its first `await`. Array.from's mapping
// callback below invokes buildPayload() synchronously once per index (a
// function call always runs synchronously up to its first await/return,
// even though it's declared `async`), so the increments themselves can
// never interleave regardless of how the resulting promises later
// interleave at their own await points.
let paymentCodeCounter = 0;

async function buildPayload(suffix: string): Promise<{ payload: RegistrationPayload; ownerToken: string }> {
  paymentCodeCounter += 1;
  const paymentCode = String(paymentCodeCounter).padStart(3, "0");
  const ownerToken = `owner-load-${suffix}`;
  const cv = await createPrivateUpload({
    periodId, ownerToken, kind: "CV", fileName: `cv-${suffix}.pdf`, declaredMimeType: "application/pdf", bytes: pdf, storage,
  });
  const photo = await createPrivateUpload({
    periodId, ownerToken, kind: "PHOTO", fileName: `photo-${suffix}.png`, declaredMimeType: "image/png", bytes: png, storage,
  });
  const followEvidence = await createPrivateUpload({
    periodId, ownerToken, kind: "FOLLOW_EVIDENCE", fileName: `bukti-${suffix}.pdf`, declaredMimeType: "application/pdf", bytes: pdf, storage,
  });
  const paymentEvidence = await createPrivateUpload({
    periodId, ownerToken, kind: "PAYMENT_EVIDENCE", fileName: `bayar-${suffix}.pdf`, declaredMimeType: "application/pdf", bytes: pdf, storage,
  });
  return {
    ownerToken,
    payload: {
      periodId,
      guidebookAcknowledged: true,
      identity: {
        name: `Peserta Beban ${suffix}`,
        nim: `NIM-LOAD-${suffix}`,
        cohortCode: 63,
        entryYear: 2026,
        className: "Kelas Beban",
        studyProgram: "Program Studi Load Test",
        phone: "081200000099",
        email: `load-${suffix}@example.test`,
        domicile: "Kota Beban",
      },
      choices: [
        { departmentId: departmentA, motivation },
        { departmentId: departmentB, motivation },
      ],
      uploads: {
        cv: { id: cv.id, kind: "CV", name: cv.originalFileName, sizeBytes: cv.sizeBytes, mimeType: cv.detectedMimeType ?? "application/pdf" },
        photo: { id: photo.id, kind: "PHOTO", name: photo.originalFileName, sizeBytes: photo.sizeBytes, mimeType: photo.detectedMimeType ?? "image/png" },
        studentCard: null,
        followEvidence: { id: followEvidence.id, kind: "FOLLOW_EVIDENCE", name: followEvidence.originalFileName, sizeBytes: followEvidence.sizeBytes, mimeType: followEvidence.detectedMimeType ?? "application/pdf" },
        paymentEvidence: { id: paymentEvidence.id, kind: "PAYMENT_EVIDENCE", name: paymentEvidence.originalFileName, sizeBytes: paymentEvidence.sizeBytes, mimeType: paymentEvidence.detectedMimeType ?? "application/pdf" },
      },
      essays: { organizationExperience: "Sintetis", contribution: "Sintetis", academicBalance: "Sintetis" },
      payment: { code: paymentCode, amount: 15000 + Number(paymentCode) },
      departmentFields: {},
      consent: { truthful: true, processing: true, version: "DRAFT-CONSENT-LOAD" },
    },
  };
}

describe("P4 database connection pooling", () => {
  it("100 query bersamaan (>pool.max=20) mengantre dan tetap selesai tanpa error", async () => {
    const concurrency = 100;
    const durations: number[] = [];
    const started = Date.now();

    const results = await Promise.allSettled(
      Array.from({ length: concurrency }, async () => {
        const queryStart = Date.now();
        // 30ms of server-side work per query so 100 concurrent callers
        // against a 20-connection pool must queue across ~5 batches.
        // pg_sleep() returns void, which $queryRaw's driver adapter can't
        // deserialize into a typed row at all (even alongside other
        // columns) - $executeRaw skips that and just reports rows affected.
        await prisma.$executeRaw`SELECT pg_sleep(0.03)`;
        durations.push(Date.now() - queryStart);
      }),
    );

    const elapsed = Date.now() - started;
    const rejected = results.filter((result) => result.status === "rejected");
    summarize("100 concurrent pg_sleep(30ms) queries against pool.max=20", durations);
    console.log(`[load-test] total wall time for ${concurrency} queued queries: ${elapsed}ms`);
    if (rejected.length > 0) {
      console.log("[load-test] contoh kegagalan pool test:", (rejected[0] as PromiseRejectedResult).reason);
    }

    expect(rejected).toHaveLength(0);
    // A healthy queue clears 100 x 30ms work over 20 connections in ~5
    // batches (~150ms of pure DB time); generous ceiling for CI/dev jitter.
    expect(elapsed).toBeLessThan(15_000);
  }, 30_000);
});

describe("P4 load test - lonjakan traffic pendaftaran", () => {
  it("60 submission unik bersamaan semua berhasil dengan nomor registrasi unik, tanpa exhaustion pool", async () => {
    const concurrency = 60;
    const prepared = await Promise.all(
      Array.from({ length: concurrency }, (_, index) => buildPayload(`spike-${index}-${randomUUID().slice(0, 6)}`)),
    );

    const durations: number[] = [];
    const started = Date.now();
    const results = await Promise.allSettled(
      prepared.map(async ({ payload, ownerToken }) => {
        const submitStart = Date.now();
        const result = await submitRegistration({
          payload,
          ownerToken,
          idempotencyKey: `idem_${randomUUID().replaceAll("-", "")}`,
        });
        durations.push(Date.now() - submitStart);
        return result;
      }),
    );
    const elapsed = Date.now() - started;

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    summarize(`${concurrency} concurrent registration submissions (deadline spike simulation)`, durations);
    console.log(`[load-test] total wall time: ${elapsed}ms, sukses=${fulfilled.length}, gagal=${rejected.length}`);
    if (rejected.length > 0) {
      console.log("[load-test] contoh kegagalan:", (rejected[0] as PromiseRejectedResult).reason);
    }

    expect(fulfilled).toHaveLength(concurrency);
    const registrationNumbers = fulfilled.map((result) =>
      (result as PromiseFulfilledResult<Awaited<ReturnType<typeof submitRegistration>>>).value.registrationNumber,
    );
    expect(new Set(registrationNumbers).size).toBe(concurrency);

    const candidateCount = await pool.query(`SELECT count(*)::int AS count FROM candidates WHERE "periodId"=$1`, [periodId]);
    expect(candidateCount.rows[0].count).toBe(concurrency);
  }, 60_000);
});
