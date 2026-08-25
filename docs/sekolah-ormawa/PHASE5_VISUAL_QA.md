# Phase 5 Visual QA

## Status

PASS — 2026-08-11 (Asia/Jakarta)

Audit dilakukan pada `next dev` (Turbopack) lokal dengan database development dan tiga kandidat sintetis yang disisipkan manual untuk kebutuhan tampilan (lihat `RUNBOOK.md`). Production build (`next build`) sudah diverifikasi lulus terpisah sebelum audit ini; komponen dan CSS yang dirender identik antara mode dev dan production. Tidak ada akun, credential, kandidat, atau deployment production yang digunakan.

## Cakupan

| Viewport | Route/state | Pemeriksaan | Hasil |
|---|---|---|---|
| 390x844 | `/admin/dashboard` tab Pilihan utama (DEPT_PJ) | identity header, tab count, list row, empty/loaded state | PASS |
| 390x844 | `/admin/dashboard` tab Terkunci Birdep ini | kandidat locked-by-own-department tampil; tidak ada kandidat locked-by-other | PASS |
| 390x844 | `/admin/dashboard` pencarian "Ahmad" | filter search real-time, hasil tepat satu kandidat | PASS |
| 390x844 | `/admin/dashboard/kandidat/[id]` | identitas, pilihan Birdep, esai, dokumen, status pill, catatan Birdep (kosong) | PASS |
| 390x844 | `/admin/dashboard/kandidat/[id]` setelah tambah catatan | catatan tersimpan, atribusi pembuat + "(Anda)", timestamp | PASS |
| 360x800 | `/admin/dashboard` (DEPT_PJ) | tidak ada horizontal overflow, tab wrap, card mobile layout | PASS |
| 1440x900 | `/admin/dashboard` (DEPT_PJ) | layout desktop, context card 3 kolom, tab dengan count | PASS |
| 768x1024 | `/admin/dashboard` (SUPER_ADMIN) | department switcher, scope "Seluruh organisasi", tab count reset per Birdep terpilih | PASS |

## Fungsional yang turut terbukti selama audit visual

- Segmentasi primary/secondary/locked menghitung benar per Birdep (RISTEK: 1/1/1 sesuai fixture; Internal via Super Admin: 0/0/0 sebelum Birdep dipilih ulang).
- Pencarian, tab switching, dan penyimpanan catatan berjalan end-to-end lewat route HTTP asli (`/api/admin/candidates*`), bukan hanya lewat pemanggilan fungsi server pada test otomatis.
- File viewer CV (`api/admin/candidates/[id]/files/[fileId]`) tampil sebagai tautan berlabel nama file asli pada kartu Dokumen.
- Department switcher Super Admin memuat ulang data melalui fetch client-side tanpa reload halaman penuh.

## State dan accessibility

- Tab menggunakan `role="tab"`/`aria-selected`; status pill dan ikon lock memakai `aria-hidden` pada elemen dekoratif.
- Label pencarian dan form catatan memiliki accessible name (`aria-label`/`<label>` terhubung), termasuk label tersembunyi (`sr-only`) pada textarea catatan.
- Tidak ada horizontal overflow pada 360, 390, 768, atau 1440 dalam pemeriksaan visual.
- Console browser tidak memuat error pada route yang diaudit di luar log HMR/Fast Refresh milik dev server itu sendiri.

## Artefak

Folder: `docs/artifacts/phase-5/`

- `dashboard-pj-primary-390x844.png`
- `dashboard-pj-locked-390x844.png`
- `dashboard-pj-search-390x844.png`
- `candidate-detail-390x844.png`
- `candidate-notes-390x844.png`
- `dashboard-pj-360x800.png`
- `dashboard-pj-1440x900.png`
- `dashboard-superadmin-768x1024.png`

## Bug ditemukan dan diperbaiki selama audit ini

1. **E2E outdated assertion**: `tests/e2e/auth.spec.ts` masih menegaskan placeholder shell Phase 4 (`Identitas terverifikasi`, `Tidak ada kandidat, statistik...`) yang sudah digantikan konten Dashboard PJ. Diperbaiki ke assertion Phase 5 (`Dashboard PJ`, teks `phase-boundary-note`); 6/6 test `auth.spec.ts` PASS setelah perbaikan.
2. **False alarm operasional (bukan bug kode)**: pengujian manual awal sempat menunjukkan `404` palsu pada route API baru karena dua proses skrip Playwright yang tidak dibersihkan dari percobaan sebelumnya membombardir dev server Turbopack yang sama secara bersamaan saat route sedang dikompilasi on-demand. Tidak ada perubahan kode; setelah proses liar dihentikan dan server di-restart bersih, seluruh route (`POST .../notes` dan lainnya) merespons normal (`201`/`200`).

## Catatan reproduksi

1. Gunakan hanya database development dan fixture sintetis (bukan `TEST_DATABASE_URL`, karena visual QA butuh data yang terlihat lewat browser, bukan hanya integration test).
2. Jalankan migration dan seed (`npm run db:seed`).
3. Sisipkan kandidat sintetis secukupnya untuk mengisi ketiga segmen (lihat contoh SQL pada riwayat sesi kerja; tidak disertakan sebagai skrip permanen agar tidak tercampur dengan seed resmi).
4. Jalankan `npm run dev`, login sebagai `pj.ristek.fixture@sekolah.local` atau `superadmin.fixture@sekolah.local`.
5. Audit state di atas, lalu hapus kandidat sintetis dan jalankan ulang `npm run db:seed` untuk mengembalikan credential fixture ke nilai `.env` terdokumentasi.
