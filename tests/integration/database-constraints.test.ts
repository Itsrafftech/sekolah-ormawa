import { randomUUID } from "node:crypto";

import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const connectionString = process.env.TEST_DATABASE_URL;

if (!connectionString) {
  throw new Error("TEST_DATABASE_URL wajib untuk integration test.");
}

const pool = new Pool({ connectionString });

async function expectConstraintViolation(
  operation: () => Promise<unknown>,
  expectedCode: "23505" | "23514",
) {
  try {
    await operation();
    throw new Error("Operasi seharusnya ditolak oleh constraint database.");
  } catch (error) {
    expect(error).toMatchObject({ code: expectedCode });
  }
}

async function insertFoundation(client: PoolClient) {
  const departmentA = randomUUID();
  const departmentB = randomUUID();
  const periodId = randomUUID();
  const studyProgramId = randomUUID();

  await client.query(
    `INSERT INTO roles (code, name, description, "isSystem", "createdAt", "updatedAt")
     VALUES ('SUPER_ADMIN', 'Super Admin', 'Fixture', true, now(), now()),
            ('DEPT_PJ', 'PJ', 'Fixture', true, now(), now())`,
  );

  await client.query(
    `INSERT INTO departments
      (id, code, name, "shortName", "unitType", "sortOrder", "isActive", "configStatus", "createdAt", "updatedAt")
     VALUES ($1, 'DEPT-A', 'Department A', 'A', 'BIRO', 1, true, 'DRAFT', now(), now()),
            ($2, 'DEPT-B', 'Department B', 'B', 'BIRO', 2, true, 'DRAFT', now(), now())`,
    [departmentA, departmentB],
  );

  await client.query(
    `INSERT INTO recruitment_periods
      (id, code, name, status, "configStatus", "cohortCode", "registrationSequence", "choice2Required", "allowUnlock", "createdAt", "updatedAt")
     VALUES ($1, 'TEST-PERIOD', 'Periode Test', 'DRAFT', 'DRAFT', 63, 0, true, false, now(), now())`,
    [periodId],
  );

  await client.query(
    `INSERT INTO study_programs
      (id, code, name, "configStatus", "isActive", "createdAt", "updatedAt")
     VALUES ($1, 'TEST-PRODI', 'Prodi Test', 'DRAFT', false, now(), now())`,
    [studyProgramId],
  );

  return { departmentA, departmentB, periodId, studyProgramId };
}

async function insertCandidate(
  client: PoolClient,
  fixture: Awaited<ReturnType<typeof insertFoundation>>,
  overrides: { normalizedNim?: string; normalizedEmail?: string; gpa?: number } = {},
) {
  const candidateId = randomUUID();

  await client.query(
    `INSERT INTO candidates
      (id, "periodId", name, nim, "normalizedNim", "cohortCode", "className", "studyProgramId", phone, email, "normalizedEmail", gpa, domicile, "essayOrgExperience", "essayContribution", "essayBalance", status, "submittedAt", "updatedAt", version)
     VALUES ($1, $2, 'Kandidat Fixture', 'I-FIXTURE', $3, 63, 'A', $4, '+628000000000', 'fixture@example.test', $5, $6, 'Bogor', 'Fixture', 'Fixture', 'Fixture', 'SUBMITTED', now(), now(), 0)`,
    [
      candidateId,
      fixture.periodId,
      overrides.normalizedNim ?? `NIM-${candidateId}`,
      fixture.studyProgramId,
      overrides.normalizedEmail ?? `${candidateId}@example.test`,
      // No default fake gpa (IPK removed from the product - ADR-040); the
      // column stays nullable+CHECK-constrained at the DB layer, so NULL
      // is the realistic default here and the constraint test below still
      // passes an explicit override to exercise the CHECK.
      overrides.gpa ?? null,
    ],
  );

  return candidateId;
}

beforeAll(async () => {
  await pool.query(`
    TRUNCATE TABLE
      candidate_locks,
      candidate_choices,
      candidates,
      period_departments,
      study_programs,
      recruitment_periods,
      sessions,
      accounts,
      users,
      role_permissions,
      permissions,
      departments,
      roles
    RESTART IDENTITY CASCADE
  `);
});

afterAll(async () => {
  await pool.end();
});

describe.sequential("PostgreSQL constraints", () => {
  it("menegakkan role dan department scope", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await insertFoundation(client);

      await client.query(
        `INSERT INTO users
          (id, name, email, "emailVerified", role, banned, "mustChangePassword", "departmentId", "createdAt", "updatedAt")
         VALUES ($1, 'Super Fixture', 'super@example.test', true, 'SUPER_ADMIN', false, true, NULL, now(), now())`,
        [randomUUID()],
      );

      await expectConstraintViolation(
        () =>
          client.query(
            `INSERT INTO users
              (id, name, email, "emailVerified", role, banned, "mustChangePassword", "departmentId", "createdAt", "updatedAt")
             VALUES ($1, 'PJ Invalid', 'pj-invalid@example.test', true, 'DEPT_PJ', false, true, NULL, now(), now())`,
            [randomUUID()],
          ),
        "23514",
      );

      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  it("menolak SUPER_ADMIN dengan department scope", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const fixture = await insertFoundation(client);

      await expectConstraintViolation(
        () =>
          client.query(
            `INSERT INTO users
              (id, name, email, "emailVerified", role, banned, "mustChangePassword", "departmentId", "createdAt", "updatedAt")
             VALUES ($1, 'Super Invalid', 'super-invalid@example.test', true, 'SUPER_ADMIN', false, true, $2, now(), now())`,
            [randomUUID(), fixture.departmentA],
          ),
        "23514",
      );

      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  it("menolak email akun yang sama setelah normalisasi", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await insertFoundation(client);

      await client.query(
        `INSERT INTO users
          (id, name, email, "emailVerified", role, banned, "mustChangePassword", "departmentId", "createdAt", "updatedAt")
         VALUES ($1, 'Super Satu', 'admin.fixture@example.test', true, 'SUPER_ADMIN', false, true, NULL, now(), now())`,
        [randomUUID()],
      );

      await expectConstraintViolation(
        () =>
          client.query(
            `INSERT INTO users
              (id, name, email, "emailVerified", role, banned, "mustChangePassword", "departmentId", "createdAt", "updatedAt")
             VALUES ($1, 'Super Dua', ' ADMIN.FIXTURE@example.test ', true, 'SUPER_ADMIN', false, true, NULL, now(), now())`,
            [randomUUID()],
          ),
        "23505",
      );

      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  it("menolak NIM duplikat per periode", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const fixture = await insertFoundation(client);

      await insertCandidate(client, fixture, {
        normalizedNim: "NIM-DUPLIKAT",
        normalizedEmail: "unik-1@example.test",
      });
      await expectConstraintViolation(
        () =>
          insertCandidate(client, fixture, {
            normalizedNim: "NIM-DUPLIKAT",
            normalizedEmail: "unik-2@example.test",
          }),
        "23505",
      );

      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  it("menolak email duplikat per periode", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const fixture = await insertFoundation(client);

      await insertCandidate(client, fixture, {
        normalizedNim: "NIM-UNIK-1",
        normalizedEmail: "email-duplikat@example.test",
      });
      await expectConstraintViolation(
        () =>
          insertCandidate(client, fixture, {
            normalizedNim: "NIM-UNIK-2",
            normalizedEmail: "email-duplikat@example.test",
          }),
        "23505",
      );

      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  it("menolak IPK di luar 0.00 sampai 4.00", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const fixture = await insertFoundation(client);

      await expectConstraintViolation(
        () => insertCandidate(client, fixture, { gpa: 4.1 }),
        "23514",
      );

      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  it("menolak dua pilihan Birdep yang sama", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const fixture = await insertFoundation(client);
      const candidateId = await insertCandidate(client, fixture);

      await client.query(
        `INSERT INTO candidate_choices
          (id, "candidateId", "departmentId", rank, motivation, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 'PRIMARY', 'Motivasi fixture', now(), now())`,
        [randomUUID(), candidateId, fixture.departmentA],
      );

      await expectConstraintViolation(
        () =>
          client.query(
            `INSERT INTO candidate_choices
              (id, "candidateId", "departmentId", rank, motivation, "createdAt", "updatedAt")
             VALUES ($1, $2, $3, 'SECONDARY', 'Motivasi fixture', now(), now())`,
            [randomUUID(), candidateId, fixture.departmentA],
          ),
        "23505",
      );

      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  it("menjamin hanya satu active lock per kandidat", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const fixture = await insertFoundation(client);
      const candidateId = await insertCandidate(client, fixture);

      await client.query(
        `INSERT INTO candidate_locks
          (id, "candidateId", "departmentId", "lockedByUserId", "lockedAt")
         VALUES ($1, $2, $3, 'fixture-user-a', now())`,
        [randomUUID(), candidateId, fixture.departmentA],
      );

      await expectConstraintViolation(
        () =>
          client.query(
            `INSERT INTO candidate_locks
              (id, "candidateId", "departmentId", "lockedByUserId", "lockedAt")
             VALUES ($1, $2, $3, 'fixture-user-b', now())`,
            [randomUUID(), candidateId, fixture.departmentB],
          ),
        "23505",
      );

      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });
});
