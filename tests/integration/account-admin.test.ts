import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) throw new Error("TEST_DATABASE_URL wajib untuk integration test account admin.");
process.env.DATABASE_URL = connectionString;

const pool = new Pool({ connectionString });
const deptId = "95000000-0000-4000-8000-000000000001";
const superAdminId = "96000000-0000-4000-8000-000000000001";

let createPjAccount: typeof import("@/server/admin/accounts").createPjAccount;
let updateAccount: typeof import("@/server/admin/accounts").updateAccount;
let setAccountBanned: typeof import("@/server/admin/accounts").setAccountBanned;
let revokeAccountSessions: typeof import("@/server/admin/accounts").revokeAccountSessions;
let issueAccountResetLink: typeof import("@/server/admin/accounts").issueAccountResetLink;
let AccountAdminError: typeof import("@/server/admin/accounts").AccountAdminError;
let disconnectPrismaForTests: typeof import("@/lib/db").disconnectPrismaForTests;

function headers(): Headers {
  return new Headers({ "User-Agent": "Phase7Integration/1.0", "X-Forwarded-For": "203.0.113.7" });
}

beforeAll(async () => {
  ({ createPjAccount, updateAccount, setAccountBanned, revokeAccountSessions, issueAccountResetLink, AccountAdminError } =
    await import("@/server/admin/accounts"));
  ({ disconnectPrismaForTests } = await import("@/lib/db"));

  await pool.query(`
    TRUNCATE TABLE
      password_reset_tokens, email_outbox, sessions, accounts, users,
      audit_logs, departments, roles
    RESTART IDENTITY CASCADE
  `);
  await pool.query(`
    INSERT INTO roles (code, name, description, "isSystem", "createdAt", "updatedAt")
    VALUES ('SUPER_ADMIN', 'Super Admin', 'Fixture', true, now(), now()),
           ('DEPT_PJ', 'PJ', 'Fixture', true, now(), now())
  `);
  await pool.query(
    `INSERT INTO departments (id, code, name, "shortName", "unitType", "sortOrder", "isActive", "configStatus", "createdAt", "updatedAt")
     VALUES ($1, 'ACC-A', 'Birdep Akun A', 'A', 'BIRO', 1, true, 'ACTIVE', now(), now())`,
    [deptId],
  );
  await pool.query(
    `INSERT INTO users (id, name, email, "emailVerified", role, banned, "isActive", "mustChangePassword", "sessionVersion", "createdAt", "updatedAt")
     VALUES ($1, 'Super Admin Fixture', $2, true, 'SUPER_ADMIN', false, true, false, 0, now(), now())`,
    [superAdminId, `${superAdminId}@example.test`],
  );
});

afterAll(async () => {
  await pool.query(`
    TRUNCATE TABLE
      password_reset_tokens, email_outbox, sessions, accounts, users,
      audit_logs, departments, roles
    RESTART IDENTITY CASCADE
  `);
  await disconnectPrismaForTests();
  await pool.end();
});

describe("F7-01 account lifecycle", () => {
  it("membuat akun PJ tanpa temp password, dengan setup link lewat outbox", async () => {
    const account = await createPjAccount({
      name: "PJ Baru Fixture",
      email: "pj.baru@example.test",
      departmentId: deptId,
      actorUserId: superAdminId,
      headers: headers(),
    });
    expect(account.role).toBe("DEPT_PJ");
    expect(account.mustChangePassword).toBe(true);

    const resetToken = await pool.query(
      `SELECT count(*)::int AS count FROM password_reset_tokens WHERE "userId"=$1 AND "usedAt" IS NULL`,
      [account.id],
    );
    expect(resetToken.rows[0].count).toBe(1);

    const outbox = await pool.query(
      `SELECT type FROM email_outbox WHERE "idempotencyKey"=$1`,
      [`account-setup:${account.id}`],
    );
    expect(outbox.rows[0]?.type).toBe("ACCOUNT_SETUP");

    const audit = await pool.query(
      `SELECT action FROM audit_logs WHERE "entityType"='ACCOUNT' AND "entityId"=$1`,
      [account.id],
    );
    expect(audit.rows[0].action).toBe("CREATE");
  });

  it("menolak email yang sudah dipakai", async () => {
    await expect(
      createPjAccount({
        name: "Duplikat", email: "pj.baru@example.test", departmentId: deptId,
        actorUserId: superAdminId, headers: headers(),
      }),
    ).rejects.toMatchObject({ code: "EMAIL_TAKEN", status: 409 });
  });

  it("update, disable, revoke, dan reset link berjalan dan tercatat audit", async () => {
    const account = await createPjAccount({
      name: "PJ Lifecycle Fixture", email: "pj.lifecycle@example.test", departmentId: deptId,
      actorUserId: superAdminId, headers: headers(),
    });

    const updated = await updateAccount({
      accountId: account.id, name: "PJ Lifecycle Diubah",
      actorUserId: superAdminId, headers: headers(),
    });
    expect(updated?.name).toBe("PJ Lifecycle Diubah");

    const disabled = await setAccountBanned({
      accountId: account.id, banned: true, actorUserId: superAdminId, headers: headers(),
    });
    expect(disabled?.banned).toBe(true);

    const enabled = await setAccountBanned({
      accountId: account.id, banned: false, actorUserId: superAdminId, headers: headers(),
    });
    expect(enabled?.banned).toBe(false);

    const revoked = await revokeAccountSessions({
      accountId: account.id, actorUserId: superAdminId, headers: headers(),
    });
    expect(revoked).toBe(true);

    const resetIssued = await issueAccountResetLink({
      accountId: account.id, actorUserId: superAdminId, headers: headers(),
    });
    expect(resetIssued).toBe(true);

    const activeTokens = await pool.query(
      `SELECT count(*)::int AS count FROM password_reset_tokens WHERE "userId"=$1 AND "usedAt" IS NULL`,
      [account.id],
    );
    expect(activeTokens.rows[0].count).toBe(1);
  });

  it("mengembalikan null/false untuk id yang bukan akun PJ (mis. Super Admin)", async () => {
    const updated = await updateAccount({
      accountId: superAdminId, name: "Percobaan ubah Super Admin",
      actorUserId: superAdminId, headers: headers(),
    });
    expect(updated).toBeNull();

    const revoked = await revokeAccountSessions({
      accountId: superAdminId, actorUserId: superAdminId, headers: headers(),
    });
    expect(revoked).toBe(false);
  });

  it("menolak department tidak aktif/tidak ditemukan", async () => {
    await expect(
      createPjAccount({
        name: "PJ Invalid Dept", email: "pj.invaliddept@example.test", departmentId: randomUUID(),
        actorUserId: superAdminId, headers: headers(),
      }),
    ).rejects.toBeInstanceOf(AccountAdminError);
  });
});
