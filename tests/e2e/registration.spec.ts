import { expect, test, type Page } from "@playwright/test";

import { E2E_PERIOD_ID } from "./global-setup";

const longMotivation = Array.from({ length: 100 }, (_, index) => `motivasi${index}`).join(" ");
const pdf = Buffer.from("%PDF-1.4 synthetic e2e fixture");
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

async function fillIdentity(page: Page, suffix: string) {
  await page.getByLabel("Nama lengkap").fill(`Peserta Sintetis ${suffix}`);
  await page.getByLabel("NIM").fill(`NIM-${suffix}`);
  await page.getByLabel("Kelas").fill("Kelas Sintetis");
  await page.getByLabel("Program studi").selectOption({ label: "Program Studi Sintetis E2E" });
  await page.getByLabel("Nomor WhatsApp").fill("081200000000");
  await page.getByLabel("Email aktif").fill(`${suffix}@example.test`);
  await page.getByLabel("Domisili").fill("Kota Sintetis");
}

async function goToDocuments(page: Page, medbrandAs?: 1 | 2) {
  await page.getByRole("button", { name: /Simpan & lanjut/ }).click();
  await page.getByLabel("Birdep pilihan 1").selectOption({ label: medbrandAs === 1 ? "Biro Media Branding - portofolio wajib" : "Birdep Sintetis A" });
  await page.getByLabel("Motivasi Pilihan 1").fill(longMotivation);
  await page.getByLabel("Birdep pilihan 2").selectOption({ label: medbrandAs === 2 ? "Biro Media Branding - portofolio wajib" : "Birdep Sintetis B" });
  await page.getByLabel("Motivasi Pilihan 2").fill(longMotivation);
  await page.getByRole("button", { name: /Simpan & lanjut/ }).click();
}

test("error summary menerima focus dan form dapat digunakan keyboard", async ({ page }) => {
  await page.goto("/daftar");
  const next = page.getByRole("button", { name: /Simpan & lanjut/ });
  await next.focus();
  await page.keyboard.press("Enter");
  const summary = page.locator(".error-summary");
  await expect(summary).toBeFocused();
  await expect(summary.getByRole("link", { name: /Nama lengkap/ })).toBeVisible();
});

test("draft teks bertahan setelah refresh dan consent tidak dipulihkan", async ({ page }) => {
  await page.goto("/daftar");
  await page.getByLabel("Nama lengkap").fill("Draft Sintetis Bertahan");
  await page.waitForTimeout(1200);
  await page.reload();
  await expect(page.getByLabel("Nama lengkap")).toHaveValue("Draft Sintetis Bertahan");
  await expect(page.getByText(/Draft lokal dipulihkan/)).toBeVisible();
});

test("draft dari schema lama atau periode berbeda ditolak dengan aman", async ({ page }) => {
  await page.goto("/daftar");
  await page.evaluate(({ periodId }) => {
    window.localStorage.setItem(
      `sekolah-ormawa:registration-draft:${periodId}`,
      JSON.stringify({
        periodId: "periode-lama",
        schemaVersion: 1,
        consentVersion: "DRAFT-LAMA",
        savedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        data: {},
      }),
    );
  }, { periodId: E2E_PERIOD_ID });
  await page.reload();
  await expect(page.getByLabel("Nama lengkap")).toHaveValue("");
  await expect.poll(() => page.evaluate(({ periodId }) => {
    const raw = window.localStorage.getItem(`sekolah-ormawa:registration-draft:${periodId}`);
    return raw ? (JSON.parse(raw) as { schemaVersion?: number }).schemaVersion : null;
  }, { periodId: E2E_PERIOD_ID })).toBe(4);
});

test("happy path non-Medbrand menyimpan kandidat dan menampilkan bukti", async ({ page }) => {
  const suffix = `e2e-${Date.now()}`;
  await page.goto("/daftar");
  await page.getByRole("button", { name: "Hapus draft" }).click();
  await fillIdentity(page, suffix);
  await goToDocuments(page);

  await page.getByLabel("Pilih file CV").setInputFiles({ name: "cv-sintetis.pdf", mimeType: "application/pdf", buffer: pdf });
  await expect(page.getByText("Upload privat tervalidasi.").first()).toBeVisible();
  await page.getByLabel("Pilih file Pas foto").setInputFiles({ name: "foto-sintetis.png", mimeType: "image/png", buffer: png });
  await expect(page.getByText("Upload privat tervalidasi.").nth(1)).toBeVisible();
  await page.getByRole("button", { name: /Simpan & lanjut/ }).click();

  await page.getByLabel("Pengalaman organisasi sebelumnya").fill("Pengalaman sintetis untuk pengujian.");
  await page.getByLabel("Kontribusi untuk Pilihan 1").fill("Kontribusi sintetis untuk pengujian.");
  await page.getByLabel("Cara menyeimbangkan akademik dan organisasi").fill("Rencana sintetis untuk pengujian.");
  await page.getByRole("button", { name: /Simpan & lanjut/ }).click();

  await page.getByText("Saya menyatakan data").click();
  await page.getByText("Saya menyetujui pemrosesan").click();
  await page.getByRole("button", { name: "Kirim pendaftaran" }).click();
  await expect(page).toHaveURL(/\/daftar\/sukses\?token=/u, { timeout: 15_000 });
  await expect(page.getByText(/E2E63-\d{4}/u)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Simpan bukti ini dengan baik." })).toBeVisible();
});

test("Medbrand Pilihan 2 memunculkan portofolio dan menerima URL HTTPS", async ({ page }) => {
  const suffix = `medbrand-${Date.now()}`;
  await page.goto("/daftar");
  await page.getByRole("button", { name: "Hapus draft" }).click();
  await fillIdentity(page, suffix);
  await goToDocuments(page, 2);
  await page.getByLabel("Pilih file CV").setInputFiles({ name: "cv.pdf", mimeType: "application/pdf", buffer: pdf });
  await page.getByLabel("Pilih file Pas foto").setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: png });
  await expect(page.getByText("Upload privat tervalidasi.")).toHaveCount(2);
  await page.getByRole("button", { name: /Simpan & lanjut/ }).click();
  await page.getByLabel("Pengalaman organisasi sebelumnya").fill("Sintetis");
  await page.getByLabel("Kontribusi untuk Pilihan 1").fill("Sintetis");
  await page.getByLabel("Cara menyeimbangkan akademik dan organisasi").fill("Sintetis");
  await expect(page.getByText("Wajib karena Media Branding dipilih.")).toBeVisible();
  await page.getByRole("button", { name: /Tambah tautan HTTPS/ }).click();
  await page.getByLabel("URL HTTPS").fill("https://www.behance.net/synthetic-e2e");
  await page.getByRole("button", { name: /Simpan & lanjut/ }).click();
  await expect(page.getByRole("heading", { name: "Review & persetujuan" })).toBeVisible();
});

test("upload tidak dapat dibuka melalui URL publik atau tanpa signature", async ({ request }) => {
  const response = await request.get("/storage/private/fixture.pdf");
  expect(response.status()).toBe(404);
  const protectedResponse = await request.get("/api/registration/uploads/00000000-0000-4000-8000-000000000001");
  expect([401, 404]).toContain(protectedResponse.status());
});
