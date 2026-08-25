import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";
import { Pool } from "pg";

import { hashPassword } from "@/lib/auth/password";
import {
  E2E_ADMIN_ID,
  E2E_PJ_ID,
  E2E_TEMPORARY_PASSWORD,
} from "./global-setup";

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) throw new Error("TEST_DATABASE_URL wajib untuk E2E auth.");
const pool = new Pool({ connectionString });
const changedPassword = "Synthetic-E2E-Changed-Passphrase-63!";
const emailSink = path.resolve(process.cwd(), "storage", "email-sink");
let fixtureHash = "";

async function login(page: Page, email: string, password = E2E_TEMPORARY_PASSWORD) {
  await page.goto("/admin/login");
  await page.getByLabel("Email akun Sekolah").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Masuk ke ruang kerja" }).click();
}

test.beforeAll(async () => {
  fixtureHash = await hashPassword(E2E_TEMPORARY_PASSWORD);
});

test.beforeEach(async () => {
  await pool.query(`TRUNCATE TABLE password_reset_tokens, auth_rate_limits, rate_limits, sessions, email_outbox, audit_logs RESTART IDENTITY CASCADE`);
  await pool.query(
    `UPDATE users SET banned=false, "isActive"=true, "mustChangePassword"=true,
      "temporaryPasswordExpiresAt"=now() + interval '1 day', "sessionVersion"=0,
      "passwordChangedAt"=NULL WHERE id IN ($1, $2)`,
    [E2E_ADMIN_ID, E2E_PJ_ID],
  );
  await pool.query(`UPDATE accounts SET password=$1 WHERE "userId" IN ($2, $3)`, [fixtureHash, E2E_ADMIN_ID, E2E_PJ_ID]);
  await rm(emailSink, { recursive: true, force: true });
});

test.afterAll(async () => {
  await pool.end();
  await rm(emailSink, { recursive: true, force: true });
});

test("login generik, password visibility, keyboard focus, dan rate-limit state", async ({ page }) => {
  await page.goto("/admin/login");
  const password = page.getByLabel("Password", { exact: true });
  await password.fill("Wrong-Synthetic-Password!");
  await page.getByRole("button", { name: "Tampilkan password" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await page.getByLabel("Email akun Sekolah").fill("unknown.e2e@example.test");
  await page.getByRole("button", { name: "Masuk ke ruang kerja" }).focus();
  await page.keyboard.press("Enter");
  const feedback = page.locator(".auth-feedback--error");
  await expect(feedback).toBeFocused({ timeout: 15_000 });
  await expect(feedback).toContainText("Email atau password tidak valid", { timeout: 15_000 });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await page.getByRole("button", { name: "Masuk ke ruang kerja" }).click();
  }
  await expect(feedback).toContainText("Terlalu banyak percobaan");
});

test("Super Admin dipaksa ganti password lalu menerima session baru dan shell", async ({ page }) => {
  await login(page, "superadmin.e2e@example.test");
  await expect(page).toHaveURL(/\/admin\/ganti-password$/u, { timeout: 15_000 });
  await page.goto("/admin/dashboard");
  await expect(page).toHaveURL(/\/admin\/ganti-password$/u);

  await page.getByLabel("Password sementara/saat ini", { exact: true }).fill(E2E_TEMPORARY_PASSWORD);
  await page.getByLabel("Password baru", { exact: true }).fill(changedPassword);
  await page.getByLabel("Ulangi password baru", { exact: true }).fill(changedPassword);
  await page.getByRole("button", { name: "Ganti password" }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/u, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Dashboard PJ" })).toBeVisible();
  await expect(page.getByText("SUPER_ADMIN", { exact: true })).toBeVisible();
  await expect(page.getByText("sekolah.admin.all", { exact: true })).toBeVisible();
  await expect(page.getByText(/Security hardening penuh, backup\/restore drill/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Kelola akun PJ/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Periode & override lock/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Broadcast/ })).toBeVisible();
});

test("PJ mendapat scope Birdep dan tidak mendapat permission Super Admin", async ({ page }) => {
  await login(page, "pj.e2e@example.test");
  await page.getByLabel("Password sementara/saat ini", { exact: true }).fill(E2E_TEMPORARY_PASSWORD);
  await page.getByLabel("Password baru", { exact: true }).fill(changedPassword);
  await page.getByLabel("Ulangi password baru", { exact: true }).fill(changedPassword);
  await page.getByRole("button", { name: "Ganti password" }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/u, { timeout: 15_000 });
  await expect(page.getByText("DEPT_PJ", { exact: true })).toBeVisible();
  await expect(page.getByText("Birdep Sintetis A", { exact: true })).toBeVisible();
  await expect(page.getByText("sekolah.admin.all", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Kelola akun PJ/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Periode & override lock/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Broadcast/ })).toHaveCount(0);
});

test("lupa password generik, local sink sekali, reset, dan replay invalid", async ({ page }) => {
  await page.goto("/admin/lupa-password");
  await page.getByLabel("Email akun Sekolah").fill("superadmin.e2e@example.test");
  await page.getByRole("button", { name: "Minta instruksi reset" }).click();
  await expect(page.getByRole("status")).toContainText("Jika akun terdaftar dan aktif");
  await expect.poll(async () => (await readdir(emailSink)).filter((file) => file.endsWith(".json")).length).toBe(1);
  const file = (await readdir(emailSink)).find((item) => item.endsWith(".json")) as string;
  const payload = JSON.parse(await readFile(path.join(emailSink, file), "utf8")) as { resetUrl: string };
  await page.goto(payload.resetUrl);
  await page.getByLabel("Password baru", { exact: true }).fill(changedPassword);
  await page.getByLabel("Ulangi password baru", { exact: true }).fill(changedPassword);
  await page.getByRole("button", { name: "Simpan password baru" }).click();
  await expect(page).toHaveURL(/\/admin\/login\?reason=reset-success$/u, { timeout: 15_000 });
  await page.goto(payload.resetUrl);
  await expect(page.getByText(/tidak valid atau sudah digunakan/i)).toBeVisible();
});

test("session expired, logout, dan raw Better Auth endpoint ditangani aman", async ({ page, request }) => {
  await login(page, "superadmin.e2e@example.test");
  await expect(page).toHaveURL(/\/admin\/ganti-password$/u, { timeout: 15_000 });
  await pool.query(`UPDATE sessions SET "absoluteExpiresAt"=now() - interval '1 minute' WHERE "userId"=$1`, [E2E_ADMIN_ID]);
  await page.goto("/admin/dashboard");
  await expect(page).toHaveURL(/\/admin\/login\?reason=session_expired$/u);
  await expect(page.getByText("Sesi berakhir. Silakan login kembali.")).toBeVisible();

  const raw = await request.post("/api/auth/sign-in/email", { data: { email: "x", password: "x" } });
  expect(raw.status()).toBe(404);
  const csrf = await request.post("/api/admin/auth/login", { data: { email: "x", password: "x" } });
  expect(csrf.status()).toBe(403);
});

test("open redirect ditolak dan logout current session kembali ke login", async ({ page }) => {
  await pool.query(`UPDATE users SET "mustChangePassword"=false WHERE id=$1`, [E2E_ADMIN_ID]);
  await page.goto("/admin/login?next=https://evil.example/steal");
  await page.getByLabel("Email akun Sekolah").fill("superadmin.e2e@example.test");
  await page.getByLabel("Password", { exact: true }).fill(E2E_TEMPORARY_PASSWORD);
  await page.getByRole("button", { name: "Masuk ke ruang kerja" }).click();
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 15_000 })
    .toMatch(/^\/admin\/(?:ganti-password|dashboard)$/u);
  await expect(page).not.toHaveURL(/evil\.example/u);
  if (new URL(page.url()).pathname === "/admin/ganti-password") {
    await page.getByLabel("Password sementara/saat ini", { exact: true }).fill(E2E_TEMPORARY_PASSWORD);
    await page.getByLabel("Password baru", { exact: true }).fill(changedPassword);
    await page.getByLabel("Ulangi password baru", { exact: true }).fill(changedPassword);
    await page.getByRole("button", { name: "Ganti password" }).click();
  }
  await expect(page).toHaveURL(/\/admin\/dashboard$/u, { timeout: 15_000 });
  await page.getByRole("button", { name: "Logout sesi ini" }).click();
  await expect(page).toHaveURL(/\/admin\/login\?reason=logout$/u);
});
