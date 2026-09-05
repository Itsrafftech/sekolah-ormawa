import { createHash, randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { RegistrationPayload, UploadReference } from "@/features/registration/contracts";
import type { PrivateStorageAdapter } from "@/server/storage/private-storage";

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) throw new Error("TEST_DATABASE_URL wajib untuk integration test.");

process.env.DATABASE_URL = connectionString;
process.env.REGISTRATION_SUBMISSION_ENABLED = "true";

const pool = new Pool({ connectionString });
const periodId = "71000000-0000-4000-8000-000000000001";
const departmentA = "72000000-0000-4000-8000-000000000001";
const departmentB = "72000000-0000-4000-8000-000000000002";
const medbrand = "72000000-0000-4000-8000-000000000003";
const studyProgramId = "73000000-0000-4000-8000-000000000001";
const motivation = Array.from({ length: 100 }, (_, index) => `alasan${index}`).join(" ");
const pdf = new TextEncoder().encode("%PDF-1.4 synthetic integration fixture");
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

class MemoryStorage implements PrivateStorageAdapter {
  readonly objects = new Map<string, Uint8Array>();
  async put(key: string, bytes: Uint8Array) { this.objects.set(key, bytes); }
  async read(key: string) { return Buffer.from(this.objects.get(key) ?? []); }
  async delete(key: string) { this.objects.delete(key); }
}

const storage = new MemoryStorage();
let createPrivateUpload: typeof import("@/server/registration/uploads").createPrivateUpload;
let cleanupOrphanUploads: typeof import("@/server/registration/uploads").cleanupOrphanUploads;
let submitRegistration: typeof import("@/server/registration/submit").submitRegistration;
let getRegistrationConfirmation: typeof import("@/server/registration/submit").getRegistrationConfirmation;
let processEmailOutbox: typeof import("@/server/email/outbox").processEmailOutbox;
let disconnectPrismaForTests: typeof import("@/lib/db").disconnectPrismaForTests;

beforeAll(async () => {
  ({ createPrivateUpload, cleanupOrphanUploads } = await import("@/server/registration/uploads"));
  ({ submitRegistration, getRegistrationConfirmation } = await import("@/server/registration/submit"));
  ({ processEmailOutbox } = await import("@/server/email/outbox"));
  ({ disconnectPrismaForTests } = await import("@/lib/db"));

  await pool.query(`
    TRUNCATE TABLE
      registration_confirmations, candidate_portfolios, candidate_locks,
      candidate_choices, file_uploads, candidates, email_outbox,
      idempotency_records, audit_logs, period_departments,
      study_programs, recruitment_periods, departments
    RESTART IDENTITY CASCADE
  `);
  await pool.query(
    `INSERT INTO departments
      (id, code, name, "shortName", "unitType", "sortOrder", "isActive", "configStatus", "createdAt", "updatedAt")
     VALUES ($1, 'TEST-A', 'Birdep Test A', 'A', 'BIRO', 1, true, 'ACTIVE', now(), now()),
            ($2, 'TEST-B', 'Birdep Test B', 'B', 'DEPARTEMEN', 2, true, 'ACTIVE', now(), now()),
            ($3, 'MEDBRAND', 'Biro Media Branding', 'Medbrand', 'BIRO', 3, true, 'ACTIVE', now(), now())`,
    [departmentA, departmentB, medbrand],
  );
  await pool.query(
    `INSERT INTO recruitment_periods
      (id, code, name, status, "configStatus", "cohortCode", "entryYear", "registrationPrefix", "registrationSequence", "opensAt", "closesAt", "choice2Required", "allowUnlock", "consentVersion", "createdAt", "updatedAt")
     VALUES ($1, 'PHASE3-TEST', 'Periode Sintetis Phase 3', 'OPEN', 'ACTIVE', 63, 2026, 'TEST63', 0, now() - interval '1 hour', now() + interval '1 day', true, false, 'DRAFT-CONSENT-TEST', now(), now())`,
    [periodId],
  );
  for (const departmentId of [departmentA, departmentB, medbrand]) {
    await pool.query(
      `INSERT INTO period_departments
        (id, "periodId", "departmentId", "acceptsApplications", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, true, now(), now())`,
      [randomUUID(), periodId, departmentId],
    );
  }
  await pool.query(
    `INSERT INTO study_programs
      (id, code, name, "configStatus", "isActive", "createdAt", "updatedAt")
     VALUES ($1, 'PRODI-TEST', 'Program Studi Sintetis', 'ACTIVE', true, now(), now())`,
    [studyProgramId],
  );
});

afterAll(async () => {
  await pool.query(`
    TRUNCATE TABLE
      registration_confirmations, candidate_portfolios, candidate_choices,
      file_uploads, candidates, email_outbox, idempotency_records, audit_logs,
      period_departments, study_programs, recruitment_periods, departments
    RESTART IDENTITY CASCADE
  `);
  await disconnectPrismaForTests();
  await pool.end();
});

async function upload(
  ownerToken: string,
  kind: "CV" | "PHOTO" | "PORTFOLIO",
  suffix: string,
  portfolioMime: "JPEG" | "PNG" = "JPEG",
): Promise<UploadReference> {
  const isPdf = kind === "CV";
  const isPortfolio = kind === "PORTFOLIO";
  const isPngPortfolio = isPortfolio && portfolioMime === "PNG";
  const result = await createPrivateUpload({
    periodId,
    ownerToken,
    kind,
    fileName: isPdf ? `${suffix}.pdf` : isPortfolio && !isPngPortfolio ? `${suffix}.jpg` : `${suffix}.png`,
    declaredMimeType: isPdf ? "application/pdf" : isPortfolio && !isPngPortfolio ? "image/jpeg" : "image/png",
    bytes: isPdf ? pdf : isPortfolio && !isPngPortfolio ? jpeg : png,
    storage,
  });
  return {
    id: result.id,
    kind: result.kind,
    name: result.originalFileName,
    sizeBytes: result.sizeBytes,
    mimeType: result.detectedMimeType ?? "application/octet-stream",
  };
}

async function validPayload(input: {
  ownerToken: string;
  suffix: string;
  primary?: string;
  secondary?: string;
  portfolio?: "FILE" | "LINK" | "NONE";
  portfolioMime?: "JPEG" | "PNG";
}): Promise<RegistrationPayload> {
  const cv = await upload(input.ownerToken, "CV", `cv-${input.suffix}`);
  const photo = await upload(input.ownerToken, "PHOTO", `photo-${input.suffix}`);
  const portfolio = [] as RegistrationPayload["portfolio"];
  if (input.portfolio === "FILE") {
    const file = await upload(input.ownerToken, "PORTFOLIO", `portfolio-${input.suffix}`, input.portfolioMime);
    portfolio.push({ type: "FILE", fileUploadId: file.id, title: "Karya Sintetis", sortOrder: 0 });
  }
  if (input.portfolio === "LINK") {
    portfolio.push({ type: "EXTERNAL_LINK", externalUrl: "https://portfolio.example.test/synthetic", title: "Karya Sintetis", sortOrder: 0 });
  }
  return {
    periodId,
    identity: {
      name: `Peserta Sintetis ${input.suffix}`,
      nim: `NIM-${input.suffix}`,
      cohortCode: 63,
      entryYear: 2026,
      className: "Kelas Test",
      studyProgramId,
      phone: "081200000000",
      email: `${input.suffix}@example.test`,
      domicile: "Kota Sintetis",
    },
    choices: [
      { departmentId: input.primary ?? departmentA, motivation },
      { departmentId: input.secondary ?? departmentB, motivation },
    ],
    uploads: { cv, photo, studentCard: null },
    essays: { organizationExperience: "Sintetis", contribution: "Sintetis", academicBalance: "Sintetis" },
    portfolio,
    consent: { truthful: true, processing: true, version: "DRAFT-CONSENT-TEST" },
  };
}

describe.sequential("Phase 3 registration transaction", () => {
  it("menyelesaikan happy path non-Medbrand dengan confirmation dan outbox", async () => {
    const ownerToken = `owner-${randomUUID()}`;
    const payload = await validPayload({ ownerToken, suffix: "happy" });
    const result = await submitRegistration({ payload, ownerToken, idempotencyKey: `idem_${randomUUID().replaceAll("-", "")}` });
    expect(result.registrationNumber).toMatch(/^TEST63-\d{4}$/u);
    expect(await getRegistrationConfirmation(result.confirmationToken)).not.toBeNull();
    const counts = await pool.query(`SELECT (SELECT count(*) FROM candidates) AS candidates, (SELECT count(*) FROM email_outbox) AS emails`);
    expect(Number(counts.rows[0].candidates)).toBe(1);
    expect(Number(counts.rows[0].emails)).toBe(1);
  });

  it.each([
    ["Pilihan 1 JPG", medbrand, departmentB, "FILE", "JPEG"],
    ["Pilihan 2 PNG", departmentA, medbrand, "FILE", "PNG"],
    ["URL HTTPS", medbrand, departmentB, "LINK", undefined],
  ] as const)("menerima Medbrand dengan %s", async (_, primary, secondary, portfolio, portfolioMime) => {
    const suffix = `med-${randomUUID().slice(0, 8)}`;
    const ownerToken = `owner-${suffix}`;
    const payload = await validPayload({ ownerToken, suffix, primary, secondary, portfolio, portfolioMime });
    await expect(submitRegistration({ payload, ownerToken, idempotencyKey: `idem_${randomUUID().replaceAll("-", "")}` })).resolves.toMatchObject({ registrationNumber: expect.any(String) });
  });

  it("menerima file dan URL Medbrand sebagai dua item terpisah", async () => {
    const suffix = `mixed-${randomUUID().slice(0, 8)}`;
    const ownerToken = `owner-${suffix}`;
    const payload = await validPayload({ ownerToken, suffix, primary: medbrand, portfolio: "FILE" });
    payload.portfolio.push({
      type: "EXTERNAL_LINK",
      externalUrl: "https://portfolio.example.test/mixed",
      title: "Tautan Sintetis",
      sortOrder: 1,
    });
    const result = await submitRegistration({ payload, ownerToken, idempotencyKey: `idem_${randomUUID().replaceAll("-", "")}` });
    const count = await pool.query(
      `SELECT count(*) FROM candidate_portfolios p JOIN candidates c ON c.id = p."candidateId" WHERE c."registrationNumber" = $1`,
      [result.registrationNumber],
    );
    expect(Number(count.rows[0].count)).toBe(2);
  });

  it("menolak upload tervalidasi milik draft lain", async () => {
    const suffix = `ownership-${randomUUID().slice(0, 8)}`;
    const ownerToken = `owner-${suffix}`;
    const payload = await validPayload({ ownerToken, suffix });
    await expect(submitRegistration({
      payload,
      ownerToken: `owner-lain-${randomUUID()}`,
      idempotencyKey: `idem_${randomUUID().replaceAll("-", "")}`,
    })).rejects.toMatchObject({ code: "INVALID_UPLOAD_OWNERSHIP" });
  });

  it("menolak Medbrand tanpa portofolio", async () => {
    const suffix = `missing-${randomUUID().slice(0, 8)}`;
    const ownerToken = `owner-${suffix}`;
    const payload = await validPayload({ ownerToken, suffix, primary: medbrand, portfolio: "NONE" });
    await expect(submitRegistration({ payload, ownerToken, idempotencyKey: `idem_${randomUUID().replaceAll("-", "")}` })).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("retry Idempotency-Key mengembalikan hasil awal tanpa duplikasi", async () => {
    const suffix = `retry-${randomUUID().slice(0, 8)}`;
    const ownerToken = `owner-${suffix}`;
    const payload = await validPayload({ ownerToken, suffix });
    const key = `idem_${randomUUID().replaceAll("-", "")}`;
    const first = await submitRegistration({ payload, ownerToken, idempotencyKey: key });
    const second = await submitRegistration({ payload, ownerToken, idempotencyKey: key });
    expect(second).toEqual(first);
    const count = await pool.query(`SELECT count(*) FROM candidates WHERE "normalizedNim" = $1`, [`NIM${suffix.replaceAll("-", "").toUpperCase()}`]);
    expect(Number(count.rows[0].count)).toBe(1);
  });

  it("dua submit valid berbeda mendapat nomor registrasi berbeda", async () => {
    const firstOwner = `owner-${randomUUID()}`;
    const secondOwner = `owner-${randomUUID()}`;
    const [firstPayload, secondPayload] = await Promise.all([
      validPayload({ ownerToken: firstOwner, suffix: `seq-a-${randomUUID().slice(0, 6)}` }),
      validPayload({ ownerToken: secondOwner, suffix: `seq-b-${randomUUID().slice(0, 6)}` }),
    ]);
    const [first, second] = await Promise.all([
      submitRegistration({ payload: firstPayload, ownerToken: firstOwner, idempotencyKey: `idem_${randomUUID().replaceAll("-", "")}` }),
      submitRegistration({ payload: secondPayload, ownerToken: secondOwner, idempotencyKey: `idem_${randomUUID().replaceAll("-", "")}` }),
    ]);
    expect(first.registrationNumber).not.toBe(second.registrationNumber);
  });

  it("dua request paralel dengan NIM sama menghasilkan satu kandidat", async () => {
    const suffix = `dup-nim-${randomUUID().slice(0, 6)}`;
    const owners = [`owner-${randomUUID()}`, `owner-${randomUUID()}`];
    const payloads = await Promise.all(owners.map((owner, index) => validPayload({ ownerToken: owner, suffix: `${suffix}-${index}` })));
    payloads[1].identity.nim = payloads[0].identity.nim;
    const results = await Promise.allSettled(payloads.map((payload, index) => submitRegistration({ payload, ownerToken: owners[index], idempotencyKey: `idem_${randomUUID().replaceAll("-", "")}` })));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const count = await pool.query(`SELECT count(*) FROM candidates WHERE "normalizedNim" = $1`, [payloads[0].identity.nim.replaceAll("-", "").toUpperCase()]);
    expect(Number(count.rows[0].count)).toBe(1);
  });

  it("dua request paralel dengan email sama menghasilkan satu kandidat", async () => {
    const suffix = `dup-email-${randomUUID().slice(0, 6)}`;
    const owners = [`owner-${randomUUID()}`, `owner-${randomUUID()}`];
    const payloads = await Promise.all(owners.map((owner, index) => validPayload({ ownerToken: owner, suffix: `${suffix}-${index}` })));
    payloads[1].identity.email = payloads[0].identity.email;
    const results = await Promise.allSettled(payloads.map((payload, index) => submitRegistration({ payload, ownerToken: owners[index], idempotencyKey: `idem_${randomUUID().replaceAll("-", "")}` })));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const count = await pool.query(`SELECT count(*) FROM candidates WHERE "normalizedEmail" = $1`, [payloads[0].identity.email.toLowerCase()]);
    expect(Number(count.rows[0].count)).toBe(1);
  });

  it("periode CLOSED menolak submission", async () => {
    await pool.query(`UPDATE recruitment_periods SET status = 'CLOSED' WHERE id = $1`, [periodId]);
    const ownerToken = `owner-${randomUUID()}`;
    const payload = await validPayload({ ownerToken, suffix: `closed-${randomUUID().slice(0, 6)}` });
    await expect(submitRegistration({ payload, ownerToken, idempotencyKey: `idem_${randomUUID().replaceAll("-", "")}` })).rejects.toMatchObject({ code: "PERIOD_CLOSED" });
    await pool.query(`UPDATE recruitment_periods SET status = 'OPEN' WHERE id = $1`, [periodId]);
  });

  it("email provider gagal tetapi kandidat tetap committed dan outbox retryable", async () => {
    const suffix = `email-fail-${randomUUID().slice(0, 6)}`;
    const ownerToken = `owner-${suffix}`;
    const payload = await validPayload({ ownerToken, suffix });
    const result = await submitRegistration({ payload, ownerToken, idempotencyKey: `idem_${randomUUID().replaceAll("-", "")}` });
    await processEmailOutbox({ limit: 50, adapter: { async send() { throw new Error("SyntheticProviderFailure"); } } });
    const rows = await pool.query(`SELECT c.id, e.status FROM candidates c JOIN email_outbox e ON e."idempotencyKey" = 'registration-confirmation:' || c.id WHERE c."registrationNumber" = $1`, [result.registrationNumber]);
    expect(rows.rows[0]).toMatchObject({ status: "FAILED" });
  });

  it("upload yatim kedaluwarsa dibersihkan", async () => {
    const uploadRef = await upload(`owner-${randomUUID()}`, "PHOTO", `orphan-${randomUUID().slice(0, 6)}`);
    await pool.query(`UPDATE file_uploads SET "expiresAt" = now() - interval '1 minute' WHERE id = $1`, [uploadRef.id]);
    expect(await cleanupOrphanUploads(new Date(), storage)).toBeGreaterThanOrEqual(1);
    const row = await pool.query(`SELECT status FROM file_uploads WHERE id = $1`, [uploadRef.id]);
    expect(row.rows[0].status).toBe("ORPHANED");
  });

  it("confirmation token invalid atau kedaluwarsa ditolak", async () => {
    expect(await getRegistrationConfirmation("invalid-token-that-is-long-enough-1234567890")).toBeNull();
    const suffix = `expired-${randomUUID().slice(0, 6)}`;
    const ownerToken = `owner-${suffix}`;
    const payload = await validPayload({ ownerToken, suffix });
    const result = await submitRegistration({ payload, ownerToken, idempotencyKey: `idem_${randomUUID().replaceAll("-", "")}` });
    const tokenHash = createHash("sha256").update(result.confirmationToken).digest("hex");
    await pool.query(
      `UPDATE registration_confirmations SET "expiresAt" = now() - interval '1 minute' WHERE "tokenHash" = $1`,
      [tokenHash],
    );
    expect(await getRegistrationConfirmation(result.confirmationToken)).toBeNull();
  });
});
