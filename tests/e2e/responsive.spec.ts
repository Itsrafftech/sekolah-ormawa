import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";
import { Pool } from "pg";

import { hashPassword } from "@/lib/auth/password";
import {
  E2E_ADMIN_ID,
  E2E_DEPARTMENT_A,
  E2E_PERIOD_ID,
  E2E_PJ_ID,
  E2E_STUDY_PROGRAM,
} from "./global-setup";

// Phase 8 P4: responsive visual pass at 360px (mobile), 768px (tablet), and
// 1280px (desktop) across every main route. Asserts no horizontal overflow
// (the objective, automatable signal) and saves a screenshot per
// route/viewport for manual visual review, matching earlier phases'
// PHASE{N}_VISUAL_QA.md documentation pattern.
const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) throw new Error("TEST_DATABASE_URL wajib untuk E2E responsive.");
const pool = new Pool({ connectionString });
const password = "Synthetic-Responsive-Passphrase-63!";
const screenshotRoot = path.resolve(process.cwd(), "docs", "artifacts", "phase-8", "responsive");
let candidateId = "";

test.beforeAll(async () => {
  await mkdir(screenshotRoot, { recursive: true });
  const passwordHash = await hashPassword(password);
  await pool.query(
    `UPDATE users SET "mustChangePassword"=false, banned=false, "isActive"=true, "sessionVersion"=0 WHERE id IN ($1, $2)`,
    [E2E_ADMIN_ID, E2E_PJ_ID],
  );
  await pool.query(`UPDATE accounts SET password=$1 WHERE "userId" IN ($2, $3)`, [passwordHash, E2E_ADMIN_ID, E2E_PJ_ID]);

  candidateId = randomUUID();
  await pool.query(
    `INSERT INTO candidates
      (id, "periodId", "registrationNumber", name, nim, "normalizedNim", "cohortCode", "entryYear", "className", "studyProgramId", phone, email, "normalizedEmail", domicile, "essayOrgExperience", "essayContribution", "essayBalance", status, "submittedAt", "updatedAt", track)
     VALUES ($1, $2, 'REG-RESP01', 'Kandidat Responsif', 'NIM-RESP01', 'NIM-RESP01', 63, 2026, 'Kelas RX', $3, '081200000003', 'responsive-candidate@example.test', 'responsive-candidate@example.test', 'Kota Fixture', 'Sintetis', 'Sintetis', 'Sintetis', 'SUBMITTED', now(), now(), 'EXECUTIVE')
     ON CONFLICT (id) DO NOTHING`,
    [candidateId, E2E_PERIOD_ID, E2E_STUDY_PROGRAM],
  );
  await pool.query(
    `INSERT INTO candidate_choices (id, "candidateId", "departmentId", rank, motivation, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 'PRIMARY', 'Motivasi sintetis responsif', now(), now())
     ON CONFLICT DO NOTHING`,
    [randomUUID(), candidateId, E2E_DEPARTMENT_A],
  );
});

test.afterAll(async () => {
  await pool.query(`DELETE FROM candidate_choices WHERE "candidateId"=$1`, [candidateId]);
  await pool.query(`DELETE FROM candidates WHERE id=$1`, [candidateId]);
  await pool.end();
});

// See accessibility.spec.ts: this file also logs in repeatedly from what
// the LOGIN rate limiter sees as a single IP across viewports/roles.
test.beforeEach(async () => {
  await pool.query(`TRUNCATE TABLE auth_rate_limits, rate_limits RESTART IDENTITY CASCADE`);
});

async function loginAs(page: Page, email: string) {
  await page.goto("/admin/login");
  await page.getByLabel("Email akun Sekolah").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Masuk ke ruang kerja" }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard/u, { timeout: 15_000 });
}

const viewports = [
  { label: "mobile-360", width: 360, height: 800 },
  { label: "tablet-768", width: 768, height: 1024 },
  { label: "desktop-1280", width: 1280, height: 900 },
];

async function checkNoOverflowAndScreenshot(page: Page, routeLabel: string, viewportLabel: string) {
  // Let in-flight client fetches (e.g. the candidate list's "Memuat
  // kandidat..." loading state) settle before measuring/capturing, so the
  // screenshot reflects the resolved layout rather than a loading skeleton.
  await page.waitForLoadState("networkidle").catch(() => undefined);
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(
    overflow.scrollWidth,
    `Horizontal overflow pada ${routeLabel} @ ${viewportLabel}: scrollWidth=${overflow.scrollWidth} > clientWidth=${overflow.clientWidth}`,
  ).toBeLessThanOrEqual(overflow.clientWidth + 1);
  await page.screenshot({
    path: path.join(screenshotRoot, `${routeLabel.replaceAll("/", "_") || "root"}__${viewportLabel}.png`),
    fullPage: true,
  });
}

for (const viewport of viewports) {
  test.describe(`Responsif @ ${viewport.label}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test(`rute publik tanpa horizontal overflow (${viewport.label})`, async ({ page }) => {
      for (const routePath of ["/", "/daftar", "/tentang", "/faq", "/departemen", "/kebijakan-privasi"]) {
        await page.goto(routePath);
        await checkNoOverflowAndScreenshot(page, routePath, viewport.label);
      }
    });

    test(`rute admin publik tanpa horizontal overflow (${viewport.label})`, async ({ page }) => {
      for (const routePath of ["/admin/login", "/admin/lupa-password"]) {
        await page.goto(routePath);
        await checkNoOverflowAndScreenshot(page, routePath, viewport.label);
      }
    });

    test(`dashboard PJ tanpa horizontal overflow (${viewport.label})`, async ({ page }) => {
      await loginAs(page, "pj.e2e@example.test");
      await checkNoOverflowAndScreenshot(page, "/admin/dashboard-pj", viewport.label);
      await page.goto(`/admin/dashboard/kandidat/${candidateId}`);
      await checkNoOverflowAndScreenshot(page, "/admin/dashboard/kandidat/detail", viewport.label);
    });

    test(`dashboard Super Admin tanpa horizontal overflow (${viewport.label})`, async ({ page }) => {
      await loginAs(page, "superadmin.e2e@example.test");
      for (const routePath of [
        "/admin/dashboard",
        "/admin/dashboard/akun",
        "/admin/dashboard/periode",
        "/admin/dashboard/broadcast",
      ]) {
        await page.goto(routePath);
        await checkNoOverflowAndScreenshot(page, routePath, viewport.label);
      }
    });
  });
}
