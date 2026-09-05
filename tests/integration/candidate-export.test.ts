import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) throw new Error("TEST_DATABASE_URL wajib untuk integration test export.");
process.env.DATABASE_URL = connectionString;

const pool = new Pool({ connectionString });
const periodId = "82100000-0000-4000-8000-000000000001";
const deptA = "82200000-0000-4000-8000-000000000001";
const studyProgramId = "82300000-0000-4000-8000-000000000001";

let buildCandidateExportCsv: typeof import("@/server/candidates/export").buildCandidateExportCsv;
let disconnectPrismaForTests: typeof import("@/lib/db").disconnectPrismaForTests;

async function insertCandidate(id: string, name: string, status: "SUBMITTED" | "WITHDRAWN"): Promise<void> {
  await pool.query(
    `INSERT INTO candidates
      (id, "periodId", "registrationNumber", name, nim, "normalizedNim", "cohortCode", "entryYear", "className", "studyProgramId", phone, email, "normalizedEmail", domicile, "essayOrgExperience", "essayContribution", "essayBalance", status, "submittedAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $5, 63, 2026, 'Kelas E7', $6, '081200000001', $7, $7, 'Kota Fixture', 'Sintetis', 'Sintetis', 'Sintetis', $8, now(), now())`,
    [id, periodId, `REG-${id.slice(-6)}`, name, `NIM-${id.slice(-6)}`, studyProgramId, `${id}@example.test`, status],
  );
  await pool.query(
    `INSERT INTO candidate_choices (id, "candidateId", "departmentId", rank, motivation, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 'PRIMARY', 'Motivasi sintetis', now(), now())`,
    [randomUUID(), id, deptA],
  );
}

beforeAll(async () => {
  ({ buildCandidateExportCsv } = await import("@/server/candidates/export"));
  ({ disconnectPrismaForTests } = await import("@/lib/db"));

  await pool.query(`
    TRUNCATE TABLE candidate_choices, candidates, study_programs, recruitment_periods, departments RESTART IDENTITY CASCADE
  `);
  await pool.query(
    `INSERT INTO departments (id, code, name, "shortName", "unitType", "sortOrder", "isActive", "configStatus", "createdAt", "updatedAt")
     VALUES ($1, 'EXP-A', 'Birdep Export A', 'A', 'BIRO', 1, true, 'ACTIVE', now(), now())`,
    [deptA],
  );
  await pool.query(
    `INSERT INTO recruitment_periods (id, code, name, status, "configStatus", "cohortCode", "createdAt", "updatedAt")
     VALUES ($1, 'PHASE7-EXP-TEST', 'Periode Sintetis Export', 'OPEN', 'ACTIVE', 63, now(), now())`,
    [periodId],
  );
  await pool.query(
    `INSERT INTO study_programs (id, code, name, "configStatus", "isActive", "createdAt", "updatedAt")
     VALUES ($1, 'PRODI-E7', 'Program Studi Export', 'ACTIVE', true, now(), now())`,
    [studyProgramId],
  );
});

afterAll(async () => {
  await pool.query(`
    TRUNCATE TABLE candidate_choices, candidates, study_programs, recruitment_periods, departments RESTART IDENTITY CASCADE
  `);
  await disconnectPrismaForTests();
  await pool.end();
});

describe("F7-03 export safety", () => {
  it("menghasilkan CSV dengan header, escaping formula, dan mengecualikan WITHDRAWN", async () => {
    const includedId = randomUUID();
    const withdrawnId = randomUUID();
    await insertCandidate(includedId, "=cmd|'/c calc'!A1", "SUBMITTED");
    await insertCandidate(withdrawnId, "Kandidat Mundur", "WITHDRAWN");

    const csv = await buildCandidateExportCsv({ departmentId: deptA, periodId });
    const lines = csv.split("\r\n");

    expect(lines[0]).toContain("Nomor Registrasi");
    expect(lines.some((line) => line.includes("Kandidat Mundur"))).toBe(false);
    const targetLine = lines.find((line) => line.includes("cmd|"));
    expect(targetLine).toBeTruthy();
    expect(targetLine).toContain("'=cmd|");
    expect(csv).not.toContain("object_key");
    expect(csv.toLowerCase()).not.toContain("http://");
    expect(csv.toLowerCase()).not.toContain("https://");
  });

  it("mengembalikan CSV hanya header untuk department tanpa kandidat", async () => {
    const otherDept = randomUUID();
    const csv = await buildCandidateExportCsv({ departmentId: otherDept, periodId });
    expect(csv.split("\r\n")).toHaveLength(1);
  });
});
