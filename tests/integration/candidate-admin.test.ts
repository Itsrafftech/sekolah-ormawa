import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) throw new Error("TEST_DATABASE_URL wajib untuk integration test candidate admin.");
process.env.DATABASE_URL = connectionString;

const pool = new Pool({ connectionString });
const periodId = "81100000-0000-4000-8000-000000000001";
const deptA = "81200000-0000-4000-8000-000000000001";
const studyProgramId = "81300000-0000-4000-8000-000000000001";
const pjAUserId = "81400000-0000-4000-8000-000000000001";
const superAdminId = "81400000-0000-4000-8000-000000000002";

let lockCandidate: typeof import("@/server/candidates/lock").lockCandidate;
let overrideUnlockCandidate: typeof import("@/server/candidates/lock").overrideUnlockCandidate;
let listAllLockedCandidates: typeof import("@/server/admin/candidate-admin").listAllLockedCandidates;
let listDeletedCandidates: typeof import("@/server/admin/candidate-admin").listDeletedCandidates;
let softDeleteCandidate: typeof import("@/server/admin/candidate-admin").softDeleteCandidate;
let restoreCandidate: typeof import("@/server/admin/candidate-admin").restoreCandidate;
let CandidateAdminError: typeof import("@/server/admin/candidate-admin").CandidateAdminError;
let disconnectPrismaForTests: typeof import("@/lib/db").disconnectPrismaForTests;

function headers(): Headers {
  return new Headers({ "User-Agent": "Phase7Integration/1.0", "X-Forwarded-For": "203.0.113.9" });
}

async function insertCandidate(id: string): Promise<void> {
  await pool.query(
    `INSERT INTO candidates
      (id, "periodId", "registrationNumber", name, nim, "normalizedNim", "cohortCode", "entryYear", "className", "studyProgramId", phone, email, "normalizedEmail", domicile, "essayOrgExperience", "essayContribution", "essayBalance", status, "submittedAt", "updatedAt", track)
     VALUES ($1, $2, $3, 'Kandidat Admin Fixture', $4, $4, 63, 2026, 'Kelas A7', $5, '081200000001', $6, $6, 'Kota Fixture', 'Sintetis', 'Sintetis', 'Sintetis', 'SUBMITTED', now(), now(), 'EXECUTIVE')`,
    [id, periodId, `REG-${id.slice(-6)}`, `NIM-${id.slice(-6)}`, studyProgramId, `${id}@example.test`],
  );
  await pool.query(
    `INSERT INTO candidate_choices (id, "candidateId", "departmentId", rank, motivation, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 'PRIMARY', 'Motivasi sintetis', now(), now())`,
    [randomUUID(), id, deptA],
  );
}

beforeAll(async () => {
  ({ lockCandidate, overrideUnlockCandidate } = await import("@/server/candidates/lock"));
  ({ listAllLockedCandidates, listDeletedCandidates, softDeleteCandidate, restoreCandidate, CandidateAdminError } =
    await import("@/server/admin/candidate-admin"));
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
     VALUES ($1, 'ADM-A', 'Birdep Admin A', 'A', 'BIRO', 1, true, 'ACTIVE', now(), now())`,
    [deptA],
  );
  await pool.query(
    `INSERT INTO recruitment_periods (id, code, name, status, "configStatus", "cohortCode", "allowUnlock", "createdAt", "updatedAt")
     VALUES ($1, 'PHASE7-ADM-TEST', 'Periode Sintetis Phase 7 Admin', 'OPEN', 'ACTIVE', 63, false, now(), now())`,
    [periodId],
  );
  await pool.query(
    `INSERT INTO study_programs (id, code, name, "configStatus", "isActive", "createdAt", "updatedAt")
     VALUES ($1, 'PRODI-A7', 'Program Studi Admin', 'ACTIVE', true, now(), now())`,
    [studyProgramId],
  );
  await pool.query(
    `INSERT INTO users (id, name, email, "emailVerified", role, banned, "isActive", "mustChangePassword", "departmentId", "sessionVersion", "createdAt", "updatedAt")
     VALUES ($1, 'PJ Admin Fixture', $2, true, 'DEPT_PJ', false, true, false, $3, 0, now(), now())`,
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

describe("override lock lintas-Birdep", () => {
  it("Super Admin bisa override-unlock meski allowUnlock=false dan periode tidak OPEN/CLOSED", async () => {
    const candidateId = randomUUID();
    await insertCandidate(candidateId);
    await lockCandidate({
      candidateId, departmentId: deptA, actorUserId: pjAUserId, actorName: "PJ",
      reason: "Lock untuk uji override.", headers: headers(),
    });

    const beforeList = await listAllLockedCandidates();
    expect(beforeList.some((item) => item.candidateId === candidateId)).toBe(true);

    await pool.query(`UPDATE recruitment_periods SET status='ARCHIVED', "allowUnlock"=false WHERE id=$1`, [periodId]);

    const overridden = await overrideUnlockCandidate({
      candidateId, actorUserId: superAdminId, reason: "Koreksi administratif override.", headers: headers(),
    });
    expect(overridden).toBe(true);

    const status = await pool.query(`SELECT status FROM candidates WHERE id=$1`, [candidateId]);
    expect(status.rows[0].status).toBe("SUBMITTED");

    const audit = await pool.query(
      `SELECT action FROM audit_logs WHERE "entityType"='CANDIDATE_LOCK' AND "departmentId"=$1 ORDER BY "createdAt" DESC LIMIT 1`,
      [deptA],
    );
    expect(audit.rows[0].action).toBe("OVERRIDE");

    const afterList = await listAllLockedCandidates();
    expect(afterList.some((item) => item.candidateId === candidateId)).toBe(false);

    await pool.query(`UPDATE recruitment_periods SET status='OPEN', "allowUnlock"=true WHERE id=$1`, [periodId]);
  });

  it("override-unlock mengembalikan false untuk kandidat yang tidak sedang terkunci", async () => {
    const candidateId = randomUUID();
    await insertCandidate(candidateId);
    const overridden = await overrideUnlockCandidate({
      candidateId, actorUserId: superAdminId, reason: "Percobaan override tanpa lock.", headers: headers(),
    });
    expect(overridden).toBe(false);
  });
});

describe("soft delete dan restore kandidat", () => {
  it("menolak soft-delete kandidat yang sedang terkunci", async () => {
    const candidateId = randomUUID();
    await insertCandidate(candidateId);
    await lockCandidate({
      candidateId, departmentId: deptA, actorUserId: pjAUserId, actorName: "PJ",
      reason: "Lock sebelum percobaan hapus.", headers: headers(),
    });

    await expect(
      softDeleteCandidate({ candidateId, actorUserId: superAdminId, headers: headers() }),
    ).rejects.toBeInstanceOf(CandidateAdminError);
    await expect(
      softDeleteCandidate({ candidateId, actorUserId: superAdminId, headers: headers() }),
    ).rejects.toMatchObject({ code: "CANDIDATE_LOCKED", status: 409 });
  });

  it("soft-delete dan restore berjalan serta tercatat audit, dan hilang/muncul di listDeletedCandidates", async () => {
    const candidateId = randomUUID();
    await insertCandidate(candidateId);

    const deletedOk = await softDeleteCandidate({ candidateId, actorUserId: superAdminId, headers: headers() });
    expect(deletedOk).toBe(true);

    const deletedList = await listDeletedCandidates();
    expect(deletedList.some((item) => item.id === candidateId)).toBe(true);

    const auditDelete = await pool.query(
      `SELECT action FROM audit_logs WHERE "entityType"='CANDIDATE' AND "entityId"=$1 ORDER BY "createdAt" ASC`,
      [candidateId],
    );
    expect(auditDelete.rows.map((row) => row.action)).toContain("SOFT_DELETE");

    const restored = await restoreCandidate({ candidateId, actorUserId: superAdminId, headers: headers() });
    expect(restored).toBe(true);

    const deletedListAfter = await listDeletedCandidates();
    expect(deletedListAfter.some((item) => item.id === candidateId)).toBe(false);

    const auditRestore = await pool.query(
      `SELECT action FROM audit_logs WHERE "entityType"='CANDIDATE' AND "entityId"=$1 ORDER BY "createdAt" ASC`,
      [candidateId],
    );
    expect(auditRestore.rows.map((row) => row.action)).toContain("RESTORE");
  });

  it("softDeleteCandidate/restoreCandidate mengembalikan false untuk id yang tidak sesuai", async () => {
    const missing = await softDeleteCandidate({ candidateId: randomUUID(), actorUserId: superAdminId, headers: headers() });
    expect(missing).toBe(false);

    const missingRestore = await restoreCandidate({ candidateId: randomUUID(), actorUserId: superAdminId, headers: headers() });
    expect(missingRestore).toBe(false);
  });
});
