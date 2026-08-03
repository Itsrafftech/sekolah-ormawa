import { randomUUID } from "node:crypto";
import { readdir, rm } from "node:fs/promises";
import path from "node:path";

import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) throw new Error("TEST_DATABASE_URL wajib untuk integration test auth.");
process.env.DATABASE_URL = connectionString;

const pool = new Pool({ connectionString });
const adminId = "91000000-0000-4000-8000-000000000001";
const pjId = "91000000-0000-4000-8000-000000000002";
const departmentId = "92000000-0000-4000-8000-000000000001";
const temporaryPassword = "Synthetic-Temporary-Passphrase-63!";
const changedPassword = "Synthetic-Changed-Passphrase-63!";
const appOrigin = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").origin;

let hashPassword: typeof import("@/lib/auth/password").hashPassword;
let performLogin: typeof import("@/server/auth/login").performLogin;
let requireAuthenticatedUser: typeof import("@/server/auth/guard").requireAuthenticatedUser;
let requirePasswordChanged: typeof import("@/server/auth/guard").requirePasswordChanged;
let requireSuperAdmin: typeof import("@/server/auth/guard").requireSuperAdmin;
let requireDepartmentResourceScope: typeof import("@/server/auth/guard").requireDepartmentResourceScope;
let changeAuthenticatedPassword: typeof import("@/server/auth/password-lifecycle").changeAuthenticatedPassword;
let requestPasswordReset: typeof import("@/server/auth/password-lifecycle").requestPasswordReset;
let inspectPasswordResetToken: typeof import("@/server/auth/password-lifecycle").inspectPasswordResetToken;
let resetPasswordWithToken: typeof import("@/server/auth/password-lifecycle").resetPasswordWithToken;
let logoutCurrentSession: typeof import("@/server/auth/session-actions").logoutCurrentSession;
let revokeAllSessions: typeof import("@/server/auth/session-actions").revokeAllSessions;
let consumeAuthRateLimit: typeof import("@/server/auth/rate-limit").consumeAuthRateLimit;
let processEmailOutbox: typeof import("@/server/email/outbox").processEmailOutbox;
let decryptJson: typeof import("@/lib/security/crypto").decryptJson;
let getEnvironment: typeof import("@/lib/env").getServerEnvironment;
let fixtureHash = "";

function authHeaders(ip = "203.0.113.63", cookie?: string): Headers {
  const headers = new Headers({
    Origin: appOrigin,
    "User-Agent": "Phase4Integration/1.0",
    "X-Forwarded-For": ip,
  });
  if (cookie) headers.set("Cookie", cookie);
  return headers;
}

function cookieHeader(response: Response): string {
  return response.headers.getSetCookie()
    .map((value) => value.split(";", 1)[0])
    .join("; ");
}

async function login(email: string, password = temporaryPassword, ip?: string) {
  return performLogin({ headers: authHeaders(ip), email, password, redirectTo: "/admin/dashboard" });
}

async function expectAuthCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({ code });
}

beforeAll(async () => {
  ({ hashPassword } = await import("@/lib/auth/password"));
  ({ performLogin } = await import("@/server/auth/login"));
  ({ requireAuthenticatedUser, requirePasswordChanged, requireSuperAdmin, requireDepartmentResourceScope } = await import("@/server/auth/guard"));
  ({ changeAuthenticatedPassword, requestPasswordReset, inspectPasswordResetToken, resetPasswordWithToken } = await import("@/server/auth/password-lifecycle"));
  ({ logoutCurrentSession, revokeAllSessions } = await import("@/server/auth/session-actions"));
  ({ consumeAuthRateLimit } = await import("@/server/auth/rate-limit"));
  ({ processEmailOutbox } = await import("@/server/email/outbox"));
  ({ decryptJson } = await import("@/lib/security/crypto"));
  ({ getServerEnvironment: getEnvironment } = await import("@/lib/env"));
  fixtureHash = await hashPassword(temporaryPassword);

  await pool.query(`
    TRUNCATE TABLE
      password_reset_tokens, auth_rate_limits, rate_limits, sessions, accounts, users,
      email_outbox, audit_logs, role_permissions, permissions, departments, roles
    RESTART IDENTITY CASCADE
  `);
  await pool.query(`
    INSERT INTO roles (code, name, description, "isSystem", "createdAt", "updatedAt")
    VALUES ('SUPER_ADMIN', 'Super Admin', 'Fixture', true, now(), now()),
           ('DEPT_PJ', 'PJ', 'Fixture', true, now(), now())
  `);
  await pool.query(
    `INSERT INTO departments
      (id, code, name, "shortName", "unitType", "sortOrder", "isActive", "configStatus", "createdAt", "updatedAt")
     VALUES ($1, 'AUTH-DEPT', 'Birdep Auth Sintetis', 'Auth', 'BIRO', 1, true, 'ACTIVE', now(), now())`,
    [departmentId],
  );
  for (const [id, name, email, role, scope] of [
    [adminId, "Super Admin Sintetis", "admin.auth@example.test", "SUPER_ADMIN", null],
    [pjId, "PJ Sintetis", "pj.auth@example.test", "DEPT_PJ", departmentId],
  ] as const) {
    await pool.query(
      `INSERT INTO users
        (id, name, email, "emailVerified", role, banned, "isActive", "mustChangePassword", "temporaryPasswordExpiresAt", "departmentId", "sessionVersion", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, true, $4, false, true, true, now() + interval '1 day', $5, 0, now(), now())`,
      [id, name, email, role, scope],
    );
    await pool.query(
      `INSERT INTO accounts
        (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
       VALUES ($1, $2, 'credential', $2, $3, now(), now())`,
      [randomUUID(), id, fixtureHash],
    );
  }
});

beforeEach(async () => {
  const emailSinkRoot = path.resolve(process.cwd(), "storage", getEnvironment().EMAIL_SINK_ROOT);
  if (emailSinkRoot.startsWith(path.resolve(process.cwd(), "storage") + path.sep)) {
    await rm(emailSinkRoot, { recursive: true, force: true });
  }
  await pool.query(`TRUNCATE TABLE password_reset_tokens, auth_rate_limits, rate_limits, sessions, email_outbox, audit_logs RESTART IDENTITY CASCADE`);
  await pool.query(
    `UPDATE users SET banned=false, "isActive"=true, "mustChangePassword"=true,
      "temporaryPasswordExpiresAt"=now() + interval '1 day', "sessionVersion"=0,
      "passwordChangedAt"=NULL, "lastLoginAt"=NULL`,
  );
  await pool.query(`UPDATE accounts SET password=$1`, [fixtureHash]);
});

afterAll(async () => {
  await pool.query(`
    TRUNCATE TABLE
      password_reset_tokens, auth_rate_limits, rate_limits, sessions, accounts, users,
      email_outbox, audit_logs, role_permissions, permissions, departments, roles
    RESTART IDENTITY CASCADE
  `);
  await pool.end();
  const root = path.resolve(process.cwd(), "storage", getEnvironment().EMAIL_SINK_ROOT);
  if (root.startsWith(path.resolve(process.cwd(), "storage") + path.sep)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe.sequential("Phase 4 internal authentication lifecycle", () => {
  it("login Super Admin dan PJ sintetis berhasil menuju forced password", async () => {
    for (const email of ["admin.auth@example.test", "pj.auth@example.test"]) {
      const response = await login(email, temporaryPassword, `203.0.113.${email.startsWith("admin") ? 1 : 2}`);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ data: { next: "/admin/ganti-password" } });
    }
  });

  it("cookie session development HttpOnly, SameSite=Lax, host-only, dan tidak bocor ke body", async () => {
    const response = await login("admin.auth@example.test");
    const cookies = response.headers.getSetCookie().join(";");
    expect(cookies).toContain("HttpOnly");
    expect(cookies).toContain("SameSite=Lax");
    expect(cookies).not.toContain("Domain=");
    expect(cookies).not.toContain("Secure");
    expect(JSON.stringify(await response.clone().json())).not.toContain("session_token");
  });

  it("email tidak dikenal dan password salah memakai error generik yang sama", async () => {
    const results = await Promise.allSettled([
      login("unknown.auth@example.test", temporaryPassword, "203.0.113.11"),
      login("admin.auth@example.test", "Wrong-Synthetic-Password!", "203.0.113.12"),
    ]);
    const messages = results.map((result) => result.status === "rejected" ? result.reason.message : "success");
    expect(new Set(messages).size).toBe(1);
    expect(messages[0]).toBe("Email atau password tidak valid.");
  });

  it("akun nonaktif dan banned ditolak dengan pesan generik", async () => {
    await pool.query(`UPDATE users SET "isActive"=false WHERE id=$1`, [adminId]);
    await expectAuthCode(login("admin.auth@example.test"), "INVALID_CREDENTIALS");
    await pool.query(`UPDATE users SET "isActive"=true, banned=true WHERE id=$1`, [adminId]);
    await expectAuthCode(login("admin.auth@example.test", temporaryPassword, "203.0.113.64"), "INVALID_CREDENTIALS");
  });

  it("rate limit gabungan email+IP bekerja atomik pada request paralel", async () => {
    const ipHash = "synthetic-ip-hash";
    const results = await Promise.allSettled(Array.from({ length: 8 }, () =>
      consumeAuthRateLimit({ scope: "LOGIN", identity: "race@example.test", ipHash, maximum: 5 }),
    ));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(5);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(3);
  });

  it("session absolute expired dan idle expired ditolak lalu dihapus", async () => {
    for (const column of ["absoluteExpiresAt", "updatedAt"] as const) {
      const response = await login("admin.auth@example.test", temporaryPassword, `203.0.113.${column === "updatedAt" ? 21 : 20}`);
      const cookie = cookieHeader(response);
      await pool.query(`UPDATE sessions SET "${column}"=now() - interval '1 day'`);
      await expectAuthCode(requireAuthenticatedUser(authHeaders("203.0.113.22", cookie)), "SESSION_EXPIRED");
      await pool.query(`TRUNCATE TABLE sessions, auth_rate_limits`);
    }
  });

  it("session revoked dan sessionVersion lama ditolak", async () => {
    const response = await login("admin.auth@example.test");
    const cookie = cookieHeader(response);
    await pool.query(`UPDATE users SET "sessionVersion"=1 WHERE id=$1`, [adminId]);
    await expectAuthCode(requireAuthenticatedUser(authHeaders("203.0.113.30", cookie)), "SESSION_REVOKED");
  });

  it("logout mencabut current session", async () => {
    const response = await login("admin.auth@example.test");
    const headers = authHeaders("203.0.113.31", cookieHeader(response));
    const context = await requireAuthenticatedUser(headers);
    const logout = await logoutCurrentSession({ context, headers });
    expect(logout.status).toBe(200);
    expect(Number((await pool.query(`SELECT count(*) FROM sessions`)).rows[0].count)).toBe(0);
  });

  it("revoke-all mencabut seluruh session dan meningkatkan version", async () => {
    await pool.query(`UPDATE users SET "mustChangePassword"=false WHERE id=$1`, [adminId]);
    const first = await login("admin.auth@example.test", temporaryPassword, "203.0.113.41");
    await login("admin.auth@example.test", temporaryPassword, "203.0.113.42");
    const headers = authHeaders("203.0.113.41", cookieHeader(first));
    const context = await requireAuthenticatedUser(headers);
    await revokeAllSessions({ context, headers });
    const row = await pool.query(`SELECT "sessionVersion", (SELECT count(*) FROM sessions WHERE "userId"=$1) AS sessions FROM users WHERE id=$1`, [adminId]);
    expect(row.rows[0]).toMatchObject({ sessionVersion: 1, sessions: "0" });
  });

  it("forced user boleh session/me tetapi guard admin menolak akses langsung", async () => {
    const response = await login("pj.auth@example.test");
    const context = await requireAuthenticatedUser(authHeaders("203.0.113.50", cookieHeader(response)));
    expect(context.mustChangePassword).toBe(true);
    expect(() => requirePasswordChanged(context)).toThrow("wajib diganti");
    await expectAuthCode(requireSuperAdmin(context, authHeaders()), "PASSWORD_CHANGE_REQUIRED");
  });

  it("ganti password menghapus forced state, mencabut sesi lama, dan menerbitkan sesi baru", async () => {
    const loginResponse = await login("admin.auth@example.test");
    const oldCookie = cookieHeader(loginResponse);
    const headers = authHeaders("203.0.113.60", oldCookie);
    const context = await requireAuthenticatedUser(headers);
    const changed = await changeAuthenticatedPassword({
      context,
      headers,
      currentPassword: temporaryPassword,
      newPassword: changedPassword,
    });
    const newCookie = cookieHeader(changed);
    expect((await requireAuthenticatedUser(authHeaders("203.0.113.60", newCookie))).mustChangePassword).toBe(false);
    await expectAuthCode(requireAuthenticatedUser(authHeaders("203.0.113.60", oldCookie)), "UNAUTHENTICATED");
  });

  it("password baru yang sama dengan temporary password ditolak", async () => {
    const response = await login("admin.auth@example.test");
    const headers = authHeaders("203.0.113.61", cookieHeader(response));
    const context = await requireAuthenticatedUser(headers);
    await expectAuthCode(changeAuthenticatedPassword({ context, headers, currentPassword: temporaryPassword, newPassword: temporaryPassword }), "INVALID_PASSWORD");
  });

  it("temporary password kedaluwarsa ditolak", async () => {
    await pool.query(`UPDATE users SET "temporaryPasswordExpiresAt"=now() - interval '1 minute' WHERE id=$1`, [adminId]);
    await expectAuthCode(login("admin.auth@example.test"), "INVALID_CREDENTIALS");
  });

  it("lupa password tidak melakukan enumeration", async () => {
    const known = await requestPasswordReset({ headers: authHeaders("203.0.113.70"), email: "admin.auth@example.test" });
    const unknown = await requestPasswordReset({ headers: authHeaders("203.0.113.71"), email: "unknown.auth@example.test" });
    expect(known.message).toBe(unknown.message);
    expect(known.queued).toBe(true);
    expect(unknown.queued).toBe(false);
  });

  it("reset token invalid, expired, dan replay ditolak", async () => {
    expect(await inspectPasswordResetToken("invalid-token-value-that-is-long-enough-0000")).toBe("INVALID");
    await requestPasswordReset({ headers: authHeaders("203.0.113.72"), email: "admin.auth@example.test" });
    const row = await pool.query(`SELECT id, "tokenHash" FROM password_reset_tokens LIMIT 1`);
    await pool.query(`UPDATE password_reset_tokens SET "expiresAt"=now() - interval '1 minute' WHERE id=$1`, [row.rows[0].id]);
    expect((await pool.query(`SELECT "expiresAt" < now() AS expired FROM password_reset_tokens WHERE id=$1`, [row.rows[0].id])).rows[0].expired).toBe(true);
    await expectAuthCode(resetPasswordWithToken({ headers: authHeaders(), token: "invalid-token-value-that-is-long-enough-0000", newPassword: changedPassword }), "INVALID_RESET_TOKEN");

    await pool.query(`TRUNCATE TABLE password_reset_tokens, email_outbox, auth_rate_limits`);
    await requestPasswordReset({ headers: authHeaders("203.0.113.73"), email: "admin.auth@example.test" });
    const outbox = await pool.query(`SELECT "encryptedPayload" FROM email_outbox WHERE type='PASSWORD_RESET' LIMIT 1`);
    const payload = decryptJson<{ resetUrl: string }>(outbox.rows[0].encryptedPayload, getEnvironment().AUTH_SECRET);
    const token = new URL(payload.resetUrl).searchParams.get("token") as string;
    await resetPasswordWithToken({ headers: authHeaders("203.0.113.73"), token, newPassword: changedPassword });
    await expectAuthCode(resetPasswordWithToken({ headers: authHeaders("203.0.113.73"), token, newPassword: "Another-Synthetic-Passphrase-63!" }), "INVALID_RESET_TOKEN");
  });

  it("reset password mencabut seluruh session dan menghapus forced state", async () => {
    await login("admin.auth@example.test", temporaryPassword, "203.0.113.80");
    await requestPasswordReset({ headers: authHeaders("203.0.113.81"), email: "admin.auth@example.test" });
    const outbox = await pool.query(`SELECT "encryptedPayload" FROM email_outbox WHERE type='PASSWORD_RESET' LIMIT 1`);
    const payload = decryptJson<{ resetUrl: string }>(outbox.rows[0].encryptedPayload, getEnvironment().AUTH_SECRET);
    const token = new URL(payload.resetUrl).searchParams.get("token") as string;
    await resetPasswordWithToken({ headers: authHeaders("203.0.113.81"), token, newPassword: changedPassword });
    const row = await pool.query(`SELECT "mustChangePassword", "sessionVersion", (SELECT count(*) FROM sessions WHERE "userId"=$1) AS sessions FROM users WHERE id=$1`, [adminId]);
    expect(row.rows[0]).toMatchObject({ mustChangePassword: false, sessionVersion: 1, sessions: "0" });
  });

  it("DEPT_PJ tidak mendapat Super Admin dan resource luar scope menjadi 404", async () => {
    await pool.query(`UPDATE users SET "mustChangePassword"=false WHERE id=$1`, [pjId]);
    const response = await login("pj.auth@example.test");
    const headers = authHeaders("203.0.113.90", cookieHeader(response));
    const context = await requireAuthenticatedUser(headers);
    await expectAuthCode(requireSuperAdmin(context, headers), "FORBIDDEN");
    await expectAuthCode(requireDepartmentResourceScope(context, randomUUID(), headers), "RESOURCE_NOT_FOUND");
    expect(context.departmentId).toBe(departmentId);
  });

  it("audit tidak memuat password, cookie, atau token mentah", async () => {
    await expectAuthCode(login("admin.auth@example.test", "Wrong-Synthetic-Password!"), "INVALID_CREDENTIALS");
    const rows = await pool.query(`SELECT * FROM audit_logs`);
    const serialized = JSON.stringify(rows.rows);
    expect(serialized).not.toContain("Wrong-Synthetic-Password!");
    expect(serialized).not.toContain("session_token");
    expect(serialized).not.toContain(temporaryPassword);
  });

  it("local email sink menerima reset sintetis tepat satu kali", async () => {
    await requestPasswordReset({ headers: authHeaders("203.0.113.100"), email: "admin.auth@example.test" });
    await processEmailOutbox({ limit: 10 });
    await processEmailOutbox({ limit: 10 });
    const root = path.resolve(process.cwd(), "storage", getEnvironment().EMAIL_SINK_ROOT);
    expect((await readdir(root)).filter((file) => file.endsWith(".json"))).toHaveLength(1);
    expect(Number((await pool.query(`SELECT count(*) FROM email_outbox WHERE status='SENT'`)).rows[0].count)).toBe(1);
  });
});
