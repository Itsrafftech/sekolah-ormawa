# Status Implementasi Sekolah Ormawa

## Ringkasan fase

| Fase | Nama | Status | Tanggal | Catatan |
|---:|---|---|---|---|
| 0 | Discovery, audit, dan kontrak standalone | PASS WITH NOTES | 2026-08-01 | Direvisi sesuai Opsi A; blocker produk tersisa tercatat |
| 1 | Fondasi aplikasi dan data model | PASS | 2026-08-01 | Seluruh acceptance criteria Phase 1 terpenuhi |
| 2 | Landing page | PASS | 2026-08-01 | Kanal publik, CTA server-side, SEO, responsive/accessibility, dan visual QA selesai; baseline disetujui |
| 3 | Pendaftaran dan upload | PASS | 2026-08-02 | Form, private development upload, submit idempotent, confirmation, outbox, dan visual QA selesai; menunggu approval Phase 4 |
| 4 | Auth internal dan authorization | PASS | 2026-08-03 | Auth/session/reset/guard backend dan visual QA selesai; menunggu approval Phase 5 |
| 5 | Dashboard PJ | PASS | 2026-08-11 | List tersegmentasi, detail, catatan terisolasi, file viewer, dan visual QA selesai; menunggu approval Phase 6 |
| 6 | Lock/unlock dan placement | PASS | 2026-08-11 | Lock/unlock atomik, race 50 lock, placement, dan visual QA selesai; menunggu approval Phase 7 |
| 7 | Super Admin dan operasional | PASS | 2026-08-11 | Akun PJ, periode, override lock, soft-delete/restore, export, broadcast, dan visual QA selesai; menunggu approval Phase 8 |
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

# Hasil Phase 5 - Dashboard PJ

## Status

PASS

## Ringkasan hasil

- Dashboard PJ menggantikan shell placeholder Phase 4 di `/admin/dashboard`: identitas/permission tetap ditampilkan, ditambah kandidat tersegmentasi (pilihan utama/pilihan kedua/terkunci Birdep ini) dengan pencarian dan cursor pagination stabil.
- Halaman detail kandidat baru (`/admin/dashboard/kandidat/[id]`) menampilkan identitas, pilihan Birdep, esai, dokumen, portofolio, status lock, dan catatan Birdep.
- Catatan Birdep (create/update/soft-delete) terisolasi per Birdep — bukan per pembuat — dan tercatat di audit log.
- File viewer (CV/foto/KTM/portofolio) diautorisasi ulang di setiap request lewat session role/scope backend (bukan owner-token HMAC ala Fase 3), dan setiap akses berhasil menulis audit `FILE_VIEW` (nilai enum baru, migration additive).
- `SUPER_ADMIN` dapat meninjau kandidat lintas Birdep lewat department switcher (satu Birdep per waktu); overview lintas-Birdep penuh tetap Phase 7.
- Kandidat yang sudah dikunci Birdep lain hilang total dari dashboard Birdep lain (keputusan eksplisit pemilik proyek sebelum implementasi dimulai) — diverifikasi lewat integration test dan otomatis benar secara struktural karena segmen primary/secondary hanya menyertakan status `SUBMITTED`.
- Tidak ada fitur lock/unlock, placement, export, broadcast, atau manajemen akun/periode yang dibuat.

## Perubahan utama

| File/modul | Tujuan perubahan |
|---|---|
| `prisma/schema.prisma`, migration `20260810180707_candidate_dashboard_phase5` | Tambah nilai enum `AuditAction.FILE_VIEW` untuk audit trail akses dokumen kandidat |
| `src/lib/env.ts` | Validasi `STORAGE_SIGNED_URL_TTL_SECONDS` (sudah ada di `.env.example`, belum divalidasi) |
| `src/server/auth/guard.ts`, `src/server/auth/errors.ts` | `requireDepartmentAccess` (SUPER_ADMIN lintas Birdep, DEPT_PJ terkunci ke Birdep sendiri, 404 di luar scope); kode error `VALIDATION_ERROR` baru |
| `src/server/auth/audit.ts` | `writeAuditLog` generik (entityType/department/before-after) menggantikan hardcoded `entityType: "AUTH"`; `writeAuthAudit` jadi thin wrapper, perilaku lama tidak berubah |
| `src/features/candidates/{contracts,validation}.ts` | Tipe DTO dan validasi zod untuk query list (segment/search/cursor/sort/department) dan body catatan |
| `src/server/candidates/{scope,list,detail,notes,files,departments,period,request-scope}.ts` | Domain logic: query tersegmentasi + cursor pagination, resolusi scope kandidat/departemen, CRUD catatan + audit, file viewer + audit, resolusi periode dashboard |
| `src/app/api/admin/{candidates,departments}/**/route.ts` (7 route) | List, detail, notes (list/create/update/soft-delete), file viewer, daftar Birdep untuk switcher |
| `src/app/admin/dashboard/page.tsx`, `src/app/admin/dashboard/kandidat/[id]/page.tsx` | Dashboard tersegmentasi dan halaman detail kandidat |
| `src/components/admin/{candidate-dashboard,notes-panel}.tsx` | Client component: tab segmen, search debounce, pagination, CRUD catatan |
| `src/components/ui/status-pill.tsx` (CSS) | Menambahkan CSS `.status-pill` yang sebelumnya belum ada (komponen sudah dibuat Fase 1 tapi tidak pernah distyle/dipakai) |
| `src/app/globals.css` | Style dashboard, detail kandidat, dan notes panel mengikuti sistem desain editorial yang sudah ada |
| `tests/unit/candidate-validation.test.ts`, `tests/integration/candidate-dashboard.test.ts` | 14 unit test + 14 integration test baru untuk F5-01 s.d. F5-04 dan CRUD catatan |
| `tests/e2e/auth.spec.ts` | Assertion shell Phase 4 yang sudah digantikan diperbarui ke konten Dashboard PJ |

## Acceptance criteria

| Kriteria | Status | Bukti |
|---|---|---|
| PJ-01: Dashboard/list/detail/search/filter/file viewer | PASS | `src/app/admin/dashboard/**`, `tests/integration/candidate-dashboard.test.ts` (F5-01, F5-03, F5-04) |
| PJ-02: Catatan scoped per Birdep | PASS | `src/server/candidates/notes.ts`, test "catatan Birdep terisolasi" |
| PJ-03: Preview/download portofolio hanya PJ berwenang + Super Admin | PASS | `src/server/candidates/files.ts` berlaku sama untuk semua `UploadKind` termasuk `PORTFOLIO` |
| F5-01: Segmentasi primary/secondary/locked, ordering stabil | PASS | `getCandidateSegmentCounts`/`listCandidatesForDepartment`, 3 integration test |
| F5-02: Isolasi data/catatan, 404 di luar scope | PASS | `findScopedCandidateId`, `requireDepartmentAccess`, 4 integration test |
| F5-03: File viewer authorization server, tanpa URL publik | PASS | `readScopedCandidateFile` + audit `FILE_VIEW`, 3 integration test |
| F5-04: Search/filter/cursor whitelist sort | PASS | `parseCandidateListQuery`, keyset pagination, 2 integration test |
| Otorisasi selalu di server/database, bukan hanya UI | PASS | Semua route memanggil `requireAuthenticatedUser`+`requirePermission`+`requireDepartmentAccess` sebelum query database |
| Operasi sensitif punya audit trail | PASS | `FILE_VIEW`, `CREATE`/`UPDATE`/`SOFT_DELETE` pada `DEPARTMENT_NOTE` |
| TypeScript strict, tanpa `any` tanpa alasan | PASS | `npx tsc --noEmit` 0 error; tidak ada `any` baru |
| Validasi client dan server | PASS | Zod di `features/candidates/validation.ts` (server) + kontrol native form (client) |
| Visual QA 4 viewport | PASS | `PHASE5_VISUAL_QA.md`, 8 artefak `docs/artifacts/phase-5/` |
| Lint, typecheck, unit, integration, E2E, build | PASS | Lihat verifikasi di bawah |
| Tidak ada fitur Phase 6/7 (lock/unlock, akun, export, broadcast) | PASS | Tidak ada endpoint/UI terkait dibuat |

## Verifikasi yang dijalankan

| Perintah/skenario | Hasil |
|---|---|
| `npx prisma migrate deploy` (dev dan test database) | PASS; migration `candidate_dashboard_phase5` applied bersih di kedua database |
| ESLint | PASS; 0 error/warning (1 warning ditemukan dan diperbaiki selama pengerjaan) |
| TypeScript strict (`tsc --noEmit`) | PASS; 0 error |
| Unit test | PASS; 9 file, 40/40 (14 test baru) |
| Integration test PostgreSQL | PASS; 4 file, 56/56 (14 test baru) |
| E2E Playwright | PASS; 12/12 (1 assertion diperbarui dari placeholder Phase 4 ke konten Phase 5) |
| Production build (`next build`) | PASS; seluruh route Phase 1-5 terkompilasi termasuk 7 route API dan 2 halaman dashboard baru |
| Visual QA manual 4 viewport (dev server + 3 kandidat sintetis) | PASS; lihat `PHASE5_VISUAL_QA.md` |
| Verifikasi manual end-to-end lewat browser nyata (bukan hanya test) | PASS; login, tab switching, search, buka detail, tambah catatan, dan file viewer diuji lewat HTTP asli, bukan hanya pemanggilan fungsi server |

## Migration dan konfigurasi

- Migration additive tunggal `20260810180707_candidate_dashboard_phase5`: `ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'FILE_VIEW'`. Diterapkan ke database dev (`sekolah_ormawa_dev`) dan test (`sekolah_ormawa_test`); tidak ada migration production.
- `STORAGE_SIGNED_URL_TTL_SECONDS` kini divalidasi `src/lib/env.ts` (default 300 detik); tidak ada nilai baru yang perlu ditambahkan ke `.env` karena sudah ada di `.env.example`/`.env` lokal sejak Fase 0.
- Tidak ada dependency npm baru.

## Risiko, asumsi, dan technical debt

- **Temuan drift schema pra-eksisting (di luar scope Fase 5, belum diperbaiki)**: `auth_rate_limits.id` dan `password_reset_tokens.id` dideklarasikan `String` polos di `schema.prisma` (tanpa `@db.Uuid`) tetapi dibuat sebagai kolom native `UUID` oleh migration Fase 4 (`20260803001000_auth_phase4`). Ditemukan lewat `prisma migrate diff` saat menyiapkan migration Fase 5; tidak fungsional bermasalah saat ini, tetapi `prisma migrate dev` interaktif akan mencoba mengubah tipe kolom tersebut. Sengaja tidak diperbaiki di sini karena di luar acceptance criteria Fase 5 dan menyentuh tabel auth Fase 4 yang sudah stabil.
- **Repository path**: `IMPLEMENTATION_PLAN.md` masih menyebut path OneDrive lama; working directory aktual sesi ini adalah `C:\projectan\sekolah-ormawa`. Baris identitas di `IMPLEMENTATION_PLAN.md` sudah diperbarui; referensi lain (mis. `RUNBOOK.md` baris "Repository kanonis") belum disisir karena di luar scope Fase 5.
- Scope Super Admin pada dashboard dibatasi satu Birdep per waktu (department switcher); overview lintas-Birdep, manajemen akun/periode, override, export, dan broadcast tetap Phase 7 (ADR-028).
- Catatan Birdep scoped per-department, bukan per-pembuat (ADR-029) — PJ manapun di Birdep yang sama dapat mengubah/menghapus catatan Birdep tersebut.
- Periode dashboard memakai periode `createdAt` terbaru tanpa selector eksplisit; hanya relevan untuk MVP dengan satu periode aktif. Selector periode formal tetap Phase 7.
- Data kandidat sintetis untuk visual QA disisipkan manual ke database development (bukan lewat `prisma/seed.ts`); didokumentasikan di `RUNBOOK.md` agar tidak dianggap data resmi.
- File viewer men-stream bytes langsung dari adapter development (filesystem privat); saat adapter Supabase production dipasang, endpoint yang sama dapat diarahkan ke `createSignedDownload` tanpa mengubah kontrak authorization.

## Cara saya memeriksa hasil

1. Jalankan `npm run lint`, `npx tsc --noEmit`, `npm run test`, `npm run test:integration`, `npm run test:e2e`, dan `npm run build` — semua harus lulus.
2. Jalankan `npm run db:seed`, lalu login sebagai `pj.ristek.fixture@sekolah.local` dan `superadmin.fixture@sekolah.local` pada `npm run dev`.
3. Sisipkan kandidat sintetis (lihat `RUNBOOK.md` bagian "Operasi Dashboard PJ") untuk mengisi ketiga segmen, lalu verifikasi tab count, search, detail, catatan, dan file viewer sesuai `PHASE5_VISUAL_QA.md`.
4. Tinjau `tests/integration/candidate-dashboard.test.ts` untuk bukti isolasi lintas Birdep dan kandidat locked-elsewhere yang hilang dari dashboard Birdep lain.

## Keputusan yang dibutuhkan

Tidak ada. Satu keputusan produk (visibilitas kandidat yang terkunci Birdep lain) sudah dikonfirmasi eksplisit oleh pemilik proyek sebelum implementasi dimulai dan tercatat sebagai ADR-026.

## Batas fase

Phase 6 belum dimulai. Tidak ada lock/unlock, placement, atau fitur concurrency-safe terkait. Pekerjaan berhenti setelah laporan Phase 5 dan menunggu approval eksplisit pemilik proyek.

# Hasil Phase 6 - Lock/Unlock dan Placement

## Status

PASS

## Ringkasan hasil

- PJ dapat mengunci kandidat yang memilih Birdep-nya (`POST api/admin/candidates/[id]/lock`) dan membuka kunci (`DELETE` endpoint yang sama), keduanya transaksional, dengan alasan wajib diisi (ADR-031).
- Satu kandidat hanya boleh punya satu lock aktif — dijamin partial unique index PostgreSQL (`candidate_locks_one_active_per_candidate_key`, sudah ada sejak Fase 1), bukan hanya kode aplikasi.
- Lock hanya diizinkan saat periode `OPEN`; unlock diizinkan saat `OPEN` atau `CLOSED` (bukan `ARCHIVED`) dan mensyaratkan `allowUnlock=true` pada periode (ADR-030, dikonfirmasi eksplisit oleh pemilik proyek).
- Lock membuat/mereset `CandidatePlacement` ke `UNDER_REVIEW`; PJ pemegang lock dapat mengubah status placement (`PATCH api/admin/candidates/[id]/placement`) ke `PLACED`/`WAITLISTED`/`NOT_SELECTED`/`WITHDRAWN`. Unlock menghapus row placement.
- Semua aksi (LOCK, UNLOCK, update placement) tercatat audit trail dengan actor, department, dan alasan yang direduksi.
- **Temuan dan perbaikan desain penting selama pengembangan** (bukan hanya bug test): implementasi awal lock memakai isolasi transaksi `Serializable` dengan retry — di bawah race 50 percobaan konkuren pada satu baris kandidat (F6-01), ini menyebabkan retry storm (0 dari 50 percobaan sukses) dan bahkan memicu deadlock PostgreSQL sungguhan. Didesain ulang agar partial unique index menjadi satu-satunya sumber kebenaran konkurensi (fail-fast, tanpa retry); connection pool aplikasi juga dinaikkan dari default node-postgres (10) ke 20 karena jadi bottleneck terpisah. Detail lengkap di `TEST_MATRIX.md` dan `PHASE6_VISUAL_QA.md`.
- Override lock oleh Super Admin (membuka kunci Birdep lain secara paksa) **tidak dibangun** di fase ini — sesuai urutan fase yang sudah ditetapkan, itu bagian Phase 7. Kebijakan `overrideReason` wajib sudah dikunci sekarang (ADR-031) agar konsisten saat dibangun nanti.
- **Addendum pasca-laporan awal**: laporan pertama menandai aturan waktu lock sebagai asumsi terbuka (disamakan dengan unlock). Pemilik proyek mengonfirmasi lock seharusnya hanya saat periode `OPEN`. Kode (`assertPeriodAllowsLockAction`), test integration, ADR-030, dan `RUNBOOK.md` sudah diperbaiki sesuai keputusan ini sebelum Phase 7 dimulai.

## Perubahan utama

| File/modul | Tujuan perubahan |
|---|---|
| `src/features/candidates/{lock-contracts,lock-validation}.ts` | Tipe dan validasi zod untuk lock/unlock (reason wajib) dan update placement |
| `src/server/candidates/lock.ts` | `lockCandidate`/`unlockCandidate` transaksional; partial unique index + `updateMany` bersyarat sebagai guard konkurensi; `CandidateLockError` domain error |
| `src/server/candidates/placement.ts` | `updateCandidatePlacement`, hanya untuk Birdep pemegang lock aktif |
| `src/app/api/admin/candidates/[id]/lock/route.ts` | POST (lock) dan DELETE (unlock) |
| `src/app/api/admin/candidates/[id]/placement/route.ts` | PATCH status placement |
| `src/components/admin/lock-panel.tsx` | Client component: form alasan lock/unlock, selector status placement |
| `src/app/admin/dashboard/kandidat/[id]/page.tsx` | Merender `LockPanel` dengan `key` berbasis status+lock id agar remount bersih setelah `router.refresh()` |
| `src/features/candidates/contracts.ts` | Tambah `CandidatePlacementSummary`, perluas `CandidateLockSummary` (id, lockedByName, lockReason), tambah field `placement` pada `CandidateDetail` |
| `src/server/candidates/detail.ts` | Sertakan placement dan detail lock (nama pengunci, alasan) pada query detail |
| `src/lib/db.ts` | Naikkan connection pool Prisma/node-postgres dari default 10 ke 20 (temuan dari F6-01, lihat di atas) |
| `tests/unit/candidate-lock-validation.test.ts`, `tests/integration/candidate-lock.test.ts` | 8 unit test + 10 integration test baru untuk F6-01, F6-02, F6-03, dan siklus placement |

## Acceptance criteria

| Kriteria | Status | Bukti |
|---|---|---|
| LOCK-01: Lock/unlock atomik, 409, audit, visibility | PASS | `src/server/candidates/lock.ts`; F6-01/F6-02/F6-03 |
| LOCK-02: Placement terpisah dari lock | PASS | `src/server/candidates/placement.ts`; test "placement status" |
| F6-01: Race 50 lock, tepat 1 sukses, 49 status 409, 1 active row | PASS | `tests/integration/candidate-lock.test.ts` |
| F6-02: Lock authorization (scope Birdep, status kandidat) | PASS | 404 untuk Birdep bukan pilihan; 409 untuk kandidat sudah terkunci |
| F6-03: Unlock/audit, aturan periode | PASS | Lock hanya OPEN; unlock OPEN/CLOSED diizinkan, ARCHIVED ditolak, `allowUnlock=false` ditolak; audit LOCK/UNLOCK tercatat |
| Satu lock aktif dijamin database, bukan UI | PASS | Partial unique index PostgreSQL (Fase 1), dipakai native bukan dicek aplikasi saja |
| `lockReason`/`unlockReason` wajib | PASS | `lock-validation.ts`, ADR-031 |
| Otorisasi selalu di server | PASS | `requireDepartmentAccess` + scope check dalam transaksi |
| Operasi sensitif punya audit trail | PASS | Audit LOCK/UNLOCK/UPDATE(placement) dengan reason direduksi |
| Visual QA | PASS | `PHASE6_VISUAL_QA.md`, 6 artefak `docs/artifacts/phase-6/` |
| Lint, typecheck, unit, integration, E2E, build | PASS | Lihat verifikasi di bawah |
| Tidak ada fitur Phase 7 (override, akun, export, broadcast) | PASS | Tidak dibangun |

## Verifikasi yang dijalankan

| Perintah/skenario | Hasil |
|---|---|
| ESLint | PASS; 0 error/warning |
| TypeScript strict | PASS; 0 error |
| Unit test | PASS; 10 file, 48/48 (8 test baru) |
| Integration test PostgreSQL | PASS; 5 file, 67/67 (11 test baru, termasuk perbaikan aturan waktu lock pasca-approval) |
| E2E Playwright | PASS; 12/12, tanpa perubahan assertion |
| Production build | PASS; 2 route API baru terkompilasi |
| Visual QA manual browser nyata (login, lock, ubah placement, unlock, kandidat locked tanpa placement) | PASS; `PHASE6_VISUAL_QA.md` |
| Race 50 lock konkuren (`Promise.allSettled`) | PASS; tepat 1 sukses, 49 gagal status 409, 1 active row di database |

## Migration dan konfigurasi

- **Tidak ada migration baru.** Semua tabel (`candidate_locks` dengan partial unique index, `candidate_placements`) dan nilai enum `AuditAction.LOCK/UNLOCK/OVERRIDE` sudah tersedia sejak migration Fase 1.
- `src/lib/db.ts`: connection pool Prisma/node-postgres dinaikkan dari default 10 ke `max: 20` (perubahan konfigurasi aplikasi, bukan migration database).
- Tidak ada dependency npm baru.

## Risiko, asumsi, dan technical debt

- Override lock oleh Super Admin (ADR-031 mengunci kebijakan reason-nya, tapi aksinya sendiri belum dibangun) tetap Phase 7 sesuai urutan fase yang sudah ditetapkan.
- Connection pool `max: 20` adalah nilai wajar untuk beban admin internal skala kecil-menengah pada satu instance aplikasi; perlu ditinjau ulang saat sizing production/multi-instance ditentukan di Phase 8, mengingat Postgres `max_connections` default juga terbatas (biasanya 100) dan dibagi ke seluruh instance yang berjalan.
- Unlock menghapus row `CandidatePlacement` sepenuhnya (bukan soft-reset); riwayat keputusan placement sebelum unlock tidak dipertahankan di luar audit log `beforeJson`/`afterJson`. Jika riwayat placement per-lock perlu dipertahankan lebih detail, ini perlu didesain ulang sebelum Phase 7/8.
- Schema drift `auth_rate_limits`/`password_reset_tokens` (dicatat Fase 5) — masih **ditunda**, tidak disentuh fase ini sesuai instruksi eksplisit Anda.

## Cara saya memeriksa hasil

1. Jalankan `npm run lint`, `npx tsc --noEmit`, `npm run test`, `npm run test:integration`, `npm run test:e2e`, dan `npm run build` — semua harus lulus.
2. Tinjau `tests/integration/candidate-lock.test.ts`, khususnya skenario race 50 lock, untuk bukti tepat satu sukses dan 49 gagal status 409.
3. Set sementara periode fixture ke `OPEN`/`allowUnlock=true` di database development, jalankan `npm run dev`, login sebagai `pj.ristek.fixture@sekolah.local`, lalu ikuti langkah di `PHASE6_VISUAL_QA.md`.
4. Kembalikan periode fixture ke `DRAFT`/`allowUnlock=false` dan jalankan ulang `npm run db:seed` setelah selesai (sudah saya lakukan di akhir sesi ini).

## Keputusan yang dibutuhkan

Tidak ada. Aturan waktu lock (hanya `OPEN`, lebih sempit dari unlock) sudah dikonfirmasi eksplisit oleh pemilik proyek dan diperbaiki di kode/test/dokumentasi sebelum Phase 7 dimulai.

## Batas fase

Phase 7 (Super Admin dan operasional) belum dimulai. Tidak ada override lock, manajemen akun/periode, export, atau broadcast. Pekerjaan berhenti setelah laporan Phase 6 dan menunggu approval eksplisit pemilik proyek.

# Hasil Phase 7 - Super Admin dan Operasional

## Status

PASS

## Ringkasan hasil

- **Akun PJ** (F7-01): Super Admin membuat akun `DEPT_PJ` tanpa pernah melihat/mengirim temporary password — kredensial awal adalah hash acak tak terpakai, aktivasi hanya lewat tautan setup sekali-pakai (reuse mekanisme reset token Fase 4) via email outbox. Edit, disable/enable (+revoke sesi otomatis), kirim ulang reset, dan revoke sesi tersedia. Akun `SUPER_ADMIN` baru **tidak** dapat dibuat lewat UI (keputusan eksplisit Anda) — tetap manual lewat seed/database.
- **Periode** (F7-02): Super Admin dapat mengedit seluruh field periode yang sudah ada (status, config, tahun masuk, prefix, consent, jadwal, `choice2Required`, `allowUnlock`) dan ketersediaan per Birdep (`acceptsApplications`, `quota`). Membuat periode BARU sengaja tidak dibangun (lihat Risiko).
- **Override lock** (dari tabel fase Anda): Super Admin dapat force-unlock kandidat manapun lintas-Birdep, bypass aturan periode `OPEN`/`CLOSED`/`allowUnlock` yang mengikat unlock biasa, `overrideReason` wajib, tercatat audit `OVERRIDE` (berbeda dari `UNLOCK`).
- **Soft-delete/restore kandidat** (F7-02): Super Admin dapat menghapus (soft) kandidat yang tidak sedang terkunci, dan memulihkannya dari daftar terpisah.
- **Export CSV** (F7-03): tersedia untuk PJ (scope sendiri) *dan* Super Admin (Birdep terpilih) — permission `sekolah.export.own_birdep` memang sudah di-assign ke `DEPT_PJ` sejak Fase 1. Formula-injection diescape, tidak ada object key/URL/kandidat WITHDRAWN dalam file.
- **Broadcast kandidat** (F7-04): Super Admin only, mengirim ke kandidat (dikonfirmasi Anda, bukan ke akun PJ) terfilter periode/Birdep/status placement. Double confirmation diimplementasikan sebagai token HMAC ber-TTL yang mengikat filter+subjek+isi pesan persis — bukan sekadar modal "yakin?" — dan outbox idempotent lewat unique constraint saat token direplay.
- Semua aksi sensitif (create/disable/reset akun, edit periode, override, broadcast) tercatat audit trail dengan actor dan detail yang direduksi (tanpa isi pesan lengkap atau daftar penerima broadcast di audit).

## Perubahan utama

| File/modul | Tujuan perubahan |
|---|---|
| `src/features/admin/{account,period,candidate-admin}-contracts.ts`, `-validation.ts` | Tipe dan validasi zod untuk akun, periode, dan candidate admin |
| `src/features/broadcast/{contracts,validation}.ts` | Tipe dan validasi filter/konten broadcast |
| `src/features/candidates/csv.ts` | Utilitas escaping CSV murni (diekstrak agar dapat diuji unit tanpa dependency database) |
| `src/server/admin/{accounts,periods,candidate-admin}.ts` | Domain logic akun PJ, periode, override/soft-delete/restore |
| `src/server/candidates/lock.ts` | Tambah `overrideUnlockCandidate` (Super Admin, bypass aturan periode, audit `OVERRIDE`) |
| `src/server/candidates/export.ts` | Query + build CSV kandidat scoped per Birdep |
| `src/server/broadcast/broadcast.ts` | `previewBroadcast`/`sendBroadcast` dengan token HMAC double-confirmation dan outbox idempotent |
| `src/server/email/outbox.ts` | Tipe payload email baru: `ACCOUNT_SETUP`, `BROADCAST` |
| 16 route API baru | `api/admin/accounts/**`, `api/admin/periods/**`, `api/admin/locks`, `api/admin/deleted-candidates`, `api/admin/candidates/[id]/{delete,restore,override}`, `api/admin/candidates/export`, `api/admin/broadcast/{preview,send}` |
| `src/app/admin/dashboard/{akun,periode,broadcast}/page.tsx` | 3 halaman admin baru |
| `src/components/admin/{account-manager,period-manager,override-lock-panel,broadcast-composer,danger-zone}.tsx` | Client component untuk masing-masing fitur |
| `src/app/admin/dashboard/page.tsx`, `kandidat/[id]/page.tsx` | Nav Super-Admin-only (akun/periode/broadcast), tombol Export CSV, Danger Zone di detail kandidat |
| 6 file test baru | 1 unit (CSV escaping) + 5 integration (account, period, candidate-admin/override, export, broadcast) |
| `tests/e2e/auth.spec.ts` | Assertion shell diperbarui ke konten Phase 7; tambah assertion nav Super-Admin-only tampil/tidak tampil sesuai role |

## Acceptance criteria

| Kriteria | Status | Bukti |
|---|---|---|
| ADM-01: Akun PJ create/edit/disable/reset/revoke | PASS | `src/server/admin/accounts.ts`; 5 integration test |
| ADM-02: Periode, kandidat, override, export, broadcast, audit | PASS | Lihat modul terkait; period-create disengaja tidak dibangun (Risiko) |
| F7-01: Account lifecycle | PASS | Tanpa temp password terlihat; setup link lewat outbox |
| F7-02: Period/candidate admin | PASS | Update periode+Birdep; soft-delete ditolak saat locked; override ter-audit |
| F7-03: Export safety | PASS | Formula escaping, tanpa object key/URL, exclude WITHDRAWN |
| F7-04: Broadcast guard | PASS | Preview tanpa efek samping, token wajib cocok persis, outbox idempotent |
| Akun Super Admin baru tidak lewat UI | PASS | `createPjAccount` hardcode role `DEPT_PJ`; tidak ada endpoint create Super Admin |
| Broadcast ke kandidat, bukan akun PJ | PASS | `resolveRecipients` query `Candidate`, bukan `User` |
| Otorisasi selalu di server | PASS | Semua route baru `requireSuperAdmin` (kecuali export yang tetap `requirePermission` PJ+Super Admin sesuai izin Fase 1) |
| Operasi sensitif punya audit trail | PASS | CREATE/UPDATE/DISABLE(UPDATE)/SESSION_REVOKE/OVERRIDE/SOFT_DELETE/RESTORE/BROADCAST |
| Visual QA | PASS | `PHASE7_VISUAL_QA.md`, 7 artefak `docs/artifacts/phase-7/` |
| Lint, typecheck, unit, integration, E2E, build | PASS | Lihat verifikasi di bawah |

## Verifikasi yang dijalankan

| Perintah/skenario | Hasil |
|---|---|
| ESLint | PASS; 0 error/warning |
| TypeScript strict | PASS; 0 error |
| Unit test | PASS; 11 file, 54/54 (6 test baru) |
| Integration test PostgreSQL | PASS; 10 file, 90/90 (28 test baru) |
| E2E Playwright | PASS; 12/12 (1 assertion shell diperbarui + 3 assertion nav ditambah) |
| Production build | PASS; 16 route API baru + 3 halaman admin terkompilasi |
| Visual QA manual browser nyata (create akun, edit periode, override lock, export tombol, broadcast preview, danger zone) | PASS; `PHASE7_VISUAL_QA.md` |

## Migration dan konfigurasi

- **Tidak ada migration baru.** Semua tabel/field/enum yang dibutuhkan (`RecruitmentPeriod`, `PeriodDepartment`, `Candidate.deletedAt`, `AuditAction.OVERRIDE/SOFT_DELETE/RESTORE/BROADCAST`) sudah ada sejak Fase 1.
- Tidak ada dependency npm baru.

## Risiko, asumsi, dan technical debt

- **Period CREATE sengaja tidak dibangun** — hanya edit periode yang sudah ada dari seed. Membuat periode baru dari nol butuh keputusan produk yang masih blocking di `DECISIONS.md` (prodi resmi, tahun masuk, prefix, jadwal). Jika Anda perlu multi-periode aktif sebelum Phase 8, ini perlu dibangun terpisah.
- Transisi status periode tidak divalidasi sebagai state machine — operator bisa memilih kombinasi status yang secara teori tidak masuk akal (mis. ARCHIVED→OPEN). Tidak ada guard rail selain kebijaksanaan operator.
- Broadcast MVP: subjek+body plain text (bukan template/HTML), karena provider email production belum ada (blocker Fase 3 tetap berlaku). Konten broadcast lengkap sengaja tidak disimpan di audit log (hanya subjek+jumlah penerima) untuk membatasi PII dalam audit trail — riwayat pesan lengkap hanya ada di `email_outbox.encryptedPayload` terenkripsi.
- Danger zone (soft-delete) hanya dapat diakses dari halaman detail kandidat yang sudah dikunjungi Super Admin (lewat department switcher) — tidak ada "browse semua kandidat lintas-Birdep" terpisah di luar daftar locked/deleted. Ini konsisten dengan scope minimal yang saya laporkan sebelum coding, tapi beri tahu saya bila Anda butuh browse/search lintas-Birdep penuh.
- Schema drift `auth_rate_limits`/`password_reset_tokens` (dicatat Fase 5) — masih **ditunda**, tidak disentuh fase ini.

## Cara saya memeriksa hasil

1. Jalankan `npm run lint`, `npx tsc --noEmit`, `npm run test`, `npm run test:integration`, `npm run test:e2e`, dan `npm run build` — semua harus lulus.
2. Tinjau `tests/integration/{account-admin,period-admin,candidate-admin,candidate-export,broadcast}.test.ts` untuk bukti masing-masing acceptance criteria.
3. Set sementara periode fixture ke `OPEN`/`allowUnlock=true`, jalankan `npm run dev`, login sebagai `superadmin.fixture@sekolah.local`, lalu ikuti langkah di `PHASE7_VISUAL_QA.md`.
4. Bersihkan data QA (akun/kandidat sintetis tambahan) dan jalankan ulang `npm run db:seed` setelah selesai (sudah saya lakukan di akhir sesi ini).

## Keputusan yang dibutuhkan

Tidak ada yang memblokir Phase 8. Satu catatan untuk dipertimbangkan: apakah period-create dan browse-kandidat-lintas-Birdep penuh perlu dibangun sebelum atau selama Phase 8, mengingat keduanya sengaja saya batasi di fase ini (lihat Risiko).

## Batas fase

Phase 8 (Hardening, QA, UAT, deployment readiness) belum dimulai. Tidak ada security audit penuh, backup/restore drill, UAT terstruktur, atau deployment. Pekerjaan berhenti setelah laporan Phase 7 dan menunggu approval eksplisit pemilik proyek.

# Hasil Phase 8 - Hardening, QA, UAT, dan Deployment Readiness

## Status

PASS - dengan gap blocking yang terdokumentasi (bukan bug, keputusan/implementasi yang masih dibutuhkan sebelum deploy sungguhan)

## Ringkasan hasil

Fase ini murni audit, pengujian, perbaikan, dan dokumentasi - **tidak ada fitur baru**, sesuai instruksi. Dua bug produksi nyata ditemukan lewat pengujian dan diperbaiki (bukan cuma dicatat):

- **Bug 1 (load test, P4)**: `submitRegistration` memakai Serializable isolation untuk seluruh transaksi submit, termasuk increment counter nomor registrasi (`registrationSequence`) yang dibagi oleh SEMUA submitter pada periode yang sama. Di bawah 60 submission konkuren (simulasi lonjakan traffic dekat deadline pendaftaran), 72-85% gagal - awalnya bahkan bocor sebagai raw `PrismaClientKnownRequestError` yang tidak dibungkus rapi (bug kedua: percobaan retry terakhir tidak jatuh ke error 409 yang bersih). Pola ini identik dengan pelajaran Phase 6 pada `lockCandidate` (Serializable + shared row = kontensi tinggi). Diperbaiki dengan pendekatan yang sama: counter diekstrak jadi atomic single-row update terpisah di luar transaksi; isolation level transaksi utama diturunkan ke read-committed (default Postgres) karena tidak ada lagi shared-write row di dalamnya, sementara keamanan idempotency-key tetap dijaga `pg_advisory_xact_lock` dan uniqueness NIM/email tetap dijaga unique constraint database (keduanya independen dari isolation level). **Hasil setelah perbaikan: 60/60 submission konkuren sukses**, wall time ~1.9 detik. Detail di `src/server/registration/submit.ts` (komentar inline) dan `TEST_MATRIX.md` F8-04a.
- **Bug 2 (aksesibilitas, P4)**: 2 pelanggaran WCAG 2.1 AA color-contrast ditemukan via axe-core - heading kolom footer (`.site-footer__columns h3`, opacity putih 0.42 di atas `--burgundy-dark` = ~3.77:1) dan nomor kartu galeri pada varian gold/sage (`.gallery-card__number`, opacity 0.8 tidak cukup di kedua background; putih di atas `--gold` bahkan mustahil mencapai 4.5:1 di opacity berapa pun). Diperbaiki di `globals.css` (opacity dinaikkan, atau warna teks diganti gelap untuk varian gold). Satu axe finding lain (`.site-footer__marquee`, teks brand berulang `aria-hidden="true"` murni dekoratif) dikecualikan dari scan dengan alasan terdokumentasi (WCAG SC 1.4.3 "pure decoration"), bukan diperbaiki karena memang bukan bug.

Ringkasan per prioritas:

1. **Security audit**: header keamanan lengkap (CSP+4 header lain, dipisah baseline/admin), CSRF ditambahkan ke seluruh endpoint state-changing yang sebelumnya belum terlindungi, rate limit baru untuk upload/download registrasi dan file/export/broadcast admin, pre-check ukuran upload dari `Content-Length`, `npm audit` 0 vulnerabilities (upgrade Next.js 16.2.12->16.3.0 menutup blocker dependency yang tertunda sejak Phase 4). Log redaction, private storage, dan secret handling ditinjau ulang - tidak ada temuan baru (pola yang sudah benar sejak fase-fase sebelumnya).
2. **Authorization matrix**: 14 test baru mengonfirmasi seluruh kombinasi role x endpoint yang Anda minta - publik->401, PJ lintas-Birdep->404 (bukan 403), PJ mencoba aksi Super-Admin-only->403, sesi dicabut/dihapus->401, kontrol positif Super Admin->200.
3. **Race condition/idempotency**: seluruh skenario Phase 6/7 (race 50 lock, duplicate NIM/email paralel, idempotency-key replay, period-closed reject, outbox retry) dikonfirmasi ulang lulus pada build Phase 8.
4. **Performa dan aksesibilitas**: load test + database pooling (temuan Bug 1 di atas), WCAG 2.1 AA di 14 kombinasi rute (temuan Bug 2 di atas), responsive 360/768/1280px di 14 rute (42 screenshot, tanpa horizontal overflow).
5. **Backup dan restore**: drill dijalankan sungguhan (bukan simulasi/dokumentasi saja) - dump database dan storage, restore ke container Postgres terpisah dengan volume baru, verifikasi row count DAN checksum konten cocok 100%.
6. **Deployment readiness**: checklist lengkap di `RUNBOOK.md` (env var tanpa nilai secret, DNS/TLS, urutan migration, smoke test, rollback plan, verifikasi pasca-deploy). Menemukan gap blocking: adapter storage/email production belum diimplementasikan sama sekali di kode (lihat Risiko).
7. **UAT checklist**: dokumen baru `UAT_CHECKLIST.md`, 3 role, format non-teknis, larangan eksplisit broadcast nyata.

Sesuai instruksi Anda: **tidak ada deploy ke production, tidak ada migration ke database production, tidak ada broadcast nyata yang dikirim** selama fase ini.

## Perubahan utama

| File/modul | Tujuan perubahan |
|---|---|
| `next.config.mjs` | Header keamanan dipisah `baselineHeaders` (semua route) dan `adminHeaders` (+`Cache-Control: no-store` untuk admin/api-admin/api-auth) |
| `src/app/api/registration/{submit,uploads,uploads/[id]}/route.ts` | CSRF check, rate limit baru, pre-check `Content-Length` |
| `src/app/api/admin/candidates/[id]/files/[fileId]/route.ts`, `.../candidates/export/route.ts`, `.../broadcast/send/route.ts` | Rate limit baru (`ADMIN_FILE_ACCESS`, `ADMIN_EXPORT`, `ADMIN_BROADCAST_SEND`) |
| `src/server/auth/rate-limit.ts` | `RateLimitScope` diperluas 6 scope baru |
| `src/server/registration/submit.ts` | **Perbaikan bug konkurensi**: counter registrationSequence diekstrak dari transaksi Serializable; isolation level diturunkan ke read-committed; retry-exhaustion pada percobaan terakhir kini selalu menghasilkan error 409 bersih (bukan bocor raw driver error); retry memakai jittered backoff, max attempt 3->6 |
| `src/app/globals.css` | 2 perbaikan WCAG 2.1 AA color-contrast (`.site-footer__columns h3`, `.gallery-card__number` varian gold/sage) |
| `package.json` | `next`/`eslint-config-next` 16.2.12->16.3.0 (menutup dependency vulnerability blocker); `@axe-core/playwright` devDependency baru |
| `tests/integration/authorization-matrix.test.ts` | Baru - 14 test matrix otorisasi (P2) |
| `tests/integration/load-performance.test.ts` | Baru - 2 test load/pooling (P4), menemukan Bug 1 |
| `tests/e2e/accessibility.spec.ts` | Baru - 20 test axe-core WCAG 2.1 AA + keyboard/focus/label/alt text (P4), menemukan Bug 2 |
| `tests/e2e/responsive.spec.ts` | Baru - 12 test no-overflow 3 viewport x 14 rute + 42 screenshot (P4) |
| `docs/artifacts/phase-8/responsive/` | 42 screenshot bukti visual QA responsive |
| `docs/sekolah-ormawa/RUNBOOK.md` | §Backup dan restore (hasil drill nyata), §Deployment readiness (ditulis ulang lengkap: 6 sub-bagian) |
| `docs/sekolah-ormawa/UAT_CHECKLIST.md` | Baru - checklist UAT non-teknis 3 role |
| `docs/sekolah-ormawa/DECISIONS.md` | ADR-032/033/034 (period create ditunda, no cross-dept browse, period state machine = technical debt) |

## Acceptance criteria

| Kriteria | Status | Bukti |
|---|---|---|
| P1: Security audit lengkap | PASS | Header, CSRF, rate limit, upload validation, storage privat, log redaction, `npm audit`, secret handling - lihat `TEST_MATRIX.md` F8-01a s.d. F8-01e |
| P2: Authorization matrix negative test | PASS | `authorization-matrix.test.ts`, 14/14 test |
| P3: Race condition/idempotency re-konfirmasi | PASS | 104 test integration existing lulus ulang pada build Phase 8 |
| P4: Load test + pooling + aksesibilitas + responsive | PASS - 2 bug ditemukan dan diperbaiki | `load-performance.test.ts`, `accessibility.spec.ts`, `responsive.spec.ts` |
| P5: Backup/restore drill di environment terpisah | PASS | Drill nyata 2026-08-12, row count + checksum cocok 100%; detail `RUNBOOK.md` |
| P6: Deployment readiness (env, DNS/TLS, migration, smoke, rollback, verifikasi) | PASS - dengan gap blocking terdokumentasi | `RUNBOOK.md` §Deployment readiness |
| P7: UAT checklist 3 role, non-teknis | PASS | `UAT_CHECKLIST.md` |
| Tidak ada deploy/migration production, tidak ada broadcast nyata | PASS | Tidak ada koneksi ke environment production; broadcast hanya diuji sampai tahap preview |
| Lint, typecheck, unit, integration, E2E, build, audit | PASS | Lihat verifikasi di bawah |

## Verifikasi yang dijalankan

| Perintah/skenario | Hasil |
|---|---|
| ESLint | PASS; 0 error/warning |
| TypeScript strict | PASS; 0 error |
| Unit test | PASS; 11 file, 54/54 (tanpa perubahan dari Phase 7) |
| Integration test PostgreSQL | PASS; 12 file, 106/106 (2 file baru: authorization-matrix 14, load-performance 2) |
| E2E Playwright | PASS; 44/44 (2 file baru: accessibility 20, responsive 12) |
| Production build | PASS; Next.js 16.3.0, seluruh route terkompilasi |
| `npm audit` (dev+prod) | PASS; 0 vulnerabilities |
| Backup/restore drill | PASS; row count + checksum konten database 100% cocok; checksum SHA-256 storage 100% cocok |

## Migration dan konfigurasi

- **Tidak ada migration schema baru.** Perbaikan Bug 1 murni perubahan logic transaksi (`submit.ts`), bukan perubahan schema.
- Dependency baru: `@axe-core/playwright` (devDependency, untuk E2E aksesibilitas).
- Dependency di-upgrade: `next`, `eslint-config-next` 16.2.12->16.3.0 (patch keamanan, menutup `npm audit` blocker yang tertunda sejak Phase 4).

## Risiko, asumsi, dan technical debt

- **Gap blocking untuk go-live sungguhan (bukan technical debt biasa - literal tidak bisa jalan)**: `getPrivateStorage()` dan `LocalEmailSinkAdapter` masing-masing `throw` eksplisit saat `NODE_ENV=production`. Tidak ada adapter Supabase (storage) atau Resend (email) yang diimplementasikan - baru nama env var placeholder di `.env.example`. Ini sudah tercatat sebagai blocking item di `DECISIONS.md` ("Blocking sebelum fitur terkait diaktifkan" #1 dan #2), ditemukan ulang secara konkret saat menyusun checklist deployment readiness Phase 8. **Tanpa mengimplementasikan keduanya, aplikasi tidak bisa menerima pendaftaran atau mengirim email apa pun di production**, terlepas dari seberapa siap sisi security/testing-nya.
- CAPTCHA (`TURNSTILE_SECRET_KEY`) dan error tracking (`SENTRY_DSN`) juga baru placeholder env var tanpa implementasi kode maupun keputusan produk - berbeda dari storage/email, ini belum pernah dibahas sebagai keputusan yang perlu diambil.
- Owner domain/hosting/CI/backup terjadwal/monitoring/on-call untuk production belum ditunjuk (tercatat blocking item #5 di `DECISIONS.md`, ditulis "sebelum Phase 8 selesai" - saya laporkan sebagai belum terselesaikan, bukan diam-diam dilewati).
- Drill backup/restore dijalankan di container Docker terpisah pada host yang sama (volume baru, tanpa shared state) - BUKAN environment/hosting fisik atau region berbeda, dan dataset dev yang dipakai sangat kecil (13 department, 3 kandidat). Angka RTO (~1.3 detik restore) TIDAK mewakili skala production. Drill ulang wajib terhadap dataset berskala production sebelum go-live.
- Isu lingkungan pengembangan lokal (bukan risiko produk): Windows Hyper-V/WinNAT mengunci rentang port dinamis yang menabrak port Postgres dev standar (55432). `docker-compose.yml` saat ini menunjuk sementara ke port 15432 sebagai workaround dan `.env` masih menunjuk ke 55432 (belum diubah, sengaja tidak saya sentuh) - environment variable test/dev saya override manual per-command sepanjang fase ini. **Ini murni masalah environment lokal saya, bukan bug aplikasi**, tapi Anda perlu tahu: jika ingin lanjut development di mesin ini nanti, opsi: (a) restart Docker Desktop, (b) jalankan `net stop winnat && net start winnat` sebagai admin, (c) reboot, atau (d) permanenkan port 15432 di `.env`+`docker-compose.yml` sekaligus. Saya tidak mengubah `docker-compose.yml` kembali ke 55432 karena container masih perlu jalan untuk fase ini; silakan beri tahu preferensi Anda.
- Schema drift `auth_rate_limits`/`password_reset_tokens` (dicatat sejak Phase 5) - tetap **ditunda** sesuai instruksi eksplisit Anda, tidak disentuh fase ini.
- Period create dan browse-kandidat-lintas-Birdep penuh - tetap **ditunda** sesuai instruksi eksplisit Anda (ADR-032, ADR-033).
- State machine transisi status periode - tetap **technical debt post-MVP** sesuai instruksi eksplisit Anda (ADR-034).

## Cara saya memeriksa hasil

1. Jalankan `npm run lint`, `npx tsc --noEmit`, `npm run test`, `npm run test:integration`, `npm run test:e2e`, `npm run build`, dan `npm audit` — semua harus lulus (catatan: `TEST_DATABASE_URL`/`DATABASE_URL` saya override ke port 15432 sepanjang fase ini karena isu WinNAT lokal - lihat Risiko; sesuaikan port jika environment Anda sudah normal di 55432).
2. Tinjau `tests/integration/{authorization-matrix,load-performance}.test.ts` dan `tests/e2e/{accessibility,responsive}.spec.ts` untuk bukti masing-masing prioritas.
3. Baca komentar inline di `src/server/registration/submit.ts` (sekitar deklarasi `SUBMIT_MAX_ATTEMPTS` dan opsi `$transaction`) untuk pemahaman penuh perbaikan Bug 1.
4. Baca `RUNBOOK.md` §Backup dan restore (hasil drill) dan §Deployment readiness (checklist lengkap 6 sub-bagian, termasuk daftar gap blocking).
5. Baca `UAT_CHECKLIST.md` dan coba jalankan sendiri (atau delegasikan ke tester non-teknis) sebagai validasi akhir sebelum keputusan go-live.

## Keputusan yang dibutuhkan

Tidak ada yang memblokir penyelesaian Phase 8 ini sendiri (seluruh 7 prioritas selesai dan lolos quality gate). Yang memblokir **go-live production** (bukan fase ini):

1. Implementasi adapter storage production (Supabase) dan email production (Resend) - keputusan produk sudah ada di `DECISIONS.md`, tinggal dibangun. Perlu diputuskan apakah ini Phase 9 terpisah atau bagian dari persiapan go-live.
2. Penunjukan owner domain/hosting/CI/backup terjadwal/monitoring/on-call.
3. Preferensi Anda soal port Postgres dev lokal (15432 permanen vs. perbaikan WinNAT) - tidak mendesak, tapi perlu keputusan sebelum sesi development berikutnya supaya tidak berulang kali override manual.

## Batas fase

Seluruh 7 prioritas Phase 8 selesai dan lolos quality gate. **Tidak ada deploy ke production, tidak ada migration ke database production, tidak ada broadcast nyata yang dikirim** - sesuai instruksi eksplisit Anda. Pekerjaan berhenti setelah laporan ini dan menunggu approval eksplisit Anda untuk langkah selanjutnya (termasuk keputusan soal 3 item di atas).

# Hasil Phase 9 - Adapter Production (MinIO, Resend), Deployment Self-Hosted, Schema Drift

## Status

PASS - dengan batas eksplisit: seluruh kode/artefak selesai dan diverifikasi lokal; **belum ada deploy sungguhan ke server Contabo** (di luar kendali agent - tidak ada akses SSH/kredensial ke server nyata).

## Ringkasan hasil

Menindaklanjuti 5 keputusan Anda pasca-approval Phase 8:

1. **Port Postgres 15432 permanen**: `docker-compose.yml`, `.env`, `.env.example` disatukan (sebelumnya `.env` masih menunjuk `55432` sementara `docker-compose.yml` sudah `15432`, perlu override manual sepanjang Phase 8). Didokumentasikan di `RUNBOOK.md` termasuk root cause Windows WinNAT.
2. **Storage MinIO + email Resend dibangun** (bukan sekadar didokumentasikan): `MinioPrivateStorage` (S3-compatible via `@aws-sdk/client-s3`, `forcePathStyle: true` untuk MinIO) dan `ResendEmailAdapter` (via SDK resmi, bukan SMTP) menggantikan `throw` eksplisit yang sebelumnya memblokir production di kedua adapter. Kedua adapter diuji terhadap dependency NYATA sejauh mungkin tanpa credential production sungguhan: MinIO diuji terhadap container MinIO ephemeral asli (bukan mock) - termasuk presigned URL yang benar-benar diunduh/diupload lewat `fetch` polos tanpa credential; Resend diuji dengan SDK di-mock (tidak ada API key nyata yang saya miliki atau seharusnya saya minta).
3. **Owner domain/hosting/backup**: dicatat sebagai selesai (ADR-038) sesuai pernyataan Anda - pemilik proyek sendiri, server Contabo milik Biro. Tidak ada tindakan teknis yang saya lakukan untuk item ini (murni keputusan administratif).
4. **Schema drift diperbaiki**: migration baru menyelaraskan tipe kolom `id` `auth_rate_limits`/`password_reset_tokens` (native `uuid` sejak Phase 4, seharusnya `text` seperti 15+ tabel lain) - `prisma migrate diff` mengonfirmasi nol drift tersisa setelah apply.
5. **Deployment self-hosted Contabo dibangun**: `Dockerfile` (multi-stage, Next.js `output: "standalone"`), `docker-compose.prod.yml` (app+Postgres+MinIO+Nginx, hanya Nginx yang publish port ke host), `deploy/nginx/nginx.conf` (reverse proxy, TLS lewat certbot webroot, redirect HTTP->HTTPS). **Saya build image-nya dan menjalankan stack lengkap secara lokal** (bukan di Contabo - saya tidak punya akses ke server itu) untuk membuktikan seluruh plumbing benar-benar berfungsi: app terhubung ke Postgres dan MinIO lewat Docker network internal, Nginx redirect dan ACME challenge path bekerja, `nginx -t` valid. Semua container/image sementara dibersihkan setelah verifikasi.

**Temuan keamanan saat membangun `nginx.conf`** (tidak diminta, ditemukan saat menyusun reverse proxy config): draft awal berisiko membiarkan client men-spoof IP asal lewat header `X-Forwarded-For` yang disuntik sendiri (karena `$proxy_add_x_forwarded_for` APPEND, bukan replace) - ini bisa dipakai untuk melewati rate limiter login/submit yang dibangun Phase 4/8. Diperbaiki ke `$remote_addr` sebelum config dianggap final; dijelaskan di komentar inline `nginx.conf` dan `TEST_MATRIX.md` F9-06.

## Perubahan utama

| File/modul | Tujuan perubahan |
|---|---|
| `.env`, `.env.example`, `docker-compose.yml` | Port Postgres dev disatukan ke `15432` |
| `prisma/migrations/20260812070054_fix_auth_rate_limit_reset_token_id_type/` | Migration baru: `id` `auth_rate_limits`/`password_reset_tokens` `uuid`->`text` |
| `src/lib/env.ts` | 5 var MinIO (`MINIO_ENDPOINT`/`MINIO_REGION`/`MINIO_ACCESS_KEY`/`MINIO_SECRET_KEY`/`STORAGE_BUCKET_CANDIDATES`) + 2 var Resend (`RESEND_API_KEY`/`RESEND_FROM_EMAIL`) ditambahkan, opsional di base schema, wajib lewat `superRefine` saat `NODE_ENV=production` |
| `src/server/storage/private-storage.ts` | `MinioPrivateStorage` baru (implementasi `put`/`read`/`delete`/`createSignedUpload`/`createSignedDownload`); `getPrivateStorage()` mengembalikannya di production |
| `src/server/email/outbox.ts` | `ResendEmailAdapter` baru (render 4 jenis email + kirim lewat SDK Resend); `getEmailAdapter()` factory baru; `DevelopmentEmailPayload` -> `EmailPayload` (dipakai kedua adapter, bukan dev-only lagi) |
| `next.config.mjs` | `output: "standalone"` untuk image Docker yang ramping |
| `Dockerfile`, `.dockerignore` | Baru - build image production multi-stage |
| `docker-compose.prod.yml` | Baru - stack self-hosted (app+Postgres+MinIO+Nginx) |
| `deploy/nginx/nginx.conf` | Baru - reverse proxy, TLS certbot webroot, `X-Forwarded-For` hardening |
| `public/.gitkeep` | Baru - Next.js/Docker mengharapkan `public/` ada meski kosong |
| `tests/integration/storage-minio.test.ts` | Baru - 6 test terhadap MinIO nyata |
| `tests/unit/resend-email-adapter.test.ts` | Baru - 7 test dengan SDK Resend di-mock |
| `docs/sekolah-ormawa/DECISIONS.md` | ADR-035 s.d. 039 (MinIO, Resend, deployment self-hosted, owner, port dev) |

## Acceptance criteria

| Kriteria | Status | Bukti |
|---|---|---|
| Port Postgres 15432 permanen dan konsisten | PASS | `.env`/`.env.example`/`docker-compose.yml`; full suite lulus tanpa override |
| Storage MinIO dibangun, S3-compatible, bucket privat, signed URL 5-10 menit, object key acak | PASS | `MinioPrivateStorage`; `STORAGE_SIGNED_URL_TTL_SECONDS` default 300; object key sudah acak sejak Phase 3 (`randomUUID()`) |
| Email Resend dibangun, via SDK/HTTP API bukan SMTP, from address dari env var | PASS | `ResendEmailAdapter` pakai `resend` SDK resmi; `RESEND_FROM_EMAIL` |
| Kredensial hanya dari env var, tidak hard-code | PASS | Semua credential lewat `getServerEnvironment()`; placeholder build-time di `Dockerfile` jelas ditandai bukan secret asli |
| Env var didokumentasikan tanpa nilai secret | PASS | `RUNBOOK.md` §Deployment readiness bagian 1 |
| Owner domain/hosting/backup ditunjuk | PASS | ADR-038 |
| Schema drift diperbaiki sebelum production | PASS | Migration baru, `prisma migrate diff` nol drift |
| Deployment self-hosted Contabo, Docker/Docker Compose, Nginx, TLS, env var management, health check, restart policy | PASS | `Dockerfile`/`docker-compose.prod.yml`/`deploy/nginx/nginx.conf`; healthcheck di tiap service; `restart: unless-stopped` |
| Lint, typecheck, unit, integration, E2E, build, audit | PASS | Lihat verifikasi di bawah |

## Verifikasi yang dijalankan

| Perintah/skenario | Hasil |
|---|---|
| ESLint | PASS; 0 error/warning |
| TypeScript strict | PASS; 0 error |
| Unit test | PASS; 12 file, 61/61 (7 test baru) |
| Integration test PostgreSQL | PASS; 13 file, 112/112 (6 test baru, terhadap MinIO nyata) |
| E2E Playwright | PASS; 44/44 (tanpa perubahan dari Phase 8) |
| Production build (lokal, dengan placeholder var production) | PASS; lihat catatan `RUNBOOK.md` §Setup lokal |
| Production build (via `docker build`) | PASS; image 329MB |
| Stack `docker-compose.prod.yml` penuh (lokal) | PASS; app+Postgres+MinIO+Nginx start sehat, saling terhubung, `/api/readiness` 200, redirect HTTP->HTTPS bekerja, `nginx -t` valid |
| `npm audit` (dev+prod) | PASS; 0 vulnerabilities |

## Migration dan konfigurasi

- Migration baru: `20260812070054_fix_auth_rate_limit_reset_token_id_type` - diterapkan ke database dev dan test lokal, **belum diterapkan ke production** (belum ada database production).
- Dependency baru: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `resend` (semua production dependency, dipakai adapter Phase 9).
- Tidak ada breaking change pada dependency yang sudah ada.

## Risiko, asumsi, dan technical debt

- **Belum pernah dijalankan di server Contabo sungguhan.** Semua verifikasi Phase 9 dilakukan di lingkungan Docker lokal saya (image build, stack compose, konektivitas antar-service, Nginx). Sebelum go-live nyata: jalankan seluruh urutan di `RUNBOOK.md` §Deployment readiness pada server Contabo yang sebenarnya, termasuk DNS/TLS nyata dan smoke test kirim email dengan `RESEND_API_KEY` sungguhan (poin 5.6 di §Smoke test post-deploy) - saya tidak punya dan tidak seharusnya meminta credential production untuk ini.
- **MinIO access key**: `docker-compose.prod.yml` memungkinkan memakai `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD` langsung sebagai `MINIO_ACCESS_KEY`/`MINIO_SECRET_KEY` untuk kesederhanaan awal. Disarankan (didokumentasikan di RUNBOOK) membuat access key terpisah berhak akses minimal begitu ada waktu, tapi tidak saya paksakan sebagai default karena butuh langkah manual di console MinIO yang tidak bisa saya otomatisasi tanpa server nyata.
- **CAPTCHA (Turnstile) dan error tracking (Sentry)**: tetap belum diimplementasikan sama sekali - tidak termasuk 5 keputusan Anda, jadi sengaja tidak disentuh. Masih placeholder env var tanpa kode.
- **`npm run build` lokal kini butuh 5 var placeholder production** (MinIO/Resend) karena `next build` selalu berjalan mode production secara internal. Didokumentasikan di `RUNBOOK.md` §Setup lokal supaya tidak membingungkan sesi development berikutnya.
- Rollback drill KODE (redeploy image sebelumnya) belum pernah benar-benar dilatih (baru didokumentasikan sebagai prosedur) - berbeda dari restore drill DATABASE yang sudah benar-benar dijalankan dan diverifikasi Phase 8.
- Schema drift `auth_rate_limits`/`password_reset_tokens` - **selesai**, tidak lagi technical debt (item ini SELESAI, bukan ditunda seperti fase-fase sebelumnya).

## Cara saya memeriksa hasil

1. Jalankan `npm run lint`, `npx tsc --noEmit`, `npm run test`, `npm run test:integration` (perlu `MINIO_TEST_ENDPOINT` menunjuk ke container MinIO lokal - lihat `tests/integration/storage-minio.test.ts`), `npm run test:e2e`, `npm audit` - semua harus lulus.
2. Build lokal: `MINIO_ENDPOINT=... MINIO_ACCESS_KEY=... MINIO_SECRET_KEY=... RESEND_API_KEY=... RESEND_FROM_EMAIL=... npm run build` (lihat `RUNBOOK.md` §Setup lokal untuk contoh nilai placeholder).
3. Build Docker: `docker build -t sekolah-ormawa:test .` - harus sukses.
4. Baca `deploy/nginx/nginx.conf` dan `docker-compose.prod.yml` untuk memahami topologi (hanya Nginx publish port host; Postgres/MinIO/app hanya lewat Docker network internal).
5. Baca `RUNBOOK.md` §Deployment readiness bagian 1-7 sebagai urutan lengkap untuk go-live sungguhan di Contabo - belum satu pun langkah di sana yang benar-benar dieksekusi terhadap server nyata.

## Keputusan yang dibutuhkan

Tidak ada yang memblokir penyelesaian Phase 9 ini sendiri. Untuk go-live sungguhan, Anda perlu menjalankan sendiri (atau memberi saya akses eksplisit dan terkontrol untuk menjalankan) langkah-langkah di `RUNBOOK.md` §Deployment readiness terhadap server Contabo yang sebenarnya - termasuk mengisi credential production sungguhan (MinIO, Resend, `AUTH_SECRET`, dll.) yang tidak pernah saya buat atau lihat.

## Batas fase

Seluruh 5 keputusan Anda sudah diimplementasikan dan lolos quality gate. **Tidak ada deploy ke server Contabo sungguhan, tidak ada credential production yang dibuat/diisi oleh saya, tidak ada migration yang dijalankan terhadap database production** (karena belum ada database production). Pekerjaan berhenti setelah laporan ini dan menunggu instruksi Anda untuk langkah selanjutnya.
