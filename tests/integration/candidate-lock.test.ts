import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) throw new Error("TEST_DATABASE_URL wajib untuk integration test lock.");
process.env.DATABASE_URL = connectionString;

const pool = new Pool({ connectionString });

const periodId = "91000000-0000-4000-8000-000000000001";
const deptA = "92000000-0000-4000-8000-000000000001";
const deptB = "92000000-0000-4000-8000-000000000002";
const studyProgramId = "93000000-0000-4000-8000-000000000001";
const pjAUserId = "94000000-0000-4000-8000-000000000001";

let lockCandidate: typeof import("@/server/candidates/lock").lockCandidate;
let unlockCandidate: typeof import("@/server/candidates/lock").unlockCandidate;
let CandidateLockError: typeof import("@/server/candidates/lock").CandidateLockError;
let updateCandidatePlacement: typeof import("@/server/candidates/placement").updateCandidatePlacement;
let disconnectPrismaForTests: typeof import("@/lib/db").disconnectPrismaForTests;

function headers(): Headers {
  return new Headers({ "User-Agent": "Phase6Integration/1.0", "X-Forwarded-For": "203.0.113.6" });
}

async function insertCandidate(id: string, departmentId: string): Promise<void> {
  await pool.query(
    `INSERT INTO candidates
      (id, "periodId", "registrationNumber", name, nim, "normalizedNim", "cohortCode", "entryYear", "className", "studyProgram", phone, email, "normalizedEmail", domicile, "essayOrgExperience", "essayContribution", "essayBalance", status, "submittedAt", "updatedAt", track)
     VALUES ($1, $2, $3, 'Kandidat Lock Fixture', $4, $4, 63, 2026, 'Kelas L6', $5, '081200000001', $6, $6, 'Kota Fixture', 'Sintetis', 'Sintetis', 'Sintetis', 'SUBMITTED', now(), now(), 'EXECUTIVE')`,
    [id, periodId, `REG-${id.slice(-6)}`, `NIM-${id.slice(-6)}`, "Program Studi Fixture", `${id}@example.test`],
  );
  await pool.query(
    `INSERT INTO candidate_choices (id, "candidateId", "departmentId", rank, motivation, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 'PRIMARY', 'Motivasi sintetis', now(), now())`,
    [randomUUID(), id, departmentId],
  );
}

async function setPeriod(status: "OPEN" | "CLOSED" | "ARCHIVED", allowUnlock: boolean): Promise<void> {
  await pool.query(`UPDATE recruitment_periods SET status=$1, "allowUnlock"=$2 WHERE id=$3`, [status, allowUnlock, periodId]);
}

beforeAll(async () => {
  ({ lockCandidate, unlockCandidate, CandidateLockError } = await import("@/server/candidates/lock"));
  ({ updateCandidatePlacement } = await import("@/server/candidates/placement"));
  ({ disconnectPrismaForTests } = await import("@/lib/db"));

  await pool.query(`
    TRUNCATE TABLE
      candidate_placements, candidate_locks, candidate_choices, candidates,
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
     VALUES ($1, 'LOCK-A', 'Birdep Lock A', 'A', 'BIRO', 1, true, 'ACTIVE', now(), now()),
            ($2, 'LOCK-B', 'Birdep Lock B', 'B', 'DEPARTEMEN', 2, true, 'ACTIVE', now(), now())`,
    [deptA, deptB],
  );
  await pool.query(
    `INSERT INTO recruitment_periods (id, code, name, status, "configStatus", "cohortCode", "entryYear", "allowUnlock", "createdAt", "updatedAt")
     VALUES ($1, 'PHASE6-TEST', 'Periode Sintetis Phase 6', 'OPEN', 'ACTIVE', 63, 2026, true, now(), now())`,
    [periodId],
  );
  await pool.query(
    `INSERT INTO study_programs (id, code, name, "configStatus", "isActive", "createdAt", "updatedAt")
     VALUES ($1, 'PRODI-P6', 'Program Studi Lock', 'ACTIVE', true, now(), now())`,
    [studyProgramId],
  );
  await pool.query(
    `INSERT INTO users (id, name, email, "emailVerified", role, banned, "isActive", "mustChangePassword", "departmentId", "sessionVersion", "createdAt", "updatedAt")
     VALUES ($1, 'PJ Lock Fixture', $2, true, 'DEPT_PJ', false, true, false, $3, 0, now(), now())`,
    [pjAUserId, `${pjAUserId}@example.test`, deptA],
  );
});

afterAll(async () => {
  await pool.query(`
    TRUNCATE TABLE
      candidate_placements, candidate_locks, candidate_choices, candidates,
      study_programs, recruitment_periods, users, departments, audit_logs, roles
    RESTART IDENTITY CASCADE
  `);
  await disconnectPrismaForTests();
  await pool.end();
});

describe("F6-02 lock authorization", () => {
  it("menolak lock untuk department yang tidak dipilih kandidat", async () => {
    const candidateId = randomUUID();
    await insertCandidate(candidateId, deptA);
    await expect(
      lockCandidate({
        candidateId,
        departmentId: deptB,
        actorUserId: pjAUserId,
        actorName: "PJ Lock Fixture",
        reason: "Percobaan lock lintas Birdep.",
        headers: headers(),
      }),
    ).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND", status: 404 });
  });

  it("menolak lock kedua pada kandidat yang sudah terkunci", async () => {
    const candidateId = randomUUID();
    await insertCandidate(candidateId, deptA);
    await lockCandidate({
      candidateId,
      departmentId: deptA,
      actorUserId: pjAUserId,
      actorName: "PJ Lock Fixture",
      reason: "Lock pertama yang sah.",
      headers: headers(),
    });
    await expect(
      lockCandidate({
        candidateId,
        departmentId: deptA,
        actorUserId: pjAUserId,
        actorName: "PJ Lock Fixture",
        reason: "Percobaan lock kedua.",
        headers: headers(),
      }),
    ).rejects.toThrow(CandidateLockError);
  });

  it("menolak lock saat periode CLOSED atau ARCHIVED, hanya mengizinkan saat OPEN", async () => {
    const candidateId = randomUUID();
    await insertCandidate(candidateId, deptA);

    await setPeriod("CLOSED", true);
    await expect(
      lockCandidate({
        candidateId, departmentId: deptA, actorUserId: pjAUserId, actorName: "PJ",
        reason: "Percobaan lock saat periode closed.", headers: headers(),
      }),
    ).rejects.toMatchObject({ code: "PERIOD_LOCK_WINDOW_CLOSED", status: 409 });

    await setPeriod("ARCHIVED", true);
    await expect(
      lockCandidate({
        candidateId, departmentId: deptA, actorUserId: pjAUserId, actorName: "PJ",
        reason: "Percobaan lock saat periode arsip.", headers: headers(),
      }),
    ).rejects.toMatchObject({ code: "PERIOD_LOCK_WINDOW_CLOSED", status: 409 });

    await setPeriod("OPEN", true);
    const lock = await lockCandidate({
      candidateId, departmentId: deptA, actorUserId: pjAUserId, actorName: "PJ",
      reason: "Lock sah saat periode open.", headers: headers(),
    });
    expect(lock.id).toBeTruthy();
  });
});

describe("F6-01 race 50 lock", () => {
  it("tepat satu sukses, sisanya ditolak dengan status 409, dan tepat satu active row", async () => {
    const candidateId = randomUUID();
    await insertCandidate(candidateId, deptA);

    const attempts = Array.from({ length: 50 }, () =>
      lockCandidate({
        candidateId,
        departmentId: deptA,
        actorUserId: pjAUserId,
        actorName: "PJ Lock Fixture",
        reason: "Race condition lock attempt.",
        headers: headers(),
      }),
    );
    const results = await Promise.allSettled(attempts);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(49);
    for (const result of rejected) {
      if (result.status !== "rejected") continue;
      expect(result.reason).toBeInstanceOf(CandidateLockError);
      expect((result.reason as InstanceType<typeof CandidateLockError>).status).toBe(409);
    }

    const activeLocks = await pool.query(
      `SELECT count(*)::int AS count FROM candidate_locks WHERE "candidateId"=$1 AND "unlockedAt" IS NULL`,
      [candidateId],
    );
    expect(activeLocks.rows[0].count).toBe(1);

    const candidateStatus = await pool.query(`SELECT status FROM candidates WHERE id=$1`, [candidateId]);
    expect(candidateStatus.rows[0].status).toBe("LOCKED");
  }, 30_000);
});

describe("F6-03 unlock, aturan periode, dan audit", () => {
  it("lock membuat placement UNDER_REVIEW dan audit LOCK", async () => {
    const candidateId = randomUUID();
    await insertCandidate(candidateId, deptA);
    await lockCandidate({
      candidateId,
      departmentId: deptA,
      actorUserId: pjAUserId,
      actorName: "PJ Lock Fixture",
      reason: "Kandidat cocok untuk divisi ini.",
      headers: headers(),
    });

    const placement = await pool.query(
      `SELECT status, "departmentId" FROM candidate_placements WHERE "candidateId"=$1`,
      [candidateId],
    );
    expect(placement.rows[0]).toMatchObject({ status: "UNDER_REVIEW", departmentId: deptA });

    const audit = await pool.query(
      `SELECT action FROM audit_logs WHERE "entityType"='CANDIDATE_LOCK' AND "departmentId"=$1 ORDER BY "createdAt" DESC LIMIT 1`,
      [deptA],
    );
    expect(audit.rows[0].action).toBe("LOCK");
  });

  it("menolak unlock ketika allowUnlock=false", async () => {
    const candidateId = randomUUID();
    await insertCandidate(candidateId, deptA);
    await lockCandidate({
      candidateId, departmentId: deptA, actorUserId: pjAUserId, actorName: "PJ",
      reason: "Lock untuk uji allowUnlock.", headers: headers(),
    });
    await setPeriod("OPEN", false);

    await expect(
      unlockCandidate({
        candidateId, departmentId: deptA, actorUserId: pjAUserId,
        reason: "Percobaan unlock saat allowUnlock false.", headers: headers(),
      }),
    ).rejects.toMatchObject({ code: "UNLOCK_NOT_ALLOWED", status: 409 });

    await setPeriod("OPEN", true);
  });

  it("menolak unlock ketika periode ARCHIVED, mengizinkan saat CLOSED", async () => {
    const candidateId = randomUUID();
    await insertCandidate(candidateId, deptA);
    await lockCandidate({
      candidateId, departmentId: deptA, actorUserId: pjAUserId, actorName: "PJ",
      reason: "Lock untuk uji status periode.", headers: headers(),
    });

    await setPeriod("ARCHIVED", true);
    await expect(
      unlockCandidate({
        candidateId, departmentId: deptA, actorUserId: pjAUserId,
        reason: "Percobaan unlock saat periode arsip.", headers: headers(),
      }),
    ).rejects.toMatchObject({ code: "PERIOD_LOCK_WINDOW_CLOSED", status: 409 });

    await setPeriod("CLOSED", true);
    const unlocked = await unlockCandidate({
      candidateId, departmentId: deptA, actorUserId: pjAUserId,
      reason: "Unlock sah saat periode closed.", headers: headers(),
    });
    expect(unlocked).toBe(true);

    const candidateStatus = await pool.query(`SELECT status FROM candidates WHERE id=$1`, [candidateId]);
    expect(candidateStatus.rows[0].status).toBe("SUBMITTED");

    const placementAfter = await pool.query(`SELECT 1 FROM candidate_placements WHERE "candidateId"=$1`, [candidateId]);
    expect(placementAfter.rowCount).toBe(0);

    const audit = await pool.query(
      `SELECT action FROM audit_logs WHERE "entityType"='CANDIDATE_LOCK' AND "departmentId"=$1 ORDER BY "createdAt" DESC LIMIT 1`,
      [deptA],
    );
    expect(audit.rows[0].action).toBe("UNLOCK");

    await setPeriod("OPEN", true);
  });

  it("unlock kedua pada kandidat yang sama mengembalikan false (tidak ada lock aktif)", async () => {
    const candidateId = randomUUID();
    await insertCandidate(candidateId, deptA);
    await lockCandidate({
      candidateId, departmentId: deptA, actorUserId: pjAUserId, actorName: "PJ",
      reason: "Lock untuk uji unlock ganda.", headers: headers(),
    });
    const first = await unlockCandidate({
      candidateId, departmentId: deptA, actorUserId: pjAUserId,
      reason: "Unlock pertama yang sah.", headers: headers(),
    });
    expect(first).toBe(true);

    const second = await unlockCandidate({
      candidateId, departmentId: deptA, actorUserId: pjAUserId,
      reason: "Unlock kedua seharusnya tidak ada efek.", headers: headers(),
    });
    expect(second).toBe(false);
  });
});

describe("placement status", () => {
  it("PJ pemegang lock dapat mengubah status placement", async () => {
    const candidateId = randomUUID();
    await insertCandidate(candidateId, deptA);
    await lockCandidate({
      candidateId, departmentId: deptA, actorUserId: pjAUserId, actorName: "PJ",
      reason: "Lock untuk uji placement.", headers: headers(),
    });

    const placed = await updateCandidatePlacement({
      candidateId, departmentId: deptA, actorUserId: pjAUserId,
      status: "PLACED", mentorLabel: "Mentor Fixture", headers: headers(),
    });
    expect(placed?.status).toBe("PLACED");
    expect(placed?.mentorLabel).toBe("Mentor Fixture");
    expect(placed?.placedAt).not.toBeNull();
  });

  it("menolak update placement dari department yang tidak memegang lock", async () => {
    const candidateId = randomUUID();
    await insertCandidate(candidateId, deptA);
    await lockCandidate({
      candidateId, departmentId: deptA, actorUserId: pjAUserId, actorName: "PJ",
      reason: "Lock untuk uji isolasi placement.", headers: headers(),
    });

    const result = await updateCandidatePlacement({
      candidateId, departmentId: deptB, actorUserId: pjAUserId,
      status: "PLACED", headers: headers(),
    });
    expect(result).toBeNull();
  });

  it("menolak update placement setelah unlock", async () => {
    const candidateId = randomUUID();
    await insertCandidate(candidateId, deptA);
    await lockCandidate({
      candidateId, departmentId: deptA, actorUserId: pjAUserId, actorName: "PJ",
      reason: "Lock untuk uji placement setelah unlock.", headers: headers(),
    });
    await unlockCandidate({
      candidateId, departmentId: deptA, actorUserId: pjAUserId,
      reason: "Unlock sebelum placement update.", headers: headers(),
    });

    const result = await updateCandidatePlacement({
      candidateId, departmentId: deptA, actorUserId: pjAUserId,
      status: "PLACED", headers: headers(),
    });
    expect(result).toBeNull();
  });
});
