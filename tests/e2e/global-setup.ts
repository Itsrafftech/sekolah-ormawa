import { randomUUID } from "node:crypto";

import { Pool } from "pg";

import { hashPassword } from "@/lib/auth/password";

export const E2E_PERIOD_ID = "81000000-0000-4000-8000-000000000001";
export const E2E_DEPARTMENT_A = "82000000-0000-4000-8000-000000000001";
export const E2E_DEPARTMENT_B = "82000000-0000-4000-8000-000000000002";
export const E2E_MEDBRAND = "82000000-0000-4000-8000-000000000003";
export const E2E_STUDY_PROGRAM = "83000000-0000-4000-8000-000000000001";
export const E2E_ADMIN_ID = "84000000-0000-4000-8000-000000000001";
export const E2E_PJ_ID = "84000000-0000-4000-8000-000000000002";
export const E2E_TEMPORARY_PASSWORD = "Synthetic-E2E-Temporary-Passphrase-63!";

export default async function globalSetup() {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) throw new Error("TEST_DATABASE_URL wajib untuk E2E setup.");
  const pool = new Pool({ connectionString });
  try {
    await pool.query(`
      TRUNCATE TABLE
        password_reset_tokens, auth_rate_limits, rate_limits, sessions, accounts, users,
        registration_confirmations, candidate_portfolios, candidate_choices,
        file_uploads, candidates, email_outbox, idempotency_records, audit_logs,
        period_departments, study_programs, recruitment_periods,
        role_permissions, permissions, departments, roles
      RESTART IDENTITY CASCADE
    `);
    await pool.query(
      `INSERT INTO departments
        (id, code, name, "shortName", "unitType", "sortOrder", "isActive", "configStatus", "createdAt", "updatedAt")
       VALUES ($1, 'E2E-A', 'Birdep Sintetis A', 'A', 'BIRO', 1, true, 'ACTIVE', now(), now()),
              ($2, 'E2E-B', 'Birdep Sintetis B', 'B', 'DEPARTEMEN', 2, true, 'ACTIVE', now(), now()),
              ($3, 'MEDBRAND', 'Biro Media Branding', 'Medbrand', 'BIRO', 3, true, 'ACTIVE', now(), now())`,
      [E2E_DEPARTMENT_A, E2E_DEPARTMENT_B, E2E_MEDBRAND],
    );
    await pool.query(
      `INSERT INTO recruitment_periods
        (id, code, name, status, "configStatus", "cohortCode", "entryYear", "registrationPrefix", "registrationSequence", "opensAt", "closesAt", "choice2Required", "allowUnlock", "consentVersion", "createdAt", "updatedAt")
       VALUES ($1, 'PHASE3-E2E', 'Periode Sintetis E2E', 'OPEN', 'ACTIVE', 63, 2026, 'E2E63', 0, now() - interval '1 hour', now() + interval '1 day', true, false, 'DRAFT-CONSENT-E2E', now(), now())`,
      [E2E_PERIOD_ID],
    );
    for (const departmentId of [E2E_DEPARTMENT_A, E2E_DEPARTMENT_B, E2E_MEDBRAND]) {
      await pool.query(
        `INSERT INTO period_departments
          (id, "periodId", "departmentId", "acceptsApplications", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, true, now(), now())`,
        [randomUUID(), E2E_PERIOD_ID, departmentId],
      );
    }
    await pool.query(
      `INSERT INTO study_programs
        (id, code, name, "configStatus", "isActive", "createdAt", "updatedAt")
       VALUES ($1, 'PRODI-E2E', 'Program Studi Sintetis E2E', 'ACTIVE', true, now(), now())`,
      [E2E_STUDY_PROGRAM],
    );
    await pool.query(`
      INSERT INTO roles (code, name, description, "isSystem", "createdAt", "updatedAt")
      VALUES ('SUPER_ADMIN', 'Super Admin', 'Fixture E2E', true, now(), now()),
             ('DEPT_PJ', 'PJ Birdep', 'Fixture E2E', true, now(), now())
    `);
    const fixtureHash = await hashPassword(E2E_TEMPORARY_PASSWORD);
    await pool.query(
      `INSERT INTO users
        (id, name, email, "emailVerified", role, banned, "isActive", "mustChangePassword", "temporaryPasswordExpiresAt", "departmentId", "sessionVersion", "createdAt", "updatedAt")
       VALUES ($1, 'Super Admin E2E', 'superadmin.e2e@example.test', true, 'SUPER_ADMIN', false, true, true, now() + interval '1 day', NULL, 0, now(), now()),
              ($2, 'PJ Birdep E2E', 'pj.e2e@example.test', true, 'DEPT_PJ', false, true, true, now() + interval '1 day', $3, 0, now(), now())`,
      [E2E_ADMIN_ID, E2E_PJ_ID, E2E_DEPARTMENT_A],
    );
    await pool.query(
      `INSERT INTO accounts
        (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
       VALUES ($1, $2, 'credential', $2, $4, now(), now()),
              ($3, $5, 'credential', $5, $4, now(), now())`,
      [randomUUID(), E2E_ADMIN_ID, randomUUID(), fixtureHash, E2E_PJ_ID],
    );
  } finally {
    await pool.end();
  }
}
