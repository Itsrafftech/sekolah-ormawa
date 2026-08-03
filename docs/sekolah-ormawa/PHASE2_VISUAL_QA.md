# Visual dan Accessibility QA Phase 2

## Ringkasan

QA dilakukan pada production build lokal dengan data seed sintetis. Screenshot disimpan di `docs/artifacts/phase-2/` dan di-ignore dari Git agar hasil runtime tidak menjadi source aplikasi.

| Viewport | Route/fokus | Hasil | Artefak |
|---|---|---|---|
| 360x800 | Landing, hero, CTA tertutup/DRAFT | PASS; tidak ada overflow/layout shift awal | `home-360x800.png` |
| 390x844 | Navigasi mobile dan FAQ | PASS; tombol menu berlabel dan dapat dioperasikan keyboard | `mobile-menu-390x844.png`, `faq-390x844.png` |
| 768x1024 | Direktori departemen | PASS; 13 kartu, status profil/slot berbeda, info Media Branding terlihat | `departments-768x1024.png` |
| 1440x900 | Landing desktop dan footer | PASS; hierarki editorial, CTA server-side, footer lengkap | `home-1440x900.png`, `footer-1440x900.png` |

## Pemeriksaan terukur

- `documentElement.scrollWidth <= clientWidth` pada seluruh viewport yang diuji.
- Tepat satu `h1` per route utama; tidak ada duplicate `id` atau loncatan heading pada landing.
- Landmark header/nav/main/footer dan skip link tersedia.
- Navigasi mobile menggunakan tombol dengan `aria-controls`, `aria-expanded`, accessible name, serta focus-visible.
- Status registrasi seed adalah `UPCOMING` karena periodenya `DRAFT`; jumlah tautan aktif menuju form adalah nol.
- Direktori memuat 13 unit dan nol label slot aktif pada fixture; BPH tetap tampil sebagai profil, bukan penerima pendaftaran.
- Tidak ada image eksternal/copyright; visual dibuat dengan CSS/code dan ikon.
- Tidak ada teks/field kandidat pada HTML publik.
- `prefers-reduced-motion` mematikan animasi/transisi non-esensial.
- Loading, error, dan empty state tersedia untuk route dinamis.

## Kontras token utama

Palet menggunakan teks gelap di atas kertas terang serta putih di atas marun gelap. Pemeriksaan browser pada pasangan utama memenuhi rasio WCAG AA untuk teks normal. Focus ring memiliki kontras yang terlihat pada permukaan terang dan gelap.

## Langkah reproduksi manual

1. Jalankan PostgreSQL development dan production build lokal.
2. Buka `/`, `/tentang`, `/departemen`, `/faq`, dan `/kebijakan-privasi`.
3. Uji 360x800, 390x844, 768x1024, dan 1440x900 tanpa horizontal scroll.
4. Pada 390x844, fokuskan tombol Menu lalu tekan Enter dan Space; pastikan `aria-expanded` berubah dan seluruh link dapat ditab.
5. Periksa hero, direktori, FAQ, CTA pendaftaran, dan footer.
6. Pastikan periode `DRAFT` tidak menghasilkan link `/daftar` dan teks sementara tetap berlabel `DRAFT`.

## Batas QA Phase 2

- Belum ada form pendaftaran, login, dashboard, atau upload untuk diuji.
- Screenshot adalah bukti lokal dan bukan aset produksi.
- Audit accessibility otomatis penuh dan UAT pengguna tetap diulangi pada Phase 8; pemeriksaan Phase 2 mencakup acceptance route publik saat ini.
