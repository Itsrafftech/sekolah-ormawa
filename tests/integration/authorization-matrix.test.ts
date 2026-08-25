import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) throw new Error("TEST_DATABASE_URL wajib untuk integration test authorization matrix.");
process.env.DATABASE_URL = connectionString;

const pool = new Pool({ connectionString });
const appOrigin = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").origin;

const periodId = "84100000-0000-4000-8000-000000000001";
const deptA = "84200000-0000-4000-8000-000000000001";
const deptB = "84200000-0000-4000-8000-000000000002";
const studyProgramId = "84300000-0000-4000-8000-000000000001";
const superAdminId = "84400000-0000-4000-8000-000000000001";
const pjAId = "84400000-0000-4000-8000-000000000002";
const candidateInB = "84500000-0000-4000-8000-000000000001";

let hashPassword: typeof import("@/lib/auth/password").hashPassword;
let performLogin: typeof import("@/server/auth/login").performLogin;

// Route handlers under test, imported and invoked directly (no live server
// needed - Next.js App Router route handlers are plain async functions).
let candidatesListGET: typeof import("@/app/api/admin/candidates/route").GET;
let candidateDetailGET: typeof import("@/app/api/admin/candidates/[id]/route").GET;
let overridePOST: typeof import("@/app/api/admin/candidates/[id]/override/route").POST;
let broadcastPreviewPOST: typeof import("@/app/api/admin/broadcast/preview/route").POST;
let accountsGET: typeof import("@/app/api/admin/accounts/route").GET;
let periodsGET: typeof import("@/app/api/admin/periods/route").GET;

const password = "Synthetic-AuthzMatrix-Passphrase-63!";

function headers(cookie?: string, ip = "203.0.113.80"): Headers {
  const h = new Headers({
    Origin: appOrigin,
    "User-Agent": "Phase8AuthzMatrix/1.0",
    "X-Forwarded-For": ip,
  });
  if (cookie) h.set("Cookie", cookie);
  return h;
}

function cookieFrom(response: Response): string {
  return response.headers.getSetCookie().map((v) => v.split(";", 1)[0]).join("; ");
}

// Each login() call must come from a distinct source IP: both this app's own
// LOGIN rate limit (keyed by email+ip) and Better Auth's built-in rate
// limiter (keyed by ip) would otherwise trip well before this suite's many
// intentionally-repeated logins for the same fixture users are done.
let loginIpCounter = 0;
async function login(email: string): Promise<string> {
  loginIpCounter += 1;
  const octet3 = Math.floor(loginIpCounter / 255) + 10;
  const octet4 = (loginIpCounter % 254) + 1;
  const ip = `203.0.${octet3}.${octet4}`;
  const response = await performLogin({ headers: headers(undefined, ip), email, password, redirectTo: "/admin/dashboard" });
  return cookieFrom(response);
}

beforeAll(async () => {
  ({ hashPassword } = await import("@/lib/auth/password"));
  ({ performLogin } = await import("@/server/auth/login"));
  ({ GET: candidatesListGET } = await import("@/app/api/admin/candidates/route"));
  ({ GET: candidateDetailGET } = await import("@/app/api/admin/candidates/[id]/route"));
  ({ POST: overridePOST } = await import("@/app/api/admin/candidates/[id]/override/route"));
  ({ POST: broadcastPreviewPOST } = await import("@/app/api/admin/broadcast/preview/route"));
  ({ GET: accountsGET } = await import("@/app/api/admin/accounts/route"));
  ({ GET: periodsGET } = await import("@/app/api/admin/periods/route"));

  await pool.query(`
    TRUNCATE TABLE
      candidate_choices, candidates, study_programs, recruitment_periods,
      sessions, accounts, users, departments, audit_logs, auth_rate_limits, roles
    RESTART IDENTITY CASCADE
  `);
  await pool.query(`
    INSERT INTO roles (code, name, description, "isSystem", "createdAt", "updatedAt")
    VALUES ('SUPER_ADMIN', 'Super Admin', 'Fixture', true, now(), now()),
           ('DEPT_PJ', 'PJ', 'Fixture', true, now(), now())
  `);
  await pool.query(
    `INSERT INTO departments (id, code, name, "shortName", "unitType", "sortOrder", "isActive", "configStatus", "createdAt", "updatedAt")
     VALUES ($1, 'AUTHZ-A', 'Birdep Authz A', 'A', 'BIRO', 1, true, 'ACTIVE', now(), now()),
            ($2, 'AUTHZ-B', 'Birdep Authz B', 'B', 'DEPARTEMEN', 2, true, 'ACTIVE', now(), now())`,
    [deptA, deptB],
  );
  await pool.query(
    `INSERT INTO recruitment_periods (id, code, name, status, "configStatus", "cohortCode", "createdAt", "updatedAt")
     VALUES ($1, 'PHASE8-AUTHZ-TEST', 'Periode Sintetis Authz Matrix', 'OPEN', 'ACTIVE', 63, now(), now())`,
    [periodId],
  );
  await pool.query(
    `INSERT INTO study_programs (id, code, name, "configStatus", "isActive", "createdAt", "updatedAt")
     VALUES ($1, 'PRODI-AUTHZ', 'Program Studi Authz', 'ACTIVE', true, now(), now())`,
    [studyProgramId],
  );

  const passwordHash = await hashPassword(password);
  for (const [id, role, dept] of [
    [superAdminId, "SUPER_ADMIN", null],
    [pjAId, "DEPT_PJ", deptA],
  ] as const) {
    await pool.query(
      `INSERT INTO users (id, name, email, "emailVerified", role, banned, "isActive", "mustChangePassword", "departmentId", "sessionVersion", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, true, $4, false, true, false, $5, 0, now(), now())`,
      [id, `Fixture ${role}`, `${id}@example.test`, role, dept],
    );
    await pool.query(
      `INSERT INTO accounts (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
       VALUES ($1, $2, 'credential', $2, $3, now(), now())`,
      [randomUUID(), id, passwordHash],
    );
  }

  await pool.query(
    `INSERT INTO candidates
      (id, "periodId", "registrationNumber", name, nim, "normalizedNim", "cohortCode", "entryYear", "className", "studyProgramId", phone, email, "normalizedEmail", domicile, "essayOrgExperience", "essayContribution", "essayBalance", status, "submittedAt", "updatedAt")
     VALUES ($1, $2, 'REG-AUTHZ01', 'Kandidat Authz B', 'NIM-AUTHZ01', 'NIM-AUTHZ01', 63, 2026, 'Kelas AZ', $3, '081200000001', 'authz@example.test', 'authz@example.test', 'Kota Fixture', 'Sintetis', 'Sintetis', 'Sintetis', 'SUBMITTED', now(), now())`,
    [candidateInB, periodId, studyProgramId],
  );
  await pool.query(
    `INSERT INTO candidate_choices (id, "candidateId", "departmentId", rank, motivation, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 'PRIMARY', 'Motivasi sintetis', now(), now())`,
    [randomUUID(), candidateInB, deptB],
  );
});

afterAll(async () => {
  await pool.query(`
    TRUNCATE TABLE
      candidate_choices, candidates, study_programs, recruitment_periods,
      sessions, accounts, users, departments, audit_logs, auth_rate_limits, roles
    RESTART IDENTITY CASCADE
  `);
  await pool.end();
});

describe("Publik -> endpoint admin -> 401", () => {
  const cases: Array<[string, () => Promise<Response>]> = [
    ["GET candidates list", () => candidatesListGET(new Request(`${appOrigin}/api/admin/candidates?segment=PRIMARY&departmentId=${deptA}`, { headers: headers() }))],
    ["GET accounts", () => accountsGET(new Request(`${appOrigin}/api/admin/accounts`, { headers: headers() }))],
    ["GET periods", () => periodsGET(new Request(`${appOrigin}/api/admin/periods`, { headers: headers() }))],
    ["POST broadcast preview", () => broadcastPreviewPOST(new Request(`${appOrigin}/api/admin/broadcast/preview`, {
      method: "POST", headers: headers(), body: JSON.stringify({ filter: { periodId }, content: { subject: "x", body: "y".repeat(10) } }),
    }))],
    ["POST override", () => overridePOST(
      new Request(`${appOrigin}/api/admin/candidates/${candidateInB}/override`, { method: "POST", headers: headers(), body: JSON.stringify({ reason: "alasan sintetis" }) }),
      { params: Promise.resolve({ id: candidateInB }) },
    )],
  ];

  for (const [label, call] of cases) {
    it(`${label} tanpa session -> 401`, async () => {
      const response = await call();
      expect(response.status).toBe(401);
    });
  }
});

describe("PJ Birdep A lintas-scope -> 403/404", () => {
  it("kandidat Birdep B -> 404 (bukan 403)", async () => {
    const cookie = await login(`${pjAId}@example.test`);
    const response = await candidateDetailGET(
      new Request(`${appOrigin}/api/admin/candidates/${candidateInB}?departmentId=${deptA}`, { headers: headers(cookie) }),
      { params: Promise.resolve({ id: candidateInB }) },
    );
    expect(response.status).toBe(404);
  });

  it("list kandidat dengan departmentId Birdep lain -> 404", async () => {
    const cookie = await login(`${pjAId}@example.test`);
    const response = await candidatesListGET(
      new Request(`${appOrigin}/api/admin/candidates?segment=PRIMARY&departmentId=${deptB}`, { headers: headers(cookie) }),
    );
    expect(response.status).toBe(404);
  });

  it("override lock -> 403", async () => {
    const cookie = await login(`${pjAId}@example.test`);
    const response = await overridePOST(
      new Request(`${appOrigin}/api/admin/candidates/${candidateInB}/override`, {
        method: "POST", headers: headers(cookie), body: JSON.stringify({ reason: "percobaan override oleh PJ" }),
      }),
      { params: Promise.resolve({ id: candidateInB }) },
    );
    expect(response.status).toBe(403);
  });

  it("broadcast -> 403", async () => {
    const cookie = await login(`${pjAId}@example.test`);
    const response = await broadcastPreviewPOST(new Request(`${appOrigin}/api/admin/broadcast/preview`, {
      method: "POST", headers: headers(cookie), body: JSON.stringify({ filter: { periodId }, content: { subject: "x", body: "y".repeat(10) } }),
    }));
    expect(response.status).toBe(403);
  });

  it("akun -> 403", async () => {
    const cookie = await login(`${pjAId}@example.test`);
    const response = await accountsGET(new Request(`${appOrigin}/api/admin/accounts`, { headers: headers(cookie) }));
    expect(response.status).toBe(403);
  });

  it("periode -> 403", async () => {
    const cookie = await login(`${pjAId}@example.test`);
    const response = await periodsGET(new Request(`${appOrigin}/api/admin/periods`, { headers: headers(cookie) }));
    expect(response.status).toBe(403);
  });
});

describe("Session revoked -> 401 di seluruh admin route", () => {
  it("session yang sudah dicabut ditolak", async () => {
    const cookie = await login(`${pjAId}@example.test`);
    // Simulate revoke-all: bump sessionVersion so the still-presented cookie's
    // session row is stale, exactly like Phase 4's revoke-all mechanism.
    await pool.query(`UPDATE users SET "sessionVersion" = "sessionVersion" + 1 WHERE id=$1`, [pjAId]);

    const listResponse = await candidatesListGET(
      new Request(`${appOrigin}/api/admin/candidates?segment=PRIMARY&departmentId=${deptA}`, { headers: headers(cookie) }),
    );
    expect(listResponse.status).toBe(401);

    const accountsResponse = await accountsGET(new Request(`${appOrigin}/api/admin/accounts`, { headers: headers(cookie) }));
    expect(accountsResponse.status).toBe(401);
  });

  it("session yang sudah dihapus (logout/expired) ditolak", async () => {
    const cookie = await login(`${pjAId}@example.test`);
    await pool.query(`DELETE FROM sessions WHERE "userId"=$1`, [pjAId]);

    const response = await candidatesListGET(
      new Request(`${appOrigin}/api/admin/candidates?segment=PRIMARY&departmentId=${deptA}`, { headers: headers(cookie) }),
    );
    expect(response.status).toBe(401);
  });
});

describe("Super Admin tetap berwenang penuh (kontrol positif)", () => {
  it("Super Admin bisa akses akun, periode, dan broadcast preview", async () => {
    const cookie = await login(`${superAdminId}@example.test`);

    const accountsResponse = await accountsGET(new Request(`${appOrigin}/api/admin/accounts`, { headers: headers(cookie) }));
    expect(accountsResponse.status).toBe(200);

    const periodsResponse = await periodsGET(new Request(`${appOrigin}/api/admin/periods`, { headers: headers(cookie) }));
    expect(periodsResponse.status).toBe(200);

    const broadcastResponse = await broadcastPreviewPOST(new Request(`${appOrigin}/api/admin/broadcast/preview`, {
      method: "POST", headers: headers(cookie), body: JSON.stringify({ filter: { periodId }, content: { subject: "Pengumuman", body: "Isi pesan sintetis untuk kontrol positif." } }),
    }));
    expect(broadcastResponse.status).toBe(200);
  });
});
