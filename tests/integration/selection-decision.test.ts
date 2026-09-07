import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) throw new Error("TEST_DATABASE_URL wajib untuk integration test selection decision.");
process.env.DATABASE_URL = connectionString;

const pool = new Pool({ connectionString });

const periodId = "a1000000-0000-4000-8000-000000000001";
const deptP1 = "a2000000-0000-4000-8000-000000000001";
const deptP2 = "a2000000-0000-4000-8000-000000000002";
const deptC = "a2000000-0000-4000-8000-000000000003";
const studyProgramId = "a3000000-0000-4000-8000-000000000001";
const p1UserId = "a4000000-0000-4000-8000-000000000001";
const p2UserId = "a4000000-0000-4000-8000-000000000002";
const superAdminUserId = "a4000000-0000-4000-8000-000000000003";

let takeCandidate: typeof import("@/server/candidates/selection").takeCandidate;
let markHesitant: typeof import("@/server/candidates/selection").markHesitant;
let forwardToSecondary: typeof import("@/server/candidates/selection").forwardToSecondary;
let eliminateCandidate: typeof import("@/server/candidates/selection").eliminateCandidate;
let adminResetSelection: typeof import("@/server/candidates/selection").adminResetSelection;
let restoreEliminatedCandidate: typeof import("@/server/candidates/selection").restoreEliminatedCandidate;
let ensureSelectionDecision: typeof import("@/server/candidates/selection").ensureSelectionDecision;
let SelectionDecisionError: typeof import("@/server/candidates/selection").SelectionDecisionError;
let prisma: typeof import("@/lib/db").prisma;
let disconnectPrismaForTests: typeof import("@/lib/db").disconnectPrismaForTests;

function headers(): Headers {
  return new Headers({ "User-Agent": "SelectionIntegration/1.0", "X-Forwarded-For": "203.0.113.9" });
}

// "Guidebook, ketentuan, dan pembayaran": periodId+paymentCode is unique -
// a module-level counter gives every insertCandidate() call in this file
// a distinct code regardless of how many share this file's one periodId.
let paymentCodeCounter = 0;

async function insertCandidate(id: string, name = "Kandidat Seleksi"): Promise<void> {
  paymentCodeCounter += 1;
  const paymentCode = String(paymentCodeCounter).padStart(3, "0");
  await pool.query(
    `INSERT INTO candidates
      (id, "periodId", "registrationNumber", name, nim, "normalizedNim", "cohortCode", "entryYear", "className", "studyProgram", phone, email, "normalizedEmail", domicile, "essayOrgExperience", "essayContribution", "essayBalance", status, "submittedAt", "updatedAt", track, "paymentCode", "paymentAmount")
     VALUES ($1, $2, $3, $4, $5, $5, 63, 2026, 'Kelas S1', $6, '081200000002', $7, $7, 'Kota Fixture', 'Sintetis', 'Sintetis', 'Sintetis', 'SUBMITTED', now(), now(), 'EXECUTIVE', $8, $9)`,
    [id, periodId, `REG-${id.slice(-6)}`, name, `NIM-${id.slice(-6)}`, "Program Studi Fixture", `${id}@example.test`, paymentCode, 15000 + Number(paymentCode)],
  );
  await pool.query(
    `INSERT INTO candidate_choices (id, "candidateId", "departmentId", rank, motivation, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 'PRIMARY', 'Motivasi sintetis P1', now(), now())`,
    [randomUUID(), id, deptP1],
  );
  await pool.query(
    `INSERT INTO candidate_choices (id, "candidateId", "departmentId", rank, motivation, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 'SECONDARY', 'Motivasi sintetis P2', now(), now())`,
    [randomUUID(), id, deptP2],
  );
  await ensureSelectionDecision(prisma, {
    candidateId: id,
    periodId,
    primaryDeptId: deptP1,
    secondaryDeptId: deptP2,
  });
}

async function decisionRow(candidateId: string) {
  const result = await pool.query(`SELECT * FROM selection_decisions WHERE "candidateId"=$1`, [candidateId]);
  return result.rows[0] as
    | {
        status: string;
        decidedbyp1userid?: string;
        decidedByP1UserId?: string;
        decidedByP2UserId?: string;
      }
    | undefined;
}

beforeAll(async () => {
  ({
    takeCandidate,
    markHesitant,
    forwardToSecondary,
    eliminateCandidate,
    adminResetSelection,
    restoreEliminatedCandidate,
    ensureSelectionDecision,
    SelectionDecisionError,
  } = await import("@/server/candidates/selection"));
  ({ prisma, disconnectPrismaForTests } = await import("@/lib/db"));

  await pool.query(`
    TRUNCATE TABLE
      email_outbox, selection_decisions, candidate_locks, candidate_choices, candidates,
      study_programs, recruitment_periods, users, departments, audit_logs, roles
    RESTART IDENTITY CASCADE
  `);
  await pool.query(`
    INSERT INTO roles (code, name, description, "isSystem", "createdAt", "updatedAt")
    VALUES ('SUPER_ADMIN', 'Super Admin', 'Fixture', true, now(), now()),
           ('DEPT_PJ', 'PJ', 'Fixture', true, now(), now())
  `);
  await pool.query(
    `INSERT INTO departments (id, code, name, "shortName", "unitType", "sortOrder", "isActive", "configStatus", "createdAt", "updatedAt")
     VALUES ($1, 'SEL-P1', 'Birdep Pilihan Satu', 'P1', 'BIRO', 1, true, 'ACTIVE', now(), now()),
            ($2, 'SEL-P2', 'Birdep Pilihan Dua', 'P2', 'DEPARTEMEN', 2, true, 'ACTIVE', now(), now()),
            ($3, 'SEL-C', 'Birdep Tak Terkait', 'C', 'BIRO', 3, true, 'ACTIVE', now(), now())`,
    [deptP1, deptP2, deptC],
  );
  await pool.query(
    `INSERT INTO recruitment_periods (id, code, name, status, "configStatus", "cohortCode", "entryYear", "allowUnlock", "createdAt", "updatedAt")
     VALUES ($1, 'SELECTION-TEST', 'Periode Sintetis Seleksi', 'OPEN', 'ACTIVE', 63, 2026, true, now(), now())`,
    [periodId],
  );
  await pool.query(
    `INSERT INTO study_programs (id, code, name, "configStatus", "isActive", "createdAt", "updatedAt")
     VALUES ($1, 'PRODI-SEL', 'Program Studi Seleksi', 'ACTIVE', true, now(), now())`,
    [studyProgramId],
  );
  for (const [id, departmentId] of [
    [p1UserId, deptP1],
    [p2UserId, deptP2],
  ] as const) {
    await pool.query(
      `INSERT INTO users (id, name, email, "emailVerified", role, banned, "isActive", "mustChangePassword", "departmentId", "sessionVersion", "createdAt", "updatedAt")
       VALUES ($1, 'PJ Seleksi Fixture', $2, true, 'DEPT_PJ', false, true, false, $3, 0, now(), now())`,
      [id, `${id}@example.test`, departmentId],
    );
  }
  await pool.query(
    `INSERT INTO users (id, name, email, "emailVerified", role, banned, "isActive", "mustChangePassword", "sessionVersion", "createdAt", "updatedAt")
     VALUES ($1, 'Super Admin Fixture', $2, true, 'SUPER_ADMIN', false, true, false, 0, now(), now())`,
    [superAdminUserId, `${superAdminUserId}@example.test`],
  );
});

afterEach(async () => {
  // Individual tests each insert their own candidate(s); wipe between
  // tests so state machine assertions never leak across `it` blocks.
  await pool.query(`TRUNCATE TABLE email_outbox, selection_decisions, candidate_choices, candidates RESTART IDENTITY CASCADE`);
});

afterAll(async () => {
  await pool.query(`
    TRUNCATE TABLE
      email_outbox, selection_decisions, candidate_locks, candidate_choices, candidates,
      study_programs, recruitment_periods, users, departments, audit_logs, roles
    RESTART IDENTITY CASCADE
  `);
  await disconnectPrismaForTests();
  await pool.end();
});

describe("SEL-01 state machine P1", () => {
  it("PENDING -> TAKEN lewat take(), lalu take() kedua ditolak", async () => {
    const candidateId = randomUUID();
    await insertCandidate(candidateId);

    const result = await takeCandidate({
      candidateId, departmentId: deptP1, actorUserId: p1UserId,
      reason: "Kandidat sangat cocok.", headers: headers(),
    });
    expect(result.status).toBe("TAKEN");
    expect(result.decidedByP1UserId).toBe(p1UserId);

    await expect(
      takeCandidate({ candidateId, departmentId: deptP1, actorUserId: p1UserId, headers: headers() }),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION", status: 409 });
  });

  it("PENDING -> HESITANT_P1 -> TAKEN valid", async () => {
    const candidateId = randomUUID();
    await insertCandidate(candidateId);

    await markHesitant({ candidateId, departmentId: deptP1, actorUserId: p1UserId, headers: headers() });
    const row = await decisionRow(candidateId);
    expect(row?.status).toBe("HESITANT_P1");

    const taken = await takeCandidate({ candidateId, departmentId: deptP1, actorUserId: p1UserId, headers: headers() });
    expect(taken.status).toBe("TAKEN");
  });

  it("P1 tidak bisa aksi lagi setelah FORWARDED (menutup celah override sepihak)", async () => {
    const candidateId = randomUUID();
    await insertCandidate(candidateId);
    await forwardToSecondary({ candidateId, departmentId: deptP1, actorUserId: p1UserId, headers: headers() });

    await expect(
      takeCandidate({ candidateId, departmentId: deptP1, actorUserId: p1UserId, headers: headers() }),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION", status: 409 });
  });
});

describe("SEL-02 resolusi peran dan enumerasi", () => {
  it("Birdep yang bukan Pilihan 1/2 mendapat 404 (bukan 403)", async () => {
    const candidateId = randomUUID();
    await insertCandidate(candidateId);

    await expect(
      takeCandidate({ candidateId, departmentId: deptC, actorUserId: p1UserId, headers: headers() }),
    ).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND", status: 404 });
  });

  it("PJ Pilihan 2 tidak bisa forward (aksi khusus P1)", async () => {
    const candidateId = randomUUID();
    await insertCandidate(candidateId);

    await expect(
      forwardToSecondary({ candidateId, departmentId: deptP2, actorUserId: p2UserId, headers: headers() }),
    ).rejects.toMatchObject({ code: "WRONG_SIDE", status: 403 });
  });
});

describe("SEL-03 alihkan ke Pilihan 2, notifikasi email, dan aksi P2", () => {
  it("forward mengirim EmailOutbox SELECTION_FORWARDED ke PJ Pilihan 2", async () => {
    const candidateId = randomUUID();
    await insertCandidate(candidateId);

    const result = await forwardToSecondary({
      candidateId, departmentId: deptP1, actorUserId: p1UserId,
      reason: "Tidak sesuai kebutuhan kami.", headers: headers(),
    });
    expect(result.status).toBe("FORWARDED");

    const outbox = await pool.query(`SELECT type, "idempotencyKey" FROM email_outbox WHERE type='SELECTION_FORWARDED'`);
    expect(outbox.rows).toHaveLength(1);
    expect(outbox.rows[0].idempotencyKey).toBe(`selection-forwarded:${result.id}:${p2UserId}`);
  });

  it("P2 tidak bisa aksi selama PENDING (belum dialihkan)", async () => {
    const candidateId = randomUUID();
    await insertCandidate(candidateId);

    await expect(
      takeCandidate({ candidateId, departmentId: deptP2, actorUserId: p2UserId, headers: headers() }),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION", status: 409 });
  });

  it("P2 tidak bisa aksi selama HESITANT_P1 (belum dialihkan)", async () => {
    const candidateId = randomUUID();
    await insertCandidate(candidateId);
    await markHesitant({ candidateId, departmentId: deptP1, actorUserId: p1UserId, headers: headers() });

    await expect(
      eliminateCandidate({ candidateId, departmentId: deptP2, actorUserId: p2UserId, headers: headers() }),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION", status: 409 });
  });

  it("FORWARDED -> TAKEN_P2 lewat take() milik P2", async () => {
    const candidateId = randomUUID();
    await insertCandidate(candidateId);
    await forwardToSecondary({ candidateId, departmentId: deptP1, actorUserId: p1UserId, headers: headers() });

    const result = await takeCandidate({ candidateId, departmentId: deptP2, actorUserId: p2UserId, headers: headers() });
    expect(result.status).toBe("TAKEN_P2");
    expect(result.decidedByP2UserId).toBe(p2UserId);
  });

  it("FORWARDED -> HESITANT_P2 lewat hesitant() milik P2", async () => {
    const candidateId = randomUUID();
    await insertCandidate(candidateId);
    await forwardToSecondary({ candidateId, departmentId: deptP1, actorUserId: p1UserId, headers: headers() });

    const result = await markHesitant({ candidateId, departmentId: deptP2, actorUserId: p2UserId, headers: headers() });
    expect(result.status).toBe("HESITANT_P2");
  });

  it("FORWARDED -> ELIMINATED lewat eliminate(), dan soft-delete kandidat", async () => {
    const candidateId = randomUUID();
    await insertCandidate(candidateId);
    await forwardToSecondary({ candidateId, departmentId: deptP1, actorUserId: p1UserId, headers: headers() });

    const result = await eliminateCandidate({
      candidateId, departmentId: deptP2, actorUserId: p2UserId,
      reason: "Tidak memenuhi kriteria.", headers: headers(),
    });
    expect(result.status).toBe("ELIMINATED");

    const candidateRow = await pool.query(`SELECT "deletedAt" FROM candidates WHERE id=$1`, [candidateId]);
    expect(candidateRow.rows[0].deletedAt).not.toBeNull();
  });

  it("Gugurkan ditolak jika kandidat sudah TAKEN oleh Pilihan 1 (belum/tidak pernah dialihkan)", async () => {
    const candidateId = randomUUID();
    await insertCandidate(candidateId);
    await takeCandidate({ candidateId, departmentId: deptP1, actorUserId: p1UserId, headers: headers() });

    await expect(
      eliminateCandidate({ candidateId, departmentId: deptP2, actorUserId: p2UserId, headers: headers() }),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION", status: 409 });
  });
});

describe("SEL-04 race condition 50 take() bersamaan", () => {
  it("tepat satu sukses, sisanya 409, dan tepat satu baris TAKEN", async () => {
    const candidateId = randomUUID();
    await insertCandidate(candidateId);

    const attempts = Array.from({ length: 50 }, () =>
      takeCandidate({ candidateId, departmentId: deptP1, actorUserId: p1UserId, headers: headers() }),
    );
    const results = await Promise.allSettled(attempts);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(49);
    for (const result of rejected) {
      if (result.status !== "rejected") continue;
      expect(result.reason).toBeInstanceOf(SelectionDecisionError);
      expect((result.reason as InstanceType<typeof SelectionDecisionError>).status).toBe(409);
    }

    const takenRows = await pool.query(
      `SELECT count(*)::int AS count FROM selection_decisions WHERE "candidateId"=$1 AND status='TAKEN'`,
      [candidateId],
    );
    expect(takenRows.rows[0].count).toBe(1);
  }, 30_000);
});

describe("SEL-05 audit log", () => {
  it("setiap transisi PJ tercatat di audit_logs dengan entityType SELECTION_DECISION", async () => {
    const candidateId = randomUUID();
    await insertCandidate(candidateId);
    const result = await takeCandidate({
      candidateId, departmentId: deptP1, actorUserId: p1UserId,
      reason: "Alasan audit.", headers: headers(),
    });

    const audit = await pool.query(
      `SELECT action, "departmentId", reason FROM audit_logs WHERE "entityType"='SELECTION_DECISION' AND "entityId"=$1 ORDER BY "createdAt" DESC LIMIT 1`,
      [result.id],
    );
    expect(audit.rows[0]).toMatchObject({ action: "SELECTION_TAKE", departmentId: deptP1, reason: "Alasan audit." });
  });
});

describe("SEL-06 kewenangan Super Admin", () => {
  it("reset mengembalikan status ke PENDING dan mengosongkan field keputusan", async () => {
    const candidateId = randomUUID();
    await insertCandidate(candidateId);
    await takeCandidate({ candidateId, departmentId: deptP1, actorUserId: p1UserId, reason: "Diambil dulu.", headers: headers() });

    const reset = await adminResetSelection({
      candidateId, actorUserId: superAdminUserId, reason: "Keputusan keliru, ditarik kembali.", headers: headers(),
    });
    expect(reset.status).toBe("PENDING");
    expect(reset.decidedByP1UserId).toBeNull();
    expect(reset.overrideByAdminId).toBe(superAdminUserId);

    const audit = await pool.query(
      `SELECT action FROM audit_logs WHERE "entityType"='SELECTION_DECISION' AND "entityId"=$1 ORDER BY "createdAt" DESC LIMIT 1`,
      [reset.id],
    );
    expect(audit.rows[0].action).toBe("SELECTION_RESET");
  });

  it("restore mengembalikan kandidat ELIMINATED (deletedAt cleared + status PENDING)", async () => {
    const candidateId = randomUUID();
    await insertCandidate(candidateId);
    await forwardToSecondary({ candidateId, departmentId: deptP1, actorUserId: p1UserId, headers: headers() });
    await eliminateCandidate({ candidateId, departmentId: deptP2, actorUserId: p2UserId, reason: "Tidak sesuai.", headers: headers() });

    const restored = await restoreEliminatedCandidate({
      candidateId, actorUserId: superAdminUserId, reason: "Perlu ditinjau ulang.", headers: headers(),
    });
    expect(restored.status).toBe("PENDING");

    const candidateRow = await pool.query(`SELECT "deletedAt" FROM candidates WHERE id=$1`, [candidateId]);
    expect(candidateRow.rows[0].deletedAt).toBeNull();
  });

  it("restore ditolak untuk kandidat yang tidak dalam status ELIMINATED", async () => {
    const candidateId = randomUUID();
    await insertCandidate(candidateId);

    await expect(
      restoreEliminatedCandidate({ candidateId, actorUserId: superAdminUserId, reason: "Percobaan tidak sah.", headers: headers() }),
    ).rejects.toMatchObject({ code: "NOT_ELIMINATED", status: 409 });
  });
});

describe("SEL-07 ensureSelectionDecision idempoten", () => {
  it("memanggil ulang tidak mengubah status yang sudah berjalan", async () => {
    const candidateId = randomUUID();
    await insertCandidate(candidateId);
    await takeCandidate({ candidateId, departmentId: deptP1, actorUserId: p1UserId, headers: headers() });

    await ensureSelectionDecision(prisma, {
      candidateId, periodId, primaryDeptId: deptP1, secondaryDeptId: deptP2,
    });

    const row = await decisionRow(candidateId);
    expect(row?.status).toBe("TAKEN");
  });
});
