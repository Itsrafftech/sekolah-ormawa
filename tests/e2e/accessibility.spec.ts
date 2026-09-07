import { randomUUID } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { Pool } from "pg";

import { hashPassword } from "@/lib/auth/password";
import {
  E2E_ADMIN_ID,
  E2E_DEPARTMENT_A,
  E2E_PERIOD_ID,
  E2E_PJ_ID,
} from "./global-setup";

// Phase 8 P4: WCAG 2.1 AA accessibility pass across every main route, plus
// dedicated keyboard-navigation/focus-visibility smoke checks. Runs against
// the same E2E fixtures as auth.spec.ts/registration.spec.ts but keeps its
// own password/candidate setup so it does not depend on execution order
// relative to those files.
const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) throw new Error("TEST_DATABASE_URL wajib untuk E2E accessibility.");
const pool = new Pool({ connectionString });
const password = "Synthetic-A11y-Passphrase-63!";
let candidateId = "";

test.beforeAll(async () => {
  const passwordHash = await hashPassword(password);
  await pool.query(
    `UPDATE users SET "mustChangePassword"=false, banned=false, "isActive"=true, "sessionVersion"=0 WHERE id IN ($1, $2)`,
    [E2E_ADMIN_ID, E2E_PJ_ID],
  );
  await pool.query(`UPDATE accounts SET password=$1 WHERE "userId" IN ($2, $3)`, [passwordHash, E2E_ADMIN_ID, E2E_PJ_ID]);

  candidateId = randomUUID();
  await pool.query(
    `INSERT INTO candidates
      (id, "periodId", "registrationNumber", name, nim, "normalizedNim", "cohortCode", "entryYear", "className", "studyProgram", phone, email, "normalizedEmail", domicile, "essayOrgExperience", "essayContribution", "essayBalance", status, "submittedAt", "updatedAt", track, "paymentCode", "paymentAmount")
     VALUES ($1, $2, 'REG-A11Y01', 'Kandidat Aksesibilitas', 'NIM-A11Y01', 'NIM-A11Y01', 63, 2026, 'Kelas AX', $3, '081200000002', 'a11y-candidate@example.test', 'a11y-candidate@example.test', 'Kota Fixture', 'Sintetis', 'Sintetis', 'Sintetis', 'SUBMITTED', now(), now(), 'EXECUTIVE', '001', 15001)
     ON CONFLICT (id) DO NOTHING`,
    [candidateId, E2E_PERIOD_ID, "Program Studi Sintetis E2E"],
  );
  await pool.query(
    `INSERT INTO candidate_choices (id, "candidateId", "departmentId", rank, motivation, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 'PRIMARY', 'Motivasi sintetis aksesibilitas', now(), now())
     ON CONFLICT DO NOTHING`,
    [randomUUID(), candidateId, E2E_DEPARTMENT_A],
  );
});

test.afterAll(async () => {
  await pool.query(`DELETE FROM candidate_choices WHERE "candidateId"=$1`, [candidateId]);
  await pool.query(`DELETE FROM candidates WHERE id=$1`, [candidateId]);
  await pool.end();
});

// This spec logs in repeatedly (once per route/test) from what the LOGIN
// rate limiter sees as a single IP, which would otherwise trip both this
// app's own limiter and Better Auth's built-in one well before the file
// finishes. Clear the counters before every test, same as auth.spec.ts.
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

const a11yTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

// .site-footer__marquee is a repeating, aria-hidden="true" brand-slogan
// ticker rendered purely as background visual texture (see
// src/components/public/site-footer.tsx) - the same words appear in the
// page's normal-contrast content, so it carries no unique information.
// WCAG 2.1 SC 1.4.3 explicitly exempts "pure decoration" text from the
// contrast requirement; axe-core cannot infer that intent automatically, so
// it is excluded here rather than force-brightened, which would defeat the
// element's purpose. Reviewed and recorded in PHASE8_VISUAL_QA.md.
const decorativeExclusions = [".site-footer__marquee"];

async function scanRoute(page: Page, path: string) {
  await page.goto(path);
  const results = await new AxeBuilder({ page }).withTags(a11yTags).exclude(decorativeExclusions).analyze();
  const summary = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    nodes: violation.nodes.map((node) => node.target.join(" ")),
  }));
  expect(summary, `Pelanggaran WCAG 2.1 AA pada ${path}: ${JSON.stringify(summary, null, 2)}`).toEqual([]);
}

test.describe("WCAG 2.1 AA - rute publik", () => {
  for (const path of ["/", "/daftar", "/tentang", "/faq", "/departemen", "/kebijakan-privasi"]) {
    test(`tidak ada pelanggaran pada ${path}`, async ({ page }) => {
      await scanRoute(page, path);
    });
  }
});

test.describe("WCAG 2.1 AA - rute admin publik (belum login)", () => {
  for (const path of ["/admin/login", "/admin/lupa-password"]) {
    test(`tidak ada pelanggaran pada ${path}`, async ({ page }) => {
      await scanRoute(page, path);
    });
  }
});

test.describe("WCAG 2.1 AA - dashboard PJ", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "pj.e2e@example.test");
  });

  for (const path of ["/admin/dashboard"]) {
    test(`tidak ada pelanggaran pada ${path} (PJ)`, async ({ page }) => {
      await scanRoute(page, path);
    });
  }

  test("tidak ada pelanggaran pada detail kandidat (PJ)", async ({ page }) => {
    await scanRoute(page, `/admin/dashboard/kandidat/${candidateId}`);
  });
});

test.describe("WCAG 2.1 AA - dashboard Super Admin", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "superadmin.e2e@example.test");
  });

  for (const path of [
    "/admin/dashboard",
    "/admin/dashboard/akun",
    "/admin/dashboard/periode",
    "/admin/dashboard/broadcast",
  ]) {
    test(`tidak ada pelanggaran pada ${path} (Super Admin)`, async ({ page }) => {
      await scanRoute(page, path);
    });
  }
});

async function expectVisibleFocusRing(page: Page) {
  const style = await page.evaluate(() => {
    const element = document.activeElement;
    if (!element || element === document.body) return null;
    const computed = window.getComputedStyle(element);
    return { outlineStyle: computed.outlineStyle, outlineWidth: computed.outlineWidth, boxShadow: computed.boxShadow };
  });
  expect(style, "Tidak ada elemen fokus setelah Tab").not.toBeNull();
  const hasOutline = style!.outlineStyle !== "none" && style!.outlineWidth !== "0px";
  const hasBoxShadow = style!.boxShadow !== "none";
  expect(hasOutline || hasBoxShadow, `Elemen fokus tidak punya indikator visual: ${JSON.stringify(style)}`).toBe(true);
}

test.describe("Navigasi keyboard dan focus state", () => {
  test("landing page: Tab menuju elemen interaktif pertama menampilkan focus ring", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    await expectVisibleFocusRing(page);
    await page.keyboard.press("Tab");
    await expectVisibleFocusRing(page);
  });

  test("form pendaftaran: Tab ke input pertama menampilkan focus ring", async ({ page }) => {
    await page.goto("/daftar");
    await page.getByLabel("Nama lengkap").focus();
    await expectVisibleFocusRing(page);
  });

  test("admin login: Tab ke field email dan tombol submit menampilkan focus ring", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email akun Sekolah").focus();
    await expectVisibleFocusRing(page);
    await page.getByRole("button", { name: "Masuk ke ruang kerja" }).focus();
    await expectVisibleFocusRing(page);
  });

  test("dashboard Super Admin: navigasi utama dapat dicapai dan diaktifkan lewat keyboard", async ({ page }) => {
    // Drive the whole flow via real keyboard input (not .focus()/.click()):
    // Chromium's :focus-visible heuristic tracks the last input modality, and
    // a programmatic .focus() right after a mouse .click() (as loginAs()
    // uses for the axe scans above) does not count as keyboard interaction.
    await page.goto("/admin/login");
    await page.getByLabel("Email akun Sekolah").fill("superadmin.e2e@example.test");
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Masuk ke ruang kerja" }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/admin\/dashboard/u, { timeout: 15_000 });

    let reached = false;
    for (let i = 0; i < 40 && !reached; i += 1) {
      await page.keyboard.press("Tab");
      reached = await page.evaluate(() => document.activeElement?.textContent?.includes("Kelola akun PJ") ?? false);
    }
    expect(reached, "Tidak dapat mencapai link 'Kelola akun PJ' lewat Tab").toBe(true);
    await expectVisibleFocusRing(page);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/admin\/dashboard\/akun$/u, { timeout: 15_000 });
  });
});

test.describe("Gambar dan label form", () => {
  test("semua <img> pada rute publik utama punya atribut alt", async ({ page }) => {
    for (const path of ["/", "/daftar", "/tentang", "/departemen"]) {
      await page.goto(path);
      const missingAlt = await page.evaluate(() =>
        Array.from(document.querySelectorAll("img"))
          .filter((img) => !img.hasAttribute("alt"))
          .map((img) => img.getAttribute("src")),
      );
      expect(missingAlt, `<img> tanpa alt pada ${path}: ${JSON.stringify(missingAlt)}`).toEqual([]);
    }
  });

  test("semua input form pendaftaran punya accessible name", async ({ page }) => {
    await page.goto("/daftar");
    const unlabelled = await page.evaluate(() => {
      const controls = Array.from(document.querySelectorAll("input, select, textarea"))
        .filter((element) => (element as HTMLInputElement).type !== "hidden");
      return controls
        .filter((element) => {
          const id = element.getAttribute("id");
          const hasLabel = id && document.querySelector(`label[for="${id}"]`);
          const hasAriaLabel = element.hasAttribute("aria-label") || element.hasAttribute("aria-labelledby");
          const wrappedByLabel = element.closest("label") !== null;
          return !hasLabel && !hasAriaLabel && !wrappedByLabel;
        })
        .map((element) => element.outerHTML.slice(0, 120));
    });
    expect(unlabelled, `Input tanpa label pada /daftar: ${JSON.stringify(unlabelled, null, 2)}`).toEqual([]);
  });
});
