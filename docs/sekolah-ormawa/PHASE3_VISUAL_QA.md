# Visual QA Phase 3

## Hasil

PASS pada 2026-08-02 (Asia/Jakarta). Pengujian menggunakan periode, peserta, prodi, Birdep, file, dan consent sintetis. Fixture dihapus dari database test setelah inspeksi; tidak ada data atau layanan production.

## Cakupan viewport dan state

| Artefak | Viewport | State yang diperiksa | Hasil |
|---|---:|---|---|
| `docs/artifacts/phase-3/step-1-360x800.jpg` | 360x800 | Identitas, progress, indikator/hapus draft | PASS |
| `docs/artifacts/phase-3/step-2-390x844.jpg` | 390x844 | Dua pilihan Birdep dan motivasi | PASS |
| `docs/artifacts/phase-3/step-3-upload-768x1024.jpg` | 768x1024 | CV/foto/KTM, status file privat, nama/ukuran | PASS |
| `docs/artifacts/phase-3/step-4-medbrand-768x1024.jpg` | 768x1024 | Portofolio conditional dan URL HTTPS | PASS |
| `docs/artifacts/phase-3/step-5-review-1440x900.jpg` | 1440x900 | Review, versi consent `DRAFT`, submit | PASS |
| `docs/artifacts/phase-3/success-1440x900.jpg` | 1440x900 | Bukti nomor, nama, waktu, pilihan, print | PASS |
| `docs/artifacts/phase-3/validation-error-390x844.jpg` | 390x844 | Error summary dan field errors | PASS |
| `docs/artifacts/phase-3/confirmation-invalid-390x844.jpg` | 390x844 | Token invalid/kedaluwarsa | PASS |
| `docs/artifacts/phase-3/period-closed-360x800.jpg` | 360x800 | State fail-closed tanpa form | PASS |

## Pemeriksaan interaksi dan aksesibilitas

- Semua lima langkah diperiksa dengan navigasi maju/mundur; data teks tidak hilang.
- Upload progress diperiksa saat request berlangsung melalui `role=progressbar`, lalu status berubah menjadi "Upload privat tervalidasi" dan review menampilkan nama/ukuran.
- State Medbrand dihitung ulang saat pilihan berubah dan menampilkan requirement portofolio untuk posisi Pilihan 1 maupun Pilihan 2.
- Error summary menerima focus setelah submit step yang invalid dan menyediakan link ke field bermasalah.
- Form dapat dijalankan dengan keyboard; input file memiliki accessible label, tombol memakai semantic button, dan focus-visible tersedia.
- Tidak ditemukan overflow halaman pada empat viewport. Progress step mobile dapat digeser tanpa menambah overflow dokumen; scrollbar visual disembunyikan.
- Reduced motion, satu heading utama per page, label form, semantic landmark, dan print stylesheet diperiksa.
- Console browser final tidak memuat error atau warning.
- DOM success/review tidak memuat object key maupun link file publik; request ke path storage publik mendapat 404 dan endpoint private tanpa signature/owner mendapat 401.

## Catatan visual

Bahasa visual editorial-institusional Phase 2 dipertahankan: latar kertas, marun, aksen emas, display serif, garis grid, dan komposisi folio. Landing tidak didesain ulang; perubahan hanya menghubungkan status CTA ke release gate server dan route form.

Seluruh nama, nomor, periode, URL, dan dokumen pada artefak adalah fixture sintetis. Artifact tidak boleh dipakai sebagai pengumuman resmi.
