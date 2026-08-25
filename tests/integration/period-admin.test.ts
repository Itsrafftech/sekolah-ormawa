import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) throw new Error("TEST_DATABASE_URL wajib untuk integration test period admin.");
process.env.DATABASE_URL = connectionString;

const pool = new Pool({ connectionString });
const periodId = "97000000-0000-4000-8000-000000000001";
const deptId = "98000000-0000-4000-8000-000000000001";
const superAdminId = "99000000-0000-4000-8000-000000000001";

let listPeriods: typeof import("@/server/admin/periods").listPeriods;
let updatePeriod: typeof import("@/server/admin/periods").updatePeriod;
let listPeriodDepartments: typeof import("@/server/admin/periods").listPeriodDepartments;
let updatePeriodDepartment: typeof import("@/server/admin/periods").updatePeriodDepartment;

function headers(): Headers {
  return new Headers({ "User-Agent": "Phase7Integration/1.0", "X-Forwarded-For": "203.0.113.8" });
}

beforeAll(async () => {
  ({ listPeriods, updatePeriod, listPeriodDepartments, updatePeriodDepartment } =
    await import("@/server/admin/periods"));

  await pool.query(`
    TRUNCATE TABLE period_departments, candidates, recruitment_periods, departments, audit_logs RESTART IDENTITY CASCADE
  `);
  await pool.query(
    `INSERT INTO departments (id, code, name, "shortName", "unitType", "sortOrder", "isActive", "configStatus", "createdAt", "updatedAt")
     VALUES ($1, 'PER-A', 'Birdep Periode A', 'A', 'BIRO', 1, true, 'ACTIVE', now(), now())`,
    [deptId],
  );
  await pool.query(
    `INSERT INTO recruitment_periods (id, code, name, status, "configStatus", "cohortCode", "allowUnlock", "createdAt", "updatedAt")
     VALUES ($1, 'PHASE7-TEST', 'Periode Sintetis Phase 7', 'DRAFT', 'DRAFT', 63, false, now(), now())`,
    [periodId],
  );
  await pool.query(
    `INSERT INTO period_departments (id, "periodId", "departmentId", "acceptsApplications", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, false, now(), now())`,
    [randomUUID(), periodId, deptId],
  );
});

afterAll(async () => {
  await pool.query(`
    TRUNCATE TABLE period_departments, candidates, recruitment_periods, departments, audit_logs RESTART IDENTITY CASCADE
  `);
  await pool.end();
});

describe("F7-02 period admin", () => {
  it("listPeriods menyertakan jumlah kandidat", async () => {
    const periods = await listPeriods();
    expect(periods.find((period) => period.id === periodId)?.candidateCount).toBe(0);
  });

  it("updatePeriod mengubah status/config dan menulis audit", async () => {
    const updated = await updatePeriod({
      periodId,
      changes: { status: "OPEN", configStatus: "ACTIVE", allowUnlock: true, entryYear: 2026, registrationPrefix: "A63" },
      actorUserId: superAdminId,
      headers: headers(),
    });
    expect(updated).toMatchObject({ status: "OPEN", configStatus: "ACTIVE", allowUnlock: true, entryYear: 2026 });

    const audit = await pool.query(
      `SELECT action FROM audit_logs WHERE "entityType"='RECRUITMENT_PERIOD' AND "entityId"=$1`,
      [periodId],
    );
    expect(audit.rows[0].action).toBe("UPDATE");
  });

  it("updatePeriod mengembalikan null untuk periode yang tidak ada", async () => {
    const updated = await updatePeriod({
      periodId: randomUUID(),
      changes: { status: "CLOSED" },
      actorUserId: superAdminId,
      headers: headers(),
    });
    expect(updated).toBeNull();
  });

  it("updatePeriodDepartment mengubah acceptsApplications/quota dan menulis audit", async () => {
    const before = await listPeriodDepartments(periodId);
    expect(before?.[0]).toMatchObject({ departmentId: deptId, acceptsApplications: false });

    const updated = await updatePeriodDepartment({
      periodId, departmentId: deptId, changes: { acceptsApplications: true, quota: 5 },
      actorUserId: superAdminId, headers: headers(),
    });
    expect(updated).toMatchObject({ acceptsApplications: true, quota: 5 });

    const audit = await pool.query(
      `SELECT action FROM audit_logs WHERE "entityType"='PERIOD_DEPARTMENT' AND "departmentId"=$1`,
      [deptId],
    );
    expect(audit.rows[0].action).toBe("UPDATE");
  });

  it("updatePeriodDepartment mengembalikan null untuk kombinasi yang tidak ada", async () => {
    const updated = await updatePeriodDepartment({
      periodId, departmentId: randomUUID(), changes: { acceptsApplications: true },
      actorUserId: superAdminId, headers: headers(),
    });
    expect(updated).toBeNull();
  });
});
