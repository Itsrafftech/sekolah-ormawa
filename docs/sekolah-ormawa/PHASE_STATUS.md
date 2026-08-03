# Status Implementasi Sekolah Ormawa

## Ringkasan fase

| Fase | Nama | Status | Tanggal | Catatan |
|---:|---|---|---|---|
| 0 | Discovery, audit, dan kontrak standalone | PASS WITH NOTES | 2026-08-01 | Direvisi sesuai Opsi A; blocker produk tersisa tercatat |
| 1 | Fondasi aplikasi dan data model | PASS | 2026-08-01 | Seluruh acceptance criteria Phase 1 terpenuhi |
| 2 | Landing page | PASS | 2026-08-01 | Kanal publik, CTA server-side, SEO, responsive/accessibility, dan visual QA selesai; baseline disetujui |
| 3 | Pendaftaran dan upload | PASS | 2026-08-02 | Form, private development upload, submit idempotent, confirmation, outbox, dan visual QA selesai; menunggu approval Phase 4 |
| 4 | Auth internal dan authorization | PASS | 2026-08-03 | Auth/session/reset/guard backend dan visual QA selesai; menunggu approval Phase 5 |
| 5 | Dashboard PJ | NOT STARTED | - | Phase gate |
| 6 | Lock/unlock dan placement | NOT STARTED | - | Phase gate |
| 7 | Super Admin dan operasional | NOT STARTED | - | Phase gate |
| 8 | Hardening, QA, UAT, deployment readiness | NOT STARTED | - | Phase gate |

# Hasil Phase 0 - Discovery, Audit, dan Finalisasi Kontrak Standalone

## Status

PASS WITH NOTES

## Ringkasan hasil

- Arsitektur final adalah aplikasi dan repository standalone pada workspace kanonis.
- Database PostgreSQL, private storage, migration, environment, deployment, dan siklus rilis sepenuhnya mandiri.
- Auth internal menjadi scope MVP; SSO Nexus dipindahkan ke future scope.
- Model roles, users, department scope, sessions, reset tokens, rate limit, dan audit telah dirancang.
- Supabase Storage private bucket direkomendasikan untuk dokumen kandidat.
- Traceability dan test matrix telah disesuaikan dengan auth internal.
- Tidak ada aplikasi, migration, dependency, akun, secret, atau fitur Phase 1 yang dibuat.

## Perubahan utama

- `IMPLEMENTATION_PLAN.md`: arsitektur standalone, struktur repository, auth internal, tabel, storage, dan migration plan.
- `DECISIONS.md`: keputusan Opsi A final, environment contract, storage, dan blocker tersisa.
- `PHASE_STATUS.md`: status dan acceptance criteria terbaru.
- `TEST_MATRIX.md`: test auth internal dan scope PJ menggantikan test SSO.
- `RUNBOOK.md`: operasi mandiri untuk auth, database, storage, backup, dan incident handling.

## Kondisi working tree

- Repository kanonis telah ditetapkan di `C:\Users\rafii\OneDrive\Documents\projectan\sekolah-ormawa`.
- Folder tersebut belum dikenali sebagai Git working tree; remote, branch, dan baseline commit belum tersedia.
- Kondisi ini bukan lagi keputusan arsitektur, tetapi pekerjaan fondasi/version-control setelah approval.
- Perubahan tetap terbatas pada lima dokumen Phase 0.

## Acceptance criteria terbaru

| Kriteria | Status | Bukti |
|---|---|---|
| Arsitektur standalone final terdokumentasi | PASS | `IMPLEMENTATION_PLAN.md` |
| Repository kanonis dan struktur target ditetapkan | PASS | Bagian identitas dan struktur repository |
| Model auth internal lengkap | PASS | Alur login/reset/revoke dan guard backend |
| Role `SUPER_ADMIN`/`DEPT_PJ` serta scope wajib | PASS | Permission matrix dan constraint tabel users |
| Users, roles, sessions, reset token, department scope dirancang | PASS | Rancangan tabel auth |
| Environment variable disusun tanpa nilai secret | PASS | `DECISIONS.md` |
| Private storage direkomendasikan | PASS | Supabase private bucket dan guardrail |
| Requirement dipetakan ke fase 1-8 | PASS | Traceability dan `TEST_MATRIX.md` |
| Pertanyaan blocking dipisahkan | PASS | `DECISIONS.md` |
| Tidak ada asumsi runtime monorepo/shared auth/SSO MVP | PASS | Audit konsistensi dokumen |
| Tidak ada implementasi Phase 1+ | PASS | Workspace hanya berisi dokumen Phase 0 |

## Verifikasi yang dijalankan

| Pemeriksaan | Hasil |
|---|---|
| Pencarian seluruh asumsi arsitektur lama | PASS; diganti dengan Opsi A/future scope |
| Validasi lima file dan heading laporan | PASS |
| Validasi model tabel auth serta constraint department scope | PASS |
| Validasi daftar environment tanpa nilai secret | PASS |
| Validasi traceability fase 1-8 dan lima permission minimum | PASS |
| Validasi tidak ada file aplikasi/migration baru | PASS |

Build, lint, dan test aplikasi tidak dijalankan karena Phase 1 belum dimulai.

## Migration dan konfigurasi

- Tidak ada migration dijalankan.
- Tidak ada dependency dipasang.
- Tidak ada `.env` atau secret dibuat.
- Database target adalah PostgreSQL dedicated untuk Sekolah, bukan database Nexus-Tevo.

## Risiko, asumsi, dan technical debt

- Git remote/branch dan baseline commit belum tersedia.
- Master Birdep, prodi, kuota, periode, eligibility, dan kebijakan data belum final.
- Provider storage direkomendasikan tetapi project/owner belum disetujui.
- Parameter Argon2id dan session/rate-limit harus dibenchmark dan ditinjau sebelum Phase 4 dinyatakan selesai.
- Distribusi temporary password berisiko; link reset satu kali lebih disukai ketika kanal email tersedia.

## Cara saya memeriksa hasil

1. Buka `IMPLEMENTATION_PLAN.md` dan tinjau arsitektur, struktur repository, auth, tabel, serta storage.
2. Buka `DECISIONS.md` dan konfirmasi ADR final serta blocker produk.
3. Pastikan `TEST_MATRIX.md` menguji Argon2id, forced password, reset, revoke, disable, rate limit, dan scope tampering.
4. Pastikan tidak ada source aplikasi, migration, atau dependency baru.

## Keputusan yang dibutuhkan

- Konfirmasi data organisasi/periode/eligibility dan kebijakan privasi sebelum Phase 1 dianggap siap secara produk.
- Persetujuan provider/owner storage dan email sebelum fitur terkait diaktifkan.
- Tidak ada keputusan monorepo atau SSO yang tersisa untuk MVP.

## Batas fase

Phase 0 telah disetujui melalui keputusan eksplisit pemilik proyek. Riwayat hasil di atas dipertahankan sebagai baseline arsitektur.

# Hasil Phase 1 - Fondasi Aplikasi dan Data Model

## Status

PASS

## Ringkasan hasil

- Repository standalone diinisialisasi pada branch `main` tanpa remote; root repository langsung menjadi root aplikasi.
- Next.js 16.2.7, React 19, TypeScript strict, Tailwind CSS 4, komponen UI dasar, ESLint, dan Vitest telah dikonfigurasi.
- Better Auth 1.6.25 dipilih dan dicatat pada ADR sebelum migration dibuat; password memakai Argon2id melalui `@node-rs/argon2`.
- Schema Prisma 7.9.1 mencakup auth, role/permission, department scope, recruitment config, kandidat, private upload metadata, catatan, lock, placement, audit, idempotency, rate limit, dan email outbox.
- Dua migration development dibuat dan seluruhnya berhasil diterapkan dari nol pada PostgreSQL development kosong.
- Seed sintetis idempotent menghasilkan role/permission, 13 unit referensi `DRAFT`, periode Angkatan 63 `DRAFT`, satu prodi fixture, dan dua akun fixture individual.
- Endpoint `/api/health` dan `/api/readiness` merespons HTTP 200 pada production build lokal; readiness melaporkan database `ready`.
- Tidak ada akun/credential nyata, database/bucket/email/deployment production, atau migration production yang dibuat.

## Perubahan utama

- Root configuration: `package.json`, TypeScript, Next.js, Tailwind/PostCSS, ESLint, Vitest, Prisma, `.gitignore`, dan `.env.example`.
- Application foundation: layout/root placeholder, editorial institutional design tokens, komponen status/card, auth engine/guard, health, dan readiness.
- Data foundation: `prisma/schema.prisma`, dua migration SQL, seed sintetis, PostgreSQL Docker development, dan integration test constraint.
- Documentation: ADR autentikasi, implementation plan, runbook, test matrix, dan status fase diperbarui sesuai hasil aktual.

## Acceptance criteria Phase 1

| Kriteria | Status | Bukti |
|---|---|---|
| Root repository menjadi root aplikasi standalone | PASS | Next.js berjalan langsung dari repository kanonis |
| Git hanya diinisialisasi bila belum ada; tanpa remote | PASS | Branch `main`, no commits, remote kosong |
| TypeScript strict, styling, dan komponen dasar | PASS | Config dan foundation UI; typecheck/build lulus |
| Auth library Next.js 16 dievaluasi dan dicatat sebagai ADR | PASS | ADR-015 sampai ADR-017; Better Auth 1.6.25 |
| Argon2id dan auth security extension points tersedia | PASS | Custom hash/verify, forced-password field, ban, revoke, reset TTL, DB rate limit, role/scope guard |
| Schema dan migration development tersedia | PASS | Prisma schema valid; dua migration additive |
| Migration berhasil pada database development kosong | PASS | Seluruh migration diterapkan ke `sekolah_ormawa_phase1_clean` |
| Role/department constraint diuji | PASS | DEPT_PJ tanpa scope dan Super Admin dengan scope ditolak PostgreSQL |
| NIM/email per periode diuji | PASS | Unique constraint integration test |
| Pilihan Birdep berbeda diuji | PASS | Candidate/department unique integration test |
| IPK diuji | PASS | Check 0.00-4.00 integration test |
| Satu active lock diuji | PASS | Partial unique index integration test |
| Seed sintetis dapat dijalankan ulang | PASS | Dua eksekusi berurutan berhasil tanpa duplikasi |
| `.env.example` non-secret dan artefak sensitif di-ignore | PASS | Blank secret placeholders; `.env`, key/PEM, local DB, upload/storage, build di-ignore |
| Health/readiness endpoint tersedia | PASS | HTTP 200; readiness PostgreSQL `ready` |
| Lint, typecheck, test, dan production build lulus | PASS | 0 lint error, typecheck pass, 7 unit + 8 integration pass, build pass |
| Tidak membuat fitur atau layanan di luar Phase 1 | PASS | Landing lengkap, form, dashboard, storage/email/deploy production belum dibuat |

## Verifikasi yang dijalankan

| Pemeriksaan | Hasil |
|---|---|
| `prisma validate` dan client generation | PASS |
| Migration pada database development utama | PASS |
| Reproducibility pada database development kosong baru | PASS; dua migration dari nol |
| Seed sintetis dijalankan dua kali | PASS |
| ESLint | PASS; 0 error/warning |
| TypeScript strict | PASS |
| Unit test | PASS; 7/7 |
| Integration test PostgreSQL | PASS; 8/8 |
| Next.js production build | PASS |
| Runtime root/health/readiness | PASS; HTTP 200, database ready |
| Audit mojibake dokumentasi/source | PASS; tidak ada pola encoding rusak yang tersisa |
| Git remote audit | PASS; tidak ada remote |

## Migration dan konfigurasi

- Migration `20260801110915_init` membuat schema dan domain constraints.
- Migration `20260801112500_normalized_user_email` menambah unique index email akun yang case/whitespace-insensitive.
- Database development utama dan test memakai PostgreSQL lokal; database kosong khusus pembuktian dibuat tanpa menghapus data lain.
- Reset destruktif tidak dijalankan setelah Prisma meminta consent eksplisit.
- `.env` lokal hanya berisi konfigurasi development sintetis dan di-ignore; `.env.example` tidak berisi secret.

## Risiko, asumsi, dan technical debt

- Nama produk, tahun masuk, data Birdep resmi/penerima, kuota, prodi, jadwal, prefix, eligibility, Pilihan 2, unlock, consent, privasi, dan retensi tetap `DRAFT`/blocking sebelum publikasi terkait.
- Better Auth foundation sudah tersedia, tetapi login UI, forced-password workflow end-to-end, email reset, lifecycle admin, serta full authorization endpoint tetap Phase 4/7.
- Parameter Argon2id, session, reset, rate limit, proxy IP, dan data retention perlu benchmark/risk review sebelum production readiness.
- Supabase private bucket baru rancangan; project/bucket/credential production belum dibuat.
- Inspeksi visual melalui browser bawaan tidak dapat dimulai karena pembatasan akses profil aplikasi lokal; runtime HTML dan endpoint tetap diverifikasi melalui HTTP lokal.
- Git belum memiliki baseline commit atau remote karena tidak diminta.

## Cara memeriksa hasil

1. Ikuti setup development pada `README.md` dan `RUNBOOK.md`.
2. Jalankan `npm run db:validate`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:integration`, dan `npm run build`.
3. Jalankan production build lokal dan periksa `/`, `/api/health`, serta `/api/readiness`.
4. Tinjau `DECISIONS.md` untuk ADR auth dan `TEST_MATRIX.md` untuk traceability test.

## Batas fase

Phase 1 telah disetujui. Riwayat hasil di atas dipertahankan sebagai baseline fondasi.

# Hasil Phase 2 - Landing Page Publik

## Status

PASS

## Ringkasan hasil

- Landing publik bergaya editorial-institusional selesai dengan hero, organisasi, program, direktori Birdep, pengalaman, galeri abstrak, placeholder testimoni, dua timeline, FAQ, CTA, dan footer.
- Route `/`, `/tentang`, `/departemen`, `/faq`, dan `/kebijakan-privasi` tersedia dengan metadata, canonical, Open Graph, sitemap, dan robots.
- Status CTA dibaca dan diputuskan server-side dari `RecruitmentPeriod`; periode fixture `DRAFT` tidak menampilkan link form aktif.
- Direktori mengambil 13 unit dari master database dan membedakan profil unit dari slot pendaftaran. BPH serta semua fixture `acceptsApplications=false` tidak ditampilkan sebagai terbuka.
- Semua fakta, jadwal, kontak, testimoni, kebijakan, dan visual yang belum disetujui diberi label `DRAFT`/placeholder; tidak ada lorem ipsum atau klaim rekaan.
- Requirement portofolio Media Branding tampil pada profil dan FAQ. Kontrak, evaluasi `FileUpload`, proposed `CandidatePortfolio`, traceability Phase 3/5, dan 12 skenario test telah didokumentasikan tanpa migration.
- Tidak ada form final, login admin, dashboard PJ, data kandidat, bucket, credential, database/migration production, Git remote, commit, atau deployment.

## Route dan sumber data

| Route/section | Sumber | Kondisi data |
|---|---|---|
| `/` hero, program, pengalaman, galeri, testimoni, timeline, FAQ, footer | `src/content/public-site.ts` | Content-in-code berstatus `DRAFT`; placeholder eksplisit |
| `/` CTA pendaftaran | `RecruitmentPeriod` via `src/lib/public/recruitment.ts` | Keputusan server-side; fixture periode `DRAFT` menjadi `UPCOMING` tanpa href |
| `/departemen` dan preview landing | `Department` + `PeriodDepartment` | 13 master unit database; availability hanya aktif untuk periode OPEN/ACTIVE |
| `/tentang` | Content-in-code | Definisi/manfaat/hak/kewajiban sementara berlabel `DRAFT` |
| `/faq` | Content-in-code | Termasuk requirement Media Branding; bukan kebijakan final |
| `/kebijakan-privasi` | Struktur content-in-code | `DRAFT`, bukan nasihat/kebijakan legal final |

## Acceptance criteria Phase 2

| Kriteria | Status | Bukti |
|---|---|---|
| Semua section dan route publik wajib tersedia | PASS | Lima route dan checklist konten landing |
| Mobile-first, visual khas, dan Bahasa Indonesia | PASS | Sistem editorial marun/kertas/emas; visual QA empat viewport |
| Tidak overflow pada lebar 360px | PASS | Browser DOM metric dan screenshot 360x800 |
| Navigasi mobile keyboard-accessible | PASS | Button semantics, Enter/Space, `aria-expanded`, focus-visible |
| CTA berasal dari server/database | PASS | `getPublicRecruitmentData` dan unit test resolver status |
| Periode DRAFT/closed tidak membuka form | PASS | `href=null`, disabled CTA, nol link `/daftar` |
| Direktori berasal dari master data | PASS | 13 kartu dari query Department/PeriodDepartment |
| BPH/non-penerima tidak dianggap terbuka | PASS | Status kartu “Profil unit”; nol slot aktif pada fixture |
| Tidak ada candidate/secret leak | PASS | Query publik terbatas; inspeksi HTML/DOM dan env boundary |
| Metadata/OG/sitemap/robots tersedia | PASS | Route metadata dan generated assets; robots noindex saat DRAFT |
| Loading, empty, error state tersedia | PASS | App loading/error dan state direktori |
| Accessibility dasar/reduced motion | PASS | Semantic landmarks, heading, focus, alt/aria, contrast, reduced motion |
| Lint, typecheck, unit, integration, build | PASS | 0 lint error; 14 unit + 8 integration; build Next 16.2.7 |
| Visual QA diwajibkan sebelum PASS | PASS | `PHASE2_VISUAL_QA.md` dan enam screenshot lokal |
| Portfolio Media Branding tercatat tanpa form | PASS | `PORTFOLIO_MEDBRAND_REQUIREMENTS.md`, FAQ/profil, 12 test planned |

## Verifikasi yang dijalankan

| Pemeriksaan | Hasil |
|---|---|
| ESLint | PASS; 0 error/warning |
| TypeScript strict | PASS |
| Unit test | PASS; 5 file, 14/14 |
| Integration test PostgreSQL | PASS; 1 file, 8/8 |
| Next.js production build | PASS; 5 route publik, OG, sitemap, robots |
| Visual QA 360x800, 390x844, 768x1024, 1440x900 | PASS |
| DOM/semantic/overflow/closed CTA/data leak checks | PASS |
| Audit mojibake source/dokumentasi | PASS; tidak ada pola encoding rusak |

## Artefak visual

Folder lokal: `docs/artifacts/phase-2/`

- `home-360x800.png`
- `mobile-menu-390x844.png`
- `faq-390x844.png`
- `departments-768x1024.png`
- `home-1440x900.png`
- `footer-1440x900.png`

## Schema dan migration

- Tidak ada perubahan schema atau migration pada Phase 2.
- `FileUpload` cukup untuk metadata file private, tetapi belum mewakili URL/deskripsi/urutan portofolio.
- Model `CandidatePortfolio` hanya proposal untuk ADR/migration Phase 3 setelah desain draft final; detail ada pada `PORTFOLIO_MEDBRAND_REQUIREMENTS.md`.
- Tidak ada migration production yang dijalankan.

## Placeholder dan keputusan belum final

- Nama produk, deskripsi organisasi/program, manfaat, hak/kewajiban, durasi, pengalaman, galeri, testimoni, timeline, jadwal, kuota, prodi, eligibility, kontak, sosial media, privacy/consent/retention, serta copy portofolio resmi tetap `DRAFT`.
- Tahun masuk Angkatan 63 tidak di-hard-code.
- Konfigurasi periode/availability tetap sumber kebenaran; data fixture tidak boleh dipublikasikan sebagai informasi resmi.
- Konfigurasi/policy portofolio production, penyimpanan, preview URL, retensi, dan akses PJ masih blocking untuk Phase 3/5.

## Cara memeriksa hasil

1. Ikuti setup lokal pada `README.md`, jalankan database, seed, dan production build.
2. Buka lima route publik dan ikuti langkah reproduksi pada `PHASE2_VISUAL_QA.md`.
3. Jalankan lint, typecheck, unit test, integration test, dan build.
4. Ubah fixture periode hanya di database development untuk menguji resolver OPEN/UPCOMING/CLOSED; jangan menjalankan reset destruktif.
5. Tinjau `TEST_MATRIX.md` dan `PORTFOLIO_MEDBRAND_REQUIREMENTS.md` sebelum menyusun schema Phase 3.

## Batas fase

Phase 2 telah disetujui. Riwayat hasil di atas dipertahankan sebagai baseline kanal publik.

# Hasil Phase 3 - Pendaftaran, Private Upload, dan Konfirmasi

## Status

PASS

## Ringkasan hasil

- `/daftar` menyediakan lima langkah: identitas, pilihan Birdep, dokumen, esai/portofolio bersyarat, serta review/consent.
- Draft `localStorage` hanya menyimpan teks dengan period/schema/expiry, debounce 900 ms dan penyimpanan maksimum setiap 30 detik. File, upload reference, dan consent aktif tidak disimpan.
- Adapter storage development/test menyimpan object secara privat di folder ignored, sedangkan interface Supabase private storage tersedia tanpa credential atau bucket production.
- Submit memvalidasi kembali periode, master prodi/Birdep, eligibility, upload, dan portofolio; transaksi serializable menghasilkan kandidat, pilihan, nomor registrasi atomik, audit minimal, confirmation token, idempotency record, serta email outbox.
- `/daftar/sukses` hanya membaca token acak yang di-hash dan berumur pendek, bukan candidate ID atau nomor registrasi.
- Email sink development dan worker retry idempotent tersedia. Kegagalan provider setelah commit tidak membatalkan pendaftaran.
- Release gate default `false`, periode seed `DRAFT`, dan consent fixture berlabel `DRAFT`; pendaftaran production tidak dibuka.

## Schema dan migration

- Migration additive `20260802001000_registration_phase3` menambahkan enum `PORTFOLIO`, tipe item portfolio, aksi audit `SUBMIT`, `CandidatePortfolio`, `RegistrationConfirmation`, relasi period-upload, dan ciphertext result pada idempotency record.
- Check database memastikan item portfolio memiliki tepat satu sumber FILE atau EXTERNAL_LINK.
- Constraint Phase 1 untuk unique NIM/email per periode tetap menjadi guard konkurensi utama; sequence registration period dinaikkan dalam transaksi.
- Ketiga migration berhasil diterapkan berurutan pada database development kosong `sekolah_ormawa_phase3_clean`. Tidak ada migration production.

## Acceptance criteria Phase 3

| Kriteria | Status |
|---|---|
| Form lima langkah, kembali tanpa kehilangan teks, dan progress aksesibel | PASS |
| Prodi/Birdep/periode berasal dari database/configuration | PASS |
| Normalisasi server, IPK, pilihan berbeda, motivasi, esai, eligibility | PASS |
| CV/foto/KTM tervalidasi extension, MIME, magic byte, size, checksum, ownership/finalize | PASS |
| Portofolio conditional untuk Medbrand pada Pilihan 1 atau 2 | PASS |
| Draft aman, dapat dihapus, expiry/schema/period aware, consent reset | PASS |
| Review menampilkan seluruh data, dokumen, esai, portfolio, dan consent version | PASS |
| Storage privat development/test dan kontrak Supabase tersedia | PASS |
| Submit idempotent/transaksional, sequence atomik, audit, outbox | PASS |
| Success token acak/short-lived dan bukti dapat dicetak | PASS |
| Email sink/worker retry idempotent tanpa email nyata | PASS |
| 23 skenario wajib, visual QA, accessibility dasar, dan public-file negative | PASS |
| Lint, strict typecheck, unit, integration, E2E, dan production build | PASS |
| Migration kosong dan seed idempotent | PASS |
| Tidak ada login/dashboard/production resource/deployment | PASS |

## Verifikasi yang dijalankan

| Pemeriksaan | Hasil |
|---|---|
| Prisma schema | PASS; valid |
| Migration database kosong | PASS; 3 migration pada `sekolah_ormawa_phase3_clean` |
| Seed idempotency | PASS; dua eksekusi berurutan |
| ESLint | PASS; tanpa warning |
| TypeScript strict | PASS |
| Unit test | PASS; 7 file, 25 test |
| Integration PostgreSQL | PASS; 2 file, 23 test |
| E2E Playwright | PASS; 6 test |
| Production build | PASS; Next.js 16.2.12, seluruh route publik/registrasi/API terkompilasi |
| Runtime smoke | PASS; health/readiness HTTP 200, form tidak dirender pada fixture/gate tertutup |
| Visual QA | PASS; 9 artifact pada 360x800, 390x844, 768x1024, 1440x900 |
| Secret/mojibake/public file audit | PASS; secret kosong/ignored, tidak ada pola mojibake, public path 404 |
| Dependency audit | PASS WITH NOTE; advisori framework dipatch ke 16.2.12, 3 high transitive Next.js masih terbuka dan dicatat sebagai risiko |

## Placeholder yang tetap blocking production

- Consent/privacy/retention resmi, eligibility, prodi, periode, jadwal, prefix, kuota, serta master penerima belum disetujui.
- Project/owner Supabase, bucket private, RLS/access policy, backup, malware/content scanning, dan retention object belum dibuat.
- Provider email, sender domain/template, volume, retry/alert ownership, serta cron scheduler belum dipilih.
- Instruction tahap berikutnya, kanal kontak, dan copy publik tetap `DRAFT`.
- Release gate tidak boleh diaktifkan pada production sebelum semua konfigurasi tersebut final dan Phase 8 selesai.

## Risiko dan technical debt

- Next.js dinaikkan dari 16.2.7 ke 16.2.12 untuk menutup advisori framework yang tersedia pada patch. Audit npm masih melaporkan tiga high pada `postcss@8.4.31` dan `sharp@0.34.5` yang dibundel Next.js; pemaksaan override lintas versi tidak dilakukan. Wajib dipantau dan di-upgrade saat patch kompatibel tersedia sebelum production.
- Adapter Supabase, provider email nyata, scheduler job, malware/content scanning, object backup, dan observability masih berupa kontrak/configuration point.
- HMAC download saat ini melindungi owner draft development. Policy role/department untuk PJ baru dapat ditambahkan setelah auth Phase 4 dan dashboard Phase 5.
- URL portfolio sengaja tidak di-fetch untuk menghindari SSRF. Availability, safety, dan lifecycle link tetap risiko operasional yang perlu policy.
- Draft browser bukan backup server; pergantian perangkat/browser atau clear storage menghapus draft teks, dan file selalu perlu dipilih ulang.

## Batas fase

Phase 4 belum dimulai. Auth UI, login, forced-password workflow, dashboard PJ/Super Admin, resource production, dan deployment tidak dibuat. Pekerjaan berhenti setelah laporan Phase 3 dan menunggu approval eksplisit pemilik proyek.

# Hasil Phase 4 - Auth Internal, Session Lifecycle, dan Authorization

## Status

PASS WITH PRODUCTION BLOCKER

## Ringkasan hasil

- Better Auth `1.6.25` tetap menjadi engine internal credential/database session dan password memakai Argon2id (`64 MiB`, time cost `3`, parallelism `1`).
- Login admin memiliki error generik, rate limit atomik berbasis HMAC email+IP, account disable/ban check, CSRF/origin check, dan audit yang tidak menyimpan password/cookie/token/raw IP.
- Session memiliki cookie host-only `HttpOnly`, `SameSite=Lax`, `Secure` pada production, absolute expiry, idle timeout, session version, logout current, dan revoke-all.
- Temporary password memiliki expiry dan forced-password guard. Change password memverifikasi password lama, menolak password sama/truncation, mencabut session lama, serta menerbitkan session baru.
- Reset memakai token acak yang hanya disimpan sebagai hash, single-use, ber-TTL, invalid pada replay/expired, tidak auto-login, dan mencabut seluruh session.
- Guard backend memvalidasi status akun, role, permission, dan department scope. `DEPT_PJ` hanya mendapat scope Birdep session; resource luar scope menjadi 404.
- Route login, ganti/lupa/reset password, unauthorized, dan shell dashboard identity/permission selesai. Kandidat/statistik/lock/catatan/export/account management tidak dibuat.
- Registration gate tetap `false`; tidak ada akun, credential, email, bucket, database, migration, atau deployment production.

## Schema dan migration

- Migration additive `20260803001000_auth_phase4` menambah `users.isActive`, user/session version, absolute expiry, `auth_rate_limits`, `password_reset_tokens`, audit actions, index, check, dan FK.
- Empat migration Phase 1-4 berhasil diterapkan dari nol pada database development kosong `sekolah_ormawa_phase4_clean`.
- Migration production tidak dijalankan.

## Route Phase 4

| Route | Fungsi |
|---|---|
| `/admin/login` | Login internal individual |
| `/admin/ganti-password` | Forced dan voluntary password change |
| `/admin/lupa-password` | Request reset generik |
| `/admin/reset-password` | Inspect/consume token single-use |
| `/admin/tidak-berwenang` | State 403 tanpa detail sensitif |
| `/admin/dashboard` | Shell identity, role, scope, permission; tanpa fitur Phase 5 |
| `/api/admin/auth/*` | API policy aplikasi untuk login/session/logout/revoke/change/reset |
| `/api/auth/*` | Ditutup 404 untuk mencegah bypass policy aplikasi |

## Acceptance criteria Phase 4

| Kriteria | Status |
|---|---|
| Better Auth terawat dan kompatibel Next.js 16.2.12 | PASS |
| Argon2id, random salt, password boundary, tanpa truncation | PASS |
| Login generik dan rate limit atomik/concurrency-safe | PASS |
| Cookie secure attributes dan session tidak bocor ke body/log | PASS |
| Absolute/idle expiry, logout, revoke current/all, session version | PASS |
| Temporary password expiry dan forced-password route guard | PASS |
| Change password mencabut/merotasi session | PASS |
| Reset hash token, single-use, expired/replay invalid, revoke sessions | PASS |
| Account inactive/banned ditolak segera | PASS |
| SUPER_ADMIN tanpa department; DEPT_PJ wajib satu department | PASS |
| Permission/scope divalidasi backend; outside-scope 404 | PASS |
| CSRF/origin, open redirect, CSP, no-store, clickjacking/nosniff header | PASS |
| Audit redacted untuk login/reset/change/revoke/denied | PASS |
| Minimum 30 skenario auth/security terverifikasi | PASS; 29 test auth khusus dengan boundary/role/origin variants >30 case |
| Loading/error/unauthorized/expired state dan keyboard/accessibility dasar | PASS |
| Visual QA empat viewport dan console browser bersih | PASS |
| Migration database kosong, seed dua kali, lint/typecheck/test/build | PASS |
| Tidak ada fitur Phase 5 atau resource/deployment production | PASS |

## Verifikasi

| Pemeriksaan | Hasil |
|---|---|
| Prisma migration development utama dan kosong | PASS; 4 migration |
| Seed sintetis idempotent | PASS; dua eksekusi |
| ESLint | PASS |
| TypeScript strict | PASS |
| Unit test | PASS; 8 file, 29 test |
| Integration PostgreSQL | PASS; 3 file, 42 test |
| E2E Playwright | PASS; 12 test termasuk 6 auth dan 6 regresi registrasi |
| Production build | PASS; Next.js 16.2.12, seluruh route Phase 1-4 terkompilasi |
| Production runtime smoke | PASS; health/readiness 200, forced-password redirect, Secure/HttpOnly/SameSite/host-only cookie, CSP tanpa unsafe-eval, registration gate tertutup |
| Visual QA | PASS; 6 artefak, empat viewport |
| Dependency audit | BLOCKER; 3 high transitif Next.js, tanpa safe compatible fix |

## Keputusan dan blocker tersisa

- Tiga advisori high transitif pada PostCSS/Sharp yang dibundel Next.js tetap menjadi production release blocker; downgrade breaking/override paksa tidak dilakukan.
- Risk review final diperlukan untuk timeout session/reset/rate-limit, proxy IP trust, HMAC secret 32+ karakter production, monitoring, dan incident ownership.
- Identitas Super Admin awal serta kanal aman onboarding/reset perlu disetujui sebelum UAT akun nyata.
- Seluruh blocker produk/privasi/storage/email/deployment Phase 3 tetap berlaku.
- Lifecycle UI akun oleh Super Admin tetap Phase 7; helper backend disable/revoke tersedia, tetapi tidak ada account management UI pada Phase 4.

## Batas fase

Phase 5 belum dimulai. Tidak ada daftar/detail kandidat, filter/search, file viewer PJ, catatan, lock, export, atau dashboard operasional. Pekerjaan berhenti setelah laporan Phase 4 dan menunggu approval eksplisit pemilik proyek.
