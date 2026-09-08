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
const legislativeA = "72000000-0000-4000-8000-000000000004";
const legislativeB = "72000000-0000-4000-8000-000000000005";
// Phase C - "Field Khusus Per Birdep" (ADR-043) fixtures. KOMIT/ADKESMAH
// are EXECUTIVE-track (matches prisma/seed.ts's real data); KOMANGG is
// LEGISLATIVE, same as the other 4 units Phase A introduced.
const komit = "72000000-0000-4000-8000-000000000006";
const adkesmah = "72000000-0000-4000-8000-000000000007";
const komanggar = "72000000-0000-4000-8000-000000000008";
// legislativeB above is coded 'TEST-BADMEDBRND' (a generic legislative
// fixture predating Phase C, used only for track tests) - deliberately
// NOT the exact 'BADMEDBRND' code submit.ts/validation.ts match on, so it
// never triggers Phase C's portfolio requirement. This fixture uses the
// real code for the tests that need that requirement to actually fire.
const badmedbrndReal = "72000000-0000-4000-8000-000000000009";
// "Tambahan Field Khusus Senbud".
const senbud = "72000000-0000-4000-8000-000000000010";
const studyProgramId = "73000000-0000-4000-8000-000000000001";
const motivation = Array.from({ length: 100 }, (_, index) => `alasan${index}`).join(" ");
const pdf = new TextEncoder().encode("%PDF-1.4 synthetic integration fixture");
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
// Phase D - "Portofolio via URL Google Drive" (ADR-045).
const driveUrl = "https://drive.google.com/file/d/synthetic-fixture/view";
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
      registration_confirmations, candidate_locks,
      candidate_supplemental_data, candidate_choices, file_uploads,
      candidates, email_outbox, idempotency_records, audit_logs,
      period_departments, study_programs, recruitment_periods, departments
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
  // Phase A - "Jalur Legislatif": track defaults to EXECUTIVE at the DB
  // level (departments.track has a DEFAULT), so the insert above needs no
  // changes - only these two legislative fixtures set it explicitly.
  await pool.query(
    `INSERT INTO departments
      (id, code, name, "shortName", "unitType", track, "sortOrder", "isActive", "configStatus", "createdAt", "updatedAt")
     VALUES ($1, 'TEST-KOMLEG', 'Komisi Legislasi Test', 'Komleg', 'DEPARTEMEN', 'LEGISLATIVE', 4, true, 'ACTIVE', now(), now()),
            ($2, 'TEST-BADMEDBRND', 'Badan Media dan Branding Test', 'Badmedbrnd', 'BIRO', 'LEGISLATIVE', 5, true, 'ACTIVE', now(), now()),
            ($3, 'KOMANGG', 'Komisi Anggaran Test', 'Komanggar', 'DEPARTEMEN', 'LEGISLATIVE', 6, true, 'ACTIVE', now(), now()),
            ($4, 'BADMEDBRND', 'Badan Media dan Branding Test (real code)', 'Badmedbrnd2', 'BIRO', 'LEGISLATIVE', 9, true, 'ACTIVE', now(), now())`,
    [legislativeA, legislativeB, komanggar, badmedbrndReal],
  );
  // Phase C - "Field Khusus Per Birdep": KOMIT/ADKESMAH stay EXECUTIVE
  // (default), same insert shape as the first departments query above.
  await pool.query(
    `INSERT INTO departments
      (id, code, name, "shortName", "unitType", "sortOrder", "isActive", "configStatus", "createdAt", "updatedAt")
     VALUES ($1, 'KOMIT', 'Biro Kolaborasi dan Kemitraan Test', 'Komit', 'BIRO', 7, true, 'ACTIVE', now(), now()),
            ($2, 'ADKESMAH', 'Advokasi dan Kesejahteraan Mahasiswa Test', 'Adkesmah', 'DEPARTEMEN', 8, true, 'ACTIVE', now(), now()),
            ($3, 'SENBUD', 'Seni dan Budaya Test', 'Senbud', 'DEPARTEMEN', 10, true, 'ACTIVE', now(), now())`,
    [komit, adkesmah, senbud],
  );
  await pool.query(
    `INSERT INTO recruitment_periods
      (id, code, name, status, "configStatus", "cohortCode", "entryYear", "registrationPrefix", "registrationSequence", "opensAt", "closesAt", "choice2Required", "allowUnlock", "consentVersion", "createdAt", "updatedAt")
     VALUES ($1, 'PHASE3-TEST', 'Periode Sintetis Phase 3', 'OPEN', 'ACTIVE', 63, 2026, 'TEST63', 0, now() - interval '1 hour', now() + interval '1 day', true, false, 'DRAFT-CONSENT-TEST', now(), now())`,
    [periodId],
  );
  for (const departmentId of [
    departmentA, departmentB, medbrand, legislativeA, legislativeB,
    komit, adkesmah, komanggar, badmedbrndReal, senbud,
  ]) {
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
      registration_confirmations, candidate_supplemental_data,
      candidate_choices, file_uploads, candidates, email_outbox, idempotency_records,
      audit_logs, period_departments, study_programs, recruitment_periods, departments
    RESTART IDENTITY CASCADE
  `);
  await disconnectPrismaForTests();
  await pool.end();
});

async function upload(
  ownerToken: string,
  kind: "CV" | "PHOTO" | "STUDENT_CARD" | "FOLLOW_EVIDENCE" | "PAYMENT_EVIDENCE" | "SENBUD_INSTAGRAM",
  suffix: string,
): Promise<UploadReference> {
  const isPdf = kind === "CV" || kind === "FOLLOW_EVIDENCE" || kind === "PAYMENT_EVIDENCE";
  const result = await createPrivateUpload({
    periodId,
    ownerToken,
    kind,
    fileName: isPdf ? `${suffix}.pdf` : `${suffix}.png`,
    declaredMimeType: isPdf ? "application/pdf" : "image/png",
    bytes: isPdf ? pdf : png,
    storage,
  });
  return {
    id: result.id,
    // `kind` (the narrow, still-accepted param) not `result.kind` (typed
    // as the full, retired-values-included Prisma UploadKind enum).
    kind,
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
  // Phase C - "Field Khusus Per Birdep" (ADR-043), extended Phase D
  // (ADR-045) with portfolioUrl/budgetPlanUrl - both plain Google Drive
  // URL strings now, not file uploads.
  departmentFields?: {
    komitMbti?: string;
    adkesmahFocus?: "ADVOCACY" | "WELFARE";
    portfolioUrl?: string;
    budgetPlanUrl?: string;
    senbudPortfolioUrl?: string;
  };
  // "Tambahan Field Khusus Senbud": opt-in so non-Senbud tests aren't
  // forced to build an extra upload they never asserted about.
  includeSenbudEvidence?: boolean;
}): Promise<RegistrationPayload> {
  const cv = await upload(input.ownerToken, "CV", `cv-${input.suffix}`);
  const photo = await upload(input.ownerToken, "PHOTO", `photo-${input.suffix}`);
  const followEvidence = await upload(input.ownerToken, "FOLLOW_EVIDENCE", `bukti-${input.suffix}`);
  const paymentEvidence = await upload(input.ownerToken, "PAYMENT_EVIDENCE", `bayar-${input.suffix}`);
  const senbudInstagramEvidence = input.includeSenbudEvidence
    ? await upload(input.ownerToken, "SENBUD_INSTAGRAM", `ig-${input.suffix}`)
    : null;
  return {
    periodId,
    guidebookAcknowledged: true,
    identity: {
      name: `Peserta Sintetis ${input.suffix}`,
      nim: `NIM-${input.suffix}`,
      cohortCode: 63,
      entryYear: 2026,
      className: "Kelas Test",
      studyProgram: "Program Studi Sintetis",
      phone: "081200000000",
      email: `${input.suffix}@example.test`,
      domicile: "Kota Sintetis",
    },
    choices: [
      { departmentId: input.primary ?? departmentA, motivation },
      { departmentId: input.secondary ?? departmentB, motivation },
    ],
    uploads: { cv, photo, studentCard: null, followEvidence, paymentEvidence, senbudInstagramEvidence },
    essays: { organizationExperience: "Sintetis", contribution: "Sintetis", academicBalance: "Sintetis" },
    departmentFields: input.departmentFields ?? {},
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

  it("menolak pendaftaran tanpa bukti follow dan share (wajib untuk semua pendaftar, eksekutif maupun legislatif)", async () => {
    const suffix = `follow-missing-${randomUUID().slice(0, 8)}`;
    const ownerToken = `owner-${suffix}`;
    const payload = await validPayload({ ownerToken, suffix });
    payload.uploads.followEvidence = null;
    await expect(
      submitRegistration({ payload, ownerToken, idempotencyKey: `idem_${randomUUID().replaceAll("-", "")}` }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED", fieldErrors: { "uploads.followEvidence": expect.any(String) } });
  });

  it("menyimpan FileUpload kind FOLLOW_EVIDENCE terhubung ke kandidat setelah submit berhasil", async () => {
    const suffix = `follow-ok-${randomUUID().slice(0, 8)}`;
    const ownerToken = `owner-${suffix}`;
    const payload = await validPayload({ ownerToken, suffix });
    const result = await submitRegistration({ payload, ownerToken, idempotencyKey: `idem_${randomUUID().replaceAll("-", "")}` });
    const row = await pool.query(
      `SELECT f.kind, f.status FROM file_uploads f JOIN candidates c ON c.id = f."candidateId"
       WHERE c."registrationNumber" = $1 AND f.kind = 'FOLLOW_EVIDENCE'`,
      [result.registrationNumber],
    );
    expect(row.rows[0]).toMatchObject({ kind: "FOLLOW_EVIDENCE", status: "FINALIZED" });
  });

  // "Perubahan Sistem Pembayaran" (ADR-048): kode unik dihapus - nominal
  // tetap untuk semua pendaftar, hanya checkbox guidebook dan bukti
  // pembayaran yang masih divalidasi.
  it("menolak pendaftaran tanpa checkbox guidebook atau tanpa bukti pembayaran", async () => {
    const suffix = `payment-missing-${randomUUID().slice(0, 8)}`;
    const ownerToken = `owner-${suffix}`;

    const withoutGuidebook = await validPayload({ ownerToken: `${ownerToken}-a`, suffix: `${suffix}-a` });
    withoutGuidebook.guidebookAcknowledged = false;
    await expect(
      submitRegistration({ payload: withoutGuidebook, ownerToken: `${ownerToken}-a`, idempotencyKey: `idem_${randomUUID().replaceAll("-", "")}` }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED", fieldErrors: { guidebookAcknowledged: expect.any(String) } });

    const withoutEvidence = await validPayload({ ownerToken: `${ownerToken}-c`, suffix: `${suffix}-c` });
    withoutEvidence.uploads.paymentEvidence = null;
    await expect(
      submitRegistration({ payload: withoutEvidence, ownerToken: `${ownerToken}-c`, idempotencyKey: `idem_${randomUUID().replaceAll("-", "")}` }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED", fieldErrors: { "uploads.paymentEvidence": expect.any(String) } });
  });

  it("menyimpan FileUpload kind PAYMENT_EVIDENCE setelah submit berhasil", async () => {
    const suffix = `payment-ok-${randomUUID().slice(0, 8)}`;
    const ownerToken = `owner-${suffix}`;
    const payload = await validPayload({ ownerToken, suffix });
    const result = await submitRegistration({ payload, ownerToken, idempotencyKey: `idem_${randomUUID().replaceAll("-", "")}` });
    const uploadRow = await pool.query(
      `SELECT f.kind, f.status FROM file_uploads f JOIN candidates c ON c.id = f."candidateId"
       WHERE c."registrationNumber" = $1 AND f.kind = 'PAYMENT_EVIDENCE'`,
      [result.registrationNumber],
    );
    expect(uploadRow.rows[0]).toMatchObject({ kind: "PAYMENT_EVIDENCE", status: "FINALIZED" });
  });

  it.each([
    ["Pilihan 1", medbrand, departmentB],
    ["Pilihan 2", departmentA, medbrand],
  ] as const)("menerima Medbrand dengan link Google Drive di %s", async (_, primary, secondary) => {
    const suffix = `med-${randomUUID().slice(0, 8)}`;
    const ownerToken = `owner-${suffix}`;
    const payload = await validPayload({ ownerToken, suffix, primary, secondary, departmentFields: { portfolioUrl: driveUrl } });
    await expect(submitRegistration({ payload, ownerToken, idempotencyKey: `idem_${randomUUID().replaceAll("-", "")}` })).resolves.toMatchObject({ registrationNumber: expect.any(String) });
  });

  it("menyimpan link portofolio Medbrand di candidate_supplemental_data", async () => {
    const suffix = `med-store-${randomUUID().slice(0, 8)}`;
    const ownerToken = `owner-${suffix}`;
    const payload = await validPayload({ ownerToken, suffix, primary: medbrand, departmentFields: { portfolioUrl: driveUrl } });
    const result = await submitRegistration({ payload, ownerToken, idempotencyKey: `idem_${randomUUID().replaceAll("-", "")}` });
    const row = await pool.query(
      `SELECT s."portfolioUrl" FROM candidate_supplemental_data s JOIN candidates c ON c.id = s."candidateId" WHERE c."registrationNumber" = $1`,
      [result.registrationNumber],
    );
    expect(row.rows[0].portfolioUrl).toBe(driveUrl);
  });

  // "Tambahan Field Khusus Senbud".
  it("menolak Senbud tanpa bukti upload Instagram", async () => {
    const suffix = `senbud-missing-${randomUUID().slice(0, 8)}`;
    const ownerToken = `owner-${suffix}`;
    const payload = await validPayload({ ownerToken, suffix, primary: senbud });
    await expect(
      submitRegistration({ payload, ownerToken, idempotencyKey: `idem_${randomUUID().replaceAll("-", "")}` }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED", fieldErrors: { "uploads.senbudInstagramEvidence": expect.any(String) } });
  });

  it("menerima Senbud dengan bukti Instagram, tanpa link portofolio (opsional)", async () => {
    const suffix = `senbud-ok-${randomUUID().slice(0, 8)}`;
    const ownerToken = `owner-${suffix}`;
    const payload = await validPayload({ ownerToken, suffix, primary: senbud, includeSenbudEvidence: true });
    const result = await submitRegistration({ payload, ownerToken, idempotencyKey: `idem_${randomUUID().replaceAll("-", "")}` });
    const uploadRow = await pool.query(
      `SELECT f.kind, f.status FROM file_uploads f JOIN candidates c ON c.id = f."candidateId"
       WHERE c."registrationNumber" = $1 AND f.kind = 'SENBUD_INSTAGRAM'`,
      [result.registrationNumber],
    );
    expect(uploadRow.rows[0]).toMatchObject({ kind: "SENBUD_INSTAGRAM", status: "FINALIZED" });
    const supplementalRow = await pool.query(
      `SELECT s."senbudPortfolioUrl" FROM candidate_supplemental_data s JOIN candidates c ON c.id = s."candidateId" WHERE c."registrationNumber" = $1`,
      [result.registrationNumber],
    );
    expect(supplementalRow.rows[0]).toBeUndefined();
  });

  it("menyimpan link portofolio Senbud di candidate_supplemental_data ketika diisi", async () => {
    const suffix = `senbud-portfolio-${randomUUID().slice(0, 8)}`;
    const ownerToken = `owner-${suffix}`;
    const payload = await validPayload({
      ownerToken, suffix, primary: senbud, includeSenbudEvidence: true,
      departmentFields: { senbudPortfolioUrl: driveUrl },
    });
    const result = await submitRegistration({ payload, ownerToken, idempotencyKey: `idem_${randomUUID().replaceAll("-", "")}` });
    const row = await pool.query(
      `SELECT s."senbudPortfolioUrl" FROM candidate_supplemental_data s JOIN candidates c ON c.id = s."candidateId" WHERE c."registrationNumber" = $1`,
      [result.registrationNumber],
    );
    expect(row.rows[0].senbudPortfolioUrl).toBe(driveUrl);
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

  it("menolak Medbrand tanpa link portofolio Google Drive", async () => {
    const suffix = `missing-${randomUUID().slice(0, 8)}`;
    const ownerToken = `owner-${suffix}`;
    const payload = await validPayload({ ownerToken, suffix, primary: medbrand });
    await expect(
      submitRegistration({ payload, ownerToken, idempotencyKey: `idem_${randomUUID().replaceAll("-", "")}` }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED", fieldErrors: { "departmentFields.portfolioUrl": expect.any(String) } });
  });

  it("menolak Medbrand dengan link bukan Google Drive (authoritative, bukan hanya fast-fail)", async () => {
    const suffix = `nondrive-${randomUUID().slice(0, 8)}`;
    const ownerToken = `owner-${suffix}`;
    const payload = await validPayload({ ownerToken, suffix, primary: medbrand, departmentFields: { portfolioUrl: "https://example.test/portofolio" } });
    await expect(
      submitRegistration({ payload, ownerToken, idempotencyKey: `idem_${randomUUID().replaceAll("-", "")}` }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED", fieldErrors: { "departmentFields.portfolioUrl": expect.any(String) } });
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

  describe("Phase A - jalur legislatif", () => {
    it("menerima pasangan pilihan legislatif-legislatif dan menyimpan track LEGISLATIVE", async () => {
      const suffix = `leg-${randomUUID().slice(0, 8)}`;
      const ownerToken = `owner-${suffix}`;
      const payload = await validPayload({ ownerToken, suffix, primary: legislativeA, secondary: legislativeB });
      payload.track = "LEGISLATIVE";
      const result = await submitRegistration({ payload, ownerToken, idempotencyKey: `idem_${randomUUID().replaceAll("-", "")}` });
      const row = await pool.query(`SELECT track FROM candidates WHERE "registrationNumber" = $1`, [result.registrationNumber]);
      expect(row.rows[0].track).toBe("LEGISLATIVE");
    });

    it("menerima pasangan legislatif-legislatif tanpa field track eksplisit ditolak (default EXECUTIVE tidak cocok)", async () => {
      // Documents the deliberate default: omitting `track` defaults to
      // EXECUTIVE (backward compat for the unmodified form), so a
      // legislative-legislative pair submitted without declaring track is
      // still rejected - caught by validateRegistrationPayload's
      // declared-vs-actual check (fieldErrors.track), which submitRegistration
      // runs before ever reaching submit.ts's own CROSS_TRACK_CHOICE guard.
      const suffix = `leg-notrack-${randomUUID().slice(0, 8)}`;
      const ownerToken = `owner-${suffix}`;
      const payload = await validPayload({ ownerToken, suffix, primary: legislativeA, secondary: legislativeB });
      await expect(
        submitRegistration({ payload, ownerToken, idempotencyKey: `idem_${randomUUID().replaceAll("-", "")}` }),
      ).rejects.toMatchObject({ code: "VALIDATION_FAILED", fieldErrors: { track: expect.any(String) } });
    });

    it("menolak pasangan pilihan lintas jalur (satu eksekutif, satu legislatif)", async () => {
      const suffix = `cross-${randomUUID().slice(0, 8)}`;
      const ownerToken = `owner-${suffix}`;
      const payload = await validPayload({ ownerToken, suffix, primary: departmentA, secondary: legislativeA });
      await expect(
        submitRegistration({ payload, ownerToken, idempotencyKey: `idem_${randomUUID().replaceAll("-", "")}` }),
      ).rejects.toMatchObject({
        code: "VALIDATION_FAILED",
        fieldErrors: { "choices.1.departmentId": expect.any(String) },
      });
    });

    it("menolak field track yang dideklarasikan tidak sesuai jalur Birdep sebenarnya", async () => {
      const suffix = `mismatch-${randomUUID().slice(0, 8)}`;
      const ownerToken = `owner-${suffix}`;
      const payload = await validPayload({ ownerToken, suffix, primary: legislativeA, secondary: legislativeB });
      payload.track = "EXECUTIVE";
      await expect(
        submitRegistration({ payload, ownerToken, idempotencyKey: `idem_${randomUUID().replaceAll("-", "")}` }),
      ).rejects.toMatchObject({ code: "VALIDATION_FAILED", fieldErrors: { track: expect.any(String) } });
    });

    it("submission eksekutif lama tanpa field track tetap berhasil (kompatibel form yang belum diubah)", async () => {
      const suffix = `legacy-${randomUUID().slice(0, 8)}`;
      const ownerToken = `owner-${suffix}`;
      const payload = await validPayload({ ownerToken, suffix });
      expect(payload.track).toBeUndefined();
      const result = await submitRegistration({ payload, ownerToken, idempotencyKey: `idem_${randomUUID().replaceAll("-", "")}` });
      const row = await pool.query(`SELECT track FROM candidates WHERE "registrationNumber" = $1`, [result.registrationNumber]);
      expect(row.rows[0].track).toBe("EXECUTIVE");
    });
  });

  describe("Phase C - field khusus per Birdep", () => {
    it("menolak Komit tanpa MBTI (authoritative, bukan hanya fast-fail)", async () => {
      const suffix = `komit-missing-${randomUUID().slice(0, 8)}`;
      const ownerToken = `owner-${suffix}`;
      const payload = await validPayload({ ownerToken, suffix, primary: komit });
      await expect(
        submitRegistration({ payload, ownerToken, idempotencyKey: `idem_${randomUUID().replaceAll("-", "")}` }),
      ).rejects.toMatchObject({ code: "VALIDATION_FAILED", fieldErrors: { "departmentFields.komitMbti": expect.any(String) } });
    });

    it("menerima Komit dengan MBTI dan menyimpan candidate_supplemental_data ternormalisasi uppercase", async () => {
      const suffix = `komit-ok-${randomUUID().slice(0, 8)}`;
      const ownerToken = `owner-${suffix}`;
      const payload = await validPayload({
        ownerToken, suffix, primary: komit,
        departmentFields: { komitMbti: "intj" },
      });
      const result = await submitRegistration({ payload, ownerToken, idempotencyKey: `idem_${randomUUID().replaceAll("-", "")}` });
      const row = await pool.query(
        `SELECT s."komitMbti", s."adkesmahFocus" FROM candidate_supplemental_data s
         JOIN candidates c ON c.id = s."candidateId" WHERE c."registrationNumber" = $1`,
        [result.registrationNumber],
      );
      expect(row.rows[0]).toMatchObject({ komitMbti: "INTJ", adkesmahFocus: null });
    });

    it("menolak Adkesmah tanpa bidang fokus, menerima dengan salah satunya", async () => {
      const missingSuffix = `adkesmah-missing-${randomUUID().slice(0, 8)}`;
      const missingOwner = `owner-${missingSuffix}`;
      const missingPayload = await validPayload({ ownerToken: missingOwner, suffix: missingSuffix, primary: adkesmah });
      await expect(
        submitRegistration({ payload: missingPayload, ownerToken: missingOwner, idempotencyKey: `idem_${randomUUID().replaceAll("-", "")}` }),
      ).rejects.toMatchObject({ code: "VALIDATION_FAILED", fieldErrors: { "departmentFields.adkesmahFocus": expect.any(String) } });

      const suffix = `adkesmah-ok-${randomUUID().slice(0, 8)}`;
      const ownerToken = `owner-${suffix}`;
      const payload = await validPayload({
        ownerToken, suffix, primary: adkesmah,
        departmentFields: { adkesmahFocus: "WELFARE" },
      });
      const result = await submitRegistration({ payload, ownerToken, idempotencyKey: `idem_${randomUUID().replaceAll("-", "")}` });
      const row = await pool.query(
        `SELECT s."adkesmahFocus" FROM candidate_supplemental_data s
         JOIN candidates c ON c.id = s."candidateId" WHERE c."registrationNumber" = $1`,
        [result.registrationNumber],
      );
      expect(row.rows[0].adkesmahFocus).toBe("WELFARE");
    });

    it("menolak Badan Media dan Branding (legislatif) tanpa link portofolio, menerima dengan link Google Drive", async () => {
      const missingSuffix = `badmedbrnd-missing-${randomUUID().slice(0, 8)}`;
      const missingOwner = `owner-${missingSuffix}`;
      const missingPayload = await validPayload({
        ownerToken: missingOwner, suffix: missingSuffix,
        primary: legislativeA, secondary: badmedbrndReal,
      });
      missingPayload.track = "LEGISLATIVE";
      await expect(
        submitRegistration({ payload: missingPayload, ownerToken: missingOwner, idempotencyKey: `idem_${randomUUID().replaceAll("-", "")}` }),
      ).rejects.toMatchObject({ code: "VALIDATION_FAILED", fieldErrors: { "departmentFields.portfolioUrl": expect.any(String) } });

      const suffix = `badmedbrnd-ok-${randomUUID().slice(0, 8)}`;
      const ownerToken = `owner-${suffix}`;
      const payload = await validPayload({
        ownerToken, suffix,
        primary: legislativeA, secondary: badmedbrndReal,
        departmentFields: { portfolioUrl: driveUrl },
      });
      payload.track = "LEGISLATIVE";
      await expect(
        submitRegistration({ payload, ownerToken, idempotencyKey: `idem_${randomUUID().replaceAll("-", "")}` }),
      ).resolves.toMatchObject({ registrationNumber: expect.any(String) });
    });

    it("menerima Komisi Anggaran tanpa RAB, dan menyimpan link RAB Google Drive saat dilampirkan", async () => {
      const withoutSuffix = `komangg-none-${randomUUID().slice(0, 8)}`;
      const withoutOwner = `owner-${withoutSuffix}`;
      const withoutPayload = await validPayload({
        ownerToken: withoutOwner, suffix: withoutSuffix,
        primary: legislativeA, secondary: komanggar,
      });
      withoutPayload.track = "LEGISLATIVE";
      await expect(
        submitRegistration({ payload: withoutPayload, ownerToken: withoutOwner, idempotencyKey: `idem_${randomUUID().replaceAll("-", "")}` }),
      ).resolves.toMatchObject({ registrationNumber: expect.any(String) });

      const suffix = `komangg-link-${randomUUID().slice(0, 8)}`;
      const ownerToken = `owner-${suffix}`;
      const payload = await validPayload({
        ownerToken, suffix,
        primary: legislativeA, secondary: komanggar,
        departmentFields: { budgetPlanUrl: driveUrl },
      });
      payload.track = "LEGISLATIVE";
      const result = await submitRegistration({ payload, ownerToken, idempotencyKey: `idem_${randomUUID().replaceAll("-", "")}` });
      const row = await pool.query(
        `SELECT s."budgetPlanUrl" FROM candidate_supplemental_data s
         JOIN candidates c ON c.id = s."candidateId" WHERE c."registrationNumber" = $1`,
        [result.registrationNumber],
      );
      expect(row.rows[0].budgetPlanUrl).toBe(driveUrl);
    });

    it("menolak RAB Komisi Anggaran dengan link non-Google-Drive (authoritative)", async () => {
      const suffix = `komangg-baddrive-${randomUUID().slice(0, 8)}`;
      const ownerToken = `owner-${suffix}`;
      const payload = await validPayload({
        ownerToken, suffix,
        primary: legislativeA, secondary: komanggar,
        departmentFields: { budgetPlanUrl: "https://example.test/rab.pdf" },
      });
      payload.track = "LEGISLATIVE";
      await expect(
        submitRegistration({ payload, ownerToken, idempotencyKey: `idem_${randomUUID().replaceAll("-", "")}` }),
      ).rejects.toMatchObject({ code: "VALIDATION_FAILED", fieldErrors: { "departmentFields.budgetPlanUrl": expect.any(String) } });
    });
  });
});
