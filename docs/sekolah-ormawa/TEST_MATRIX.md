# Test Matrix Sekolah Ormawa

## Aturan status

- `PASS`: bukti implementasi atau verifikasi fase tersedia.
- `PLANNED`: implementasi/test berada di fase berikutnya.
- `BLOCKED`: membutuhkan keputusan atau environment yang belum tersedia.

## Matrix

| ID | Requirement | Test/bukti | Fase | Status |
|---|---|---|---:|---|
| P0-01 | PRD lengkap | Ekstraksi/inspeksi 18 halaman | 0 | PASS |
| P0-02 | Arsitektur standalone final | Review repository, runtime dependency, ownership | 0 | PASS |
| P0-03 | Auth internal final | Review hash, session, reset, revoke, forced password | 0 | PASS |
| P0-04 | Department scope | Review constraint role/scope dan policy backend | 0 | PASS |
| P0-05 | Env/storage/ops | Review nama env, private storage, runbook | 0 | PASS |
| P0-06 | Tidak ada Phase 1 | Inventaris workspace | 0 | PASS |
| F1-01 | App standalone berjalan | Start build lokal; `/`, health, dan readiness HTTP 200; database `ready` | 1 | PASS |
| F1-02 | TypeScript strict/quality | lint, typecheck, 7 unit test, production build | 1 | PASS |
| F1-03 | Migration database kosong | Dua migration diterapkan dari nol pada database development kosong | 1 | PASS |
| F1-04 | Role/scope constraint | PostgreSQL menolak DEPT_PJ tanpa department dan Super Admin dengan department | 1 | PASS |
| F1-05 | Unique account identity | Functional unique index menolak email beda case/whitespace | 1 | PASS |
| F1-06 | Candidate constraints | 8 integration test mencakup NIM/email, choices, IPK, dan active lock | 1 | PASS |
| F1-07 | Seed sintetis | Seed dua kali; 13 unit DRAFT, 2 akun fixture, tanpa PII/credential nyata | 1 | PASS |
| F1-08 | Guardrail repository/env | Git main tanpa remote; env/secret/upload/local DB di-ignore; Phase 2 belum dibuat | 1 | PASS |
| F2-01 | Landing lengkap | Seluruh section wajib dan lima route publik tersedia | 2 | PASS |
| F2-02 | Responsive/accessibility | Visual QA 360x800, 390x844, 768x1024, 1440x900; keyboard nav, focus, semantic, reduced motion, overflow | 2 | PASS |
| F2-03 | Public isolation/SEO | Query hanya periode/departemen; metadata, canonical, OG, sitemap, robots; tidak ada data kandidat | 2 | PASS |
| F2-04 | CTA server-side | Unit test OPEN/UPCOMING/CLOSED/UNAVAILABLE dan inspeksi periode `DRAFT` tanpa link form | 2 | PASS |
| F2-05 | Direktori Birdep | 13 unit dari master database, BPH/non-penerima sebagai profil saja, Media Branding memuat info portofolio | 2 | PASS |
| F3-01 | Form lima langkah | E2E form, keyboard, focus summary, visual QA empat viewport | 3 | PASS |
| F3-02 | Draft/validasi | Refresh, expiry/schema/period, file exclusion, consent reset, boundaries | 3 | PASS |
| F3-03 | Private upload | Extension, MIME, magic byte, size, checksum, ownership, signed expiry, public negative | 3 | PASS - adapter development |
| F3-04 | Duplicate/idempotency | Request paralel/replay menghasilkan satu kandidat dan nomor unik | 3 | PASS |
| F3-05 | Period close/outbox | Backend reject; email failure tetap committed dan retryable | 3 | PASS |
| F3-P01 | Media Branding di Pilihan 1 tanpa portofolio | Server menolak submit dengan error field yang jelas | 3 | PASS |
| F3-P02 | Media Branding di Pilihan 2 tanpa portofolio | Server menerapkan aturan identik Pilihan 1 | 3 | PASS |
| F3-P03 | Tidak memilih Media Branding tanpa portofolio | Happy path non-Medbrand berhasil | 3 | PASS |
| F3-P04 | Satu JPG/JPEG/PNG valid | Integration test JPG Pilihan 1 dan PNG Pilihan 2 | 3 | PASS |
| F3-P05 | Satu URL portofolio valid | URL HTTPS valid memenuhi requirement tanpa server fetch | 3 | PASS |
| F3-P06 | File dan URL sama-sama diberikan | Keduanya diterima sebagai item terpisah sampai batas jumlah | 3 | PASS |
| F3-P07 | MIME/extension file tidak diizinkan | Magic byte/extension/MIME mismatch ditolak | 3 | PASS |
| F3-P08 | File melebihi batas configurable | Server menolak di atas default development 5 MiB | 3 | PASS |
| F3-P09 | Item melebihi batas configurable | Item keenam ditolak pada maksimum lima | 3 | PASS |
| F3-P10 | URL invalid/tidak aman | Non-HTTPS, malformed, credential URL, dan batas panjang ditolak; server tidak fetch | 3 | PASS |
| F3-P11 | Metadata item opsional dan terbatas schema | Judul/deskripsi/peran/tahun/urutan disimpan; deskripsi tidak diwajibkan sebelum policy final | 3 | PASS WITH NOTE |
| F3-P12 | Tampering ownership/finalize | Draft lain tidak dapat menggunakan object; submit hanya menerima upload tervalidasi miliknya | 3 | PASS |
| F4-01 | Password Argon2id | PHC hash, random salt, verify, minimum/maksimum tanpa truncation | 4 | PASS |
| F4-02 | Login rate limit | HMAC IP+email, counter PostgreSQL atomik, generic error, concurrency | 4 | PASS |
| F4-03 | Temporary password | Expiry dan akses dibatasi hingga password berubah | 4 | PASS |
| F4-04 | Session lifecycle | Login, absolute/idle expiry, logout, revoke current/all, session version | 4 | PASS |
| F4-05 | Reset password | Token hash single-use; invalid/expired/replay; revoke seluruh session | 4 | PASS |
| F4-06 | Disabled/banned account | Login dan session lama ditolak setelah disable/ban | 4 | PASS |
| F4-07 | Role matrix | Super Admin, PJ, unauthenticated, forced-password untuk admin route | 4 | PASS |
| F4-08 | Scope tampering | Department selalu dari session/database; resource luar scope 404 | 4 | PASS |
| F4-09 | Shared-account guardrail | Unique identity, akun individual, audit login/session tanpa secret | 4 | PASS |
| F5-01 | Kandidat tersegmentasi | Integration test primary/secondary/locked per Birdep; kandidat terkunci Birdep lain tidak muncul di segmen manapun | 5 | PASS |
| F5-02 | Isolasi data/catatan | `findScopedCandidateId`/`getCandidateDetail` null di luar scope; `requireDepartmentAccess` 404 untuk PJ lintas Birdep; catatan department-scoped diuji lintas Birdep | 5 | PASS |
| F5-03 | File viewer | Endpoint `api/admin/candidates/[id]/files/[fileId]` diautorisasi session/role/scope per-request, menulis audit `FILE_VIEW`, menolak di luar scope; diuji integration dan manual browser | 5 | PASS |
| F5-04 | Search/filter/cursor | Search nama/NIM/email/nomor registrasi; cursor keyset pada `(sort, id)` dengan whitelist 4 sort; diuji tiga halaman berurutan tanpa overlap | 5 | PASS |
| F6-01 | Race 50 lock | 50 percobaan konkuren pada satu kandidat: tepat 1 sukses, 49 ditolak status 409, tepat 1 baris active lock di database | 6 | PASS |
| F6-02 | Lock authorization | Lock ditolak (404) untuk department yang tidak dipilih kandidat; ditolak (409) untuk kandidat yang sudah terkunci | 6 | PASS |
| F6-03 | Unlock/audit | Unlock transaksional, menghormati aturan periode (OPEN/CLOSED, `allowUnlock`), audit LOCK/UNLOCK, placement dihapus saat unlock; override (Super Admin membuka kunci Birdep lain) tetap Phase 7 | 6 | PASS |
| F7-01 | Account PJ lifecycle | Create tanpa temp password (setup link outbox), edit, disable/enable, reset link, revoke sesi, ditolak untuk email duplikat/department invalid oleh Super Admin | 7 | PASS |
| F7-02 | Period/candidate admin | Update status/config periode dan ketersediaan per Birdep; soft-delete (ditolak saat kandidat locked) dan restore kandidat; override unlock lintas-Birdep bypass aturan periode, ter-audit `OVERRIDE` | 7 | PASS |
| F7-03 | Export safety | Scope per Birdep, escaping formula CSV (`=+-@`), mengecualikan kandidat WITHDRAWN, tanpa object key/URL file | 7 | PASS |
| F7-04 | Broadcast guard | Preview tanpa efek samping, token HMAC ber-TTL wajib cocok konten persis (double confirmation), outbox idempotent saat token direplay, ditolak saat token invalid/kedaluwarsa/tanpa penerima | 7 | PASS |
| F8-01a | Security headers/CSP | `next.config.mjs` baseline+admin header set; curl verifikasi 5 header pada `/` dan `/admin/login` | 8 | PASS |
| F8-01b | CSRF pada state-changing endpoint | `assertValidCsrf` ditambahkan ke upload/submit/delete registration dan admin endpoint yang belum terlindungi | 8 | PASS |
| F8-01c | Rate limit tambahan | `REGISTRATION_UPLOAD`, `REGISTRATION_DOWNLOAD`, `ADMIN_FILE_ACCESS`, `ADMIN_EXPORT`, `ADMIN_BROADCAST_SEND` ditambah ke `RateLimitScope` dan endpoint terkait | 8 | PASS |
| F8-01d | Upload size pre-check | `Content-Length` diperiksa sebelum body dibuffer penuh (413 dini) | 8 | PASS |
| F8-01e | Dependency vulnerabilities | `npm audit` (dev+prod) 0 vulnerabilities setelah upgrade `next`/`eslint-config-next` ke 16.3.0 | 8 | PASS |
| F8-02 | Authorization matrix negative test | Publik->401 (5 endpoint sensitif), PJ lintas-Birdep->404, PJ->override/broadcast/akun/periode->403, sesi dicabut/dihapus->401, kontrol positif Super Admin->200 | 8 | PASS |
| F8-03 | Re-konfirmasi race/idempotency | 5 skenario Phase 6/7 (race 50 lock, duplicate NIM/email paralel, idempotency-key replay, period-closed reject, outbox retry tanpa kirim ganda) lulus ulang pada build Phase 8 (post security-audit, post upgrade Next.js) | 8 | PASS |
| F8-04a | Load test lonjakan pendaftaran | 60 submission unik konkuren; **ditemukan bug**: Serializable isolation pada counter nomor registrasi menyebabkan 72-85% gagal di bawah beban; diperbaiki (counter diekstrak jadi atomic increment terpisah + turun ke read-committed) -> 0/60 gagal, wall time ~1.9 detik | 8 | PASS |
| F8-04b | Database connection pooling | 100 query konkuren `pg_sleep` terhadap `pool.max=20`; seluruhnya selesai lewat antrean (bukan error), 394ms total | 8 | PASS |
| F8-05 | Aksesibilitas WCAG 2.1 AA | axe-core pada 14 kombinasi rute publik+admin (PJ/Super Admin); **2 bug color-contrast ditemukan dan diperbaiki** (`.site-footer__columns h3`, `.gallery-card__number` pada varian gold/sage); keyboard nav + focus ring + alt text + label form diverifikasi terpisah | 8 | PASS |
| F8-06 | Responsive visual | 360px/768px/1280px x 14 rute, tanpa horizontal overflow; 42 screenshot di `docs/artifacts/phase-8/responsive/` | 8 | PASS |
| F8-07 | Backup/restore drill | `pg_dump`/`pg_restore` ke container Postgres terpisah (volume baru, tanpa shared state); row count dan checksum konten (`md5`) database cocok 100%; tarball storage di-extract ke direktori terpisah, checksum SHA-256 cocok 100% | 8 | PASS |
| F8-08 | Deployment readiness | Checklist env var production (tanpa nilai secret), DNS/TLS plan, urutan migration, smoke test post-deploy, rollback plan, verifikasi pasca-deploy - `RUNBOOK.md` §Deployment readiness; **gap blocking ditemukan**: adapter storage/email production belum diimplementasikan (baru env var placeholder) | 8 | PASS - dengan gap terdokumentasi |
| F8-09 | UAT checklist | Checklist non-teknis 3 role (Super Admin, PJ Birdep, Peserta) dengan langkah aksi+hasil diharapkan, larangan eksplisit broadcast nyata | 8 | PASS |
| F9-01 | Port Postgres dev permanen | `docker-compose.yml`, `.env`, `.env.example` konsisten `15432`; full test suite lulus tanpa override manual | 9 | PASS |
| F9-02 | Schema drift `auth_rate_limits`/`password_reset_tokens` | Migration `20260812070054_fix_auth_rate_limit_reset_token_id_type`; `prisma migrate diff` melaporkan "No difference detected" setelah apply; full test suite lulus | 9 | PASS |
| F9-03 | Adapter storage production MinIO (S3-compatible) | `MinioPrivateStorage` diuji terhadap MinIO nyata (ephemeral container): put/read round-trip, delete, presigned upload/download benar-benar dapat diakses tanpa credential, TTL kedaluwarsa ditolak, error jelas saat credential tidak lengkap | 9 | PASS |
| F9-04 | Adapter email production Resend | `ResendEmailAdapter` diuji dengan SDK di-mock: subjek/html/text benar untuk 4 jenis payload, idempotency key diteruskan ke Resend, error provider dilempar ulang sebagai error yang jelas | 9 | PASS |
| F9-05 | Deployment artifact self-hosted (Docker/Nginx) | `Dockerfile` (standalone Next.js, image 329MB) build sukses; stack penuh `docker-compose.prod.yml` (app+Postgres+MinIO+Nginx) diverifikasi lokal - app<->Postgres (readiness 200), app<->MinIO (reachable), Nginx HTTP->HTTPS redirect dan ACME challenge path benar, `nginx -t` valid | 9 | PASS |
| F9-06 | Nginx X-Forwarded-For hardening | Konfigurasi diperbaiki dari `$proxy_add_x_forwarded_for` (bisa dispoof client) ke `$remote_addr` (selalu IP koneksi TCP asli) - mencegah bypass rate limiter lewat header X-Forwarded-For palsu | 9 | PASS |

## Bukti Phase 0 revisi

- Lima dokumen konsisten dengan repository standalone dan auth internal.
- SSO hanya disebut sebagai future scope, bukan dependency MVP.
- Nilai secret tidak ditulis.
- Tidak ada source aplikasi, migration, atau dependency Phase 1.

## Bukti Phase 1

- Prisma schema valid dan dua migration development dapat diterapkan pada PostgreSQL kosong.
- Seed sintetis idempotent pada dua eksekusi berurutan.
- Lint dan TypeScript strict lulus tanpa error.
- 7 unit test dan 8 integration test PostgreSQL lulus.
- Production build Next.js 16.2.7 lulus; root, health, dan readiness berjalan lokal.
- Tidak ada remote Git, akun nyata, bucket, email, database production, migration production, atau deployment.

## Bukti Phase 2

- Landing dan empat route pendukung memenuhi checklist konten publik, semuanya menggunakan Bahasa Indonesia dan label `DRAFT` untuk data yang belum final.
- Status CTA dihitung server-side dari periode database; periode seed `DRAFT` menghasilkan status akan datang tanpa link form.
- Direktori menampilkan 13 unit master, membedakan profil dan slot terbuka, dan tidak memuat kandidat.
- 5 file/14 unit test, 1 file/8 integration test PostgreSQL, lint, TypeScript strict, dan production build lulus.
- Visual QA dan pemeriksaan DOM/accessibility terdokumentasi pada `PHASE2_VISUAL_QA.md`.
- Kontrak portofolio Media Branding dan 12 skenario uji tercatat tanpa membuat form atau migration Phase 3.

## Bukti Phase 3

- Route `/daftar` dan `/daftar/sukses` menjalankan form lima langkah, state closed fail-safe, draft teks, review consent, submit, dan bukti bertoken pendek.
- Unit test mencakup normalisasi/validasi payload, HTTPS portfolio, batas jumlah, magic byte, MIME/extension/size, ownership signature, serta configuration gate.
- Integration test PostgreSQL mencakup transaksi kandidat, JPG/PNG/URL Media Branding, missing portfolio, idempotency, konkurensi NIM/email, sequence, closed period, outbox failure, orphan cleanup, dan token confirmation invalid/expired.
- E2E mencakup keyboard/focus error, draft refresh dan schema lama, happy path, Medbrand Pilihan 2, serta negative public file access.
- Visual QA seluruh state dan empat viewport dicatat pada `PHASE3_VISUAL_QA.md`; file kandidat tidak berada di `public/`.
- Final gate: 7 file/25 unit test, 2 file/23 integration test PostgreSQL, 6 E2E Playwright, lint, TypeScript strict, Prisma validate, seed dua kali, dan production build Next.js 16.2.12 lulus.

## Bukti Phase 9

- **Port Postgres dev**: `.env`/`.env.example`/`docker-compose.yml` disatukan ke `15432` (sebelumnya `.env` masih `55432` sementara `docker-compose.yml` sudah `15432` - override manual diperlukan sepanjang Phase 8). Full test suite (unit 61, integration 112, E2E 44) lulus tanpa override sejak fix.
- **Schema drift**: migration baru `20260812070054_fix_auth_rate_limit_reset_token_id_type` menyelaraskan `auth_rate_limits.id`/`password_reset_tokens.id` dari native `uuid` ke `text` (konsisten 15+ tabel lain di schema). Diverifikasi lewat `prisma migrate diff --exit-code` melaporkan "No difference detected" pada dev dan test database.
- **MinIO storage adapter**: 1 file baru `tests/integration/storage-minio.test.ts`, 6 test dijalankan terhadap MinIO nyata (container ephemeral lokal, bukan mock) - put/read byte-identik, delete membuat read berikutnya gagal, presigned download URL benar-benar bisa diunduh tanpa credential lewat plain `fetch`, presigned upload URL benar-benar bisa dipakai PUT langsung, TTL negatif ditolak provider, error jelas saat kredensial tidak lengkap.
- **Resend email adapter**: 1 file baru `tests/unit/resend-email-adapter.test.ts`, 7 test dengan SDK `resend` di-mock (tanpa network nyata) - keempat jenis payload (`REGISTRATION_CONFIRMATION`, `PASSWORD_RESET`, `ACCOUNT_SETUP`, `BROADCAST`) menghasilkan subjek/html/text yang benar, idempotency key diteruskan ke opsi Resend, error provider dilempar ulang sebagai `Error` yang jelas, `getEmailAdapter()` memilih adapter yang benar berdasar `NODE_ENV`.
- **Deployment artifact self-hosted**: `Dockerfile` (multi-stage, Next.js `output: "standalone"`, image akhir 329MB) berhasil di-build; stack penuh `docker-compose.prod.yml` (app+Postgres+MinIO+Nginx) dijalankan lokal dan diverifikasi - `/api/readiness` 200 (app tersambung ke Postgres lewat Docker network internal), app dapat menjangkau MinIO lewat hostname service internal, `nginx -t` valid, HTTP redirect ke HTTPS bekerja, path ACME challenge diprioritaskan benar (404 bukan redirect, siap untuk certbot webroot). Seluruh container smoke-test dan image sementara dibersihkan setelah verifikasi - tidak ada sisa di Docker lokal.
- **Temuan keamanan saat menyusun `deploy/nginx/nginx.conf`**: draft awal memakai `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for`, yang APPEND ke header yang mungkin sudah disuntik client - berpotensi membiarkan attacker men-spoof IP dan melewati rate limiter (`clientIpHash` mengambil elemen pertama `X-Forwarded-For`). Diperbaiki ke `$remote_addr` (selalu IP koneksi TCP asli, mengabaikan apa pun yang dikirim client) sebelum nginx.conf dianggap selesai.
- Final gate Phase 9: ESLint 0 error/warning, TypeScript strict 0 error, unit 12 file/61 test (7 test baru), integration 13 file/112 test PostgreSQL (6 test baru), E2E 44/44 (tanpa perubahan dari Phase 8), production build Next.js 16.3.0 (lokal dan lewat Docker), `npm audit` 0 vulnerabilities. Dependency baru: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `resend`.

## Bukti Phase 8

- **P1 Security audit**: header keamanan (CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy) diverifikasi lewat curl pada `next.config.mjs` split baseline/admin header; CSRF (`assertValidCsrf`) ditambahkan ke `registration/uploads` (POST/DELETE/GET), `registration/submit`; rate limit baru untuk upload/download registrasi dan file/export/broadcast admin; upload size pre-check dari `Content-Length`; `npm audit` 0 vulnerabilities setelah upgrade `next`/`eslint-config-next` 16.2.12->16.3.0 (patch yang sebelumnya diblokir sejak Phase 4 kini tersedia).
- **P2 Authorization matrix**: 1 file baru `tests/integration/authorization-matrix.test.ts`, 14 test - publik tanpa sesi -> 401 pada 5 endpoint sensitif (list/accounts/periods/broadcast-preview/override); PJ Birdep A mengakses kandidat/list Birdep B -> 404 (bukan 403, konsisten ADR-025); PJ mencoba override/broadcast/accounts/periods -> 403; sesi yang di-bump `sessionVersion` atau dihapus -> 401 pada seluruh route admin; kontrol positif Super Admin -> 200 pada accounts/periods/broadcast-preview.
- **P3 Re-konfirmasi race/idempotency**: seluruh 104 test integration existing (termasuk F6-01 race 50 lock, F3-04 duplicate NIM/email paralel, idempotency-key replay, period-closed reject, outbox retry-tanpa-kirim-ganda di `auth-lifecycle.test.ts`) dikonfirmasi ulang lulus pada build Phase 8 (post security patch, post Next.js 16.3.0) tanpa perubahan kode pada mekanisme yang diuji.
- **P4 Performance/accessibility**:
  - 1 file baru `tests/integration/load-performance.test.ts` - **menemukan bug produksi nyata**: `submitRegistration` memakai Serializable isolation untuk seluruh transaksi termasuk increment counter `registrationSequence` bersama; di bawah 60 submission konkuren (simulasi lonjakan traffic dekat deadline), 72-85% gagal dengan `TRANSACTION_RETRY_EXHAUSTED` atau bahkan bocor raw Prisma error (bug kedua: retry-exhaustion pada percobaan terakhir tidak dibungkus jadi error yang bersih). Perbaikan: (1) percobaan terakhir kini selalu jatuh ke error 409 yang bersih; (2) counter registrationSequence diekstrak jadi atomic single-row update terpisah di luar transaksi Serializable; (3) isolation level transaksi utama diturunkan ke read-committed (default Postgres) karena tidak ada lagi shared-write row di dalamnya - keamanan idempotency-key tetap dijaga `pg_advisory_xact_lock` (isolation-independent), uniqueness NIM/email tetap dijaga unique constraint DB. Hasil setelah perbaikan: 60/60 sukses, wall time ~1.9 detik (dari sebelumnya 51-43/60 gagal).
  - Pool test: 100 query konkuren `pg_sleep(30ms)` terhadap `pool.max=20` (`src/lib/db.ts`) - seluruhnya sukses lewat antrean, total 394ms, membuktikan pool queueing bekerja alih-alih error saat concurrency melebihi kapasitas.
  - 2 file E2E baru: `accessibility.spec.ts` (axe-core, 14 kombinasi rute x role, tag WCAG 2.1 A/AA + 2.1 A/AA) dan `responsive.spec.ts` (360/768/1280px x 14 rute, no-horizontal-overflow + screenshot).
  - **2 bug WCAG 2.1 AA color-contrast ditemukan dan diperbaiki** di `globals.css`: `.site-footer__columns h3` (opacity putih 0.42 pada `--burgundy-dark` = ~3.77:1, dinaikkan ke 0.52 = ~5.1:1); `.gallery-card__number` pada varian gold/sage (opacity 0.8 tidak cukup di kedua background, dan warna putih tidak mungkin mencapai 4.5:1 di atas `--gold` pada opacity berapa pun - diberi override warna gelap `var(--ink)` khusus varian gold, dan base opacity dinaikkan ke 0.85 untuk varian sage).
  - Satu exclusion axe yang didokumentasikan (bukan bug): `.site-footer__marquee` (teks brand berulang `aria-hidden="true"`, murni dekoratif, dikecualikan dari scan kontras sesuai pengecualian "pure decoration" WCAG SC 1.4.3).
  - Dependency baru: `@axe-core/playwright` (devDependency, 0 vulnerabilities).
- **P5 Backup/restore drill**: dijalankan 2026-08-12 terhadap `sekolah_ormawa_dev` (bukan test DB) ke container Postgres baru yang benar-benar terpisah (volume kosong baru, tanpa shared state dengan sumber). Row count dan checksum konten (`md5(string_agg(...))`) 7 tabel inti cocok 100%; storage backup (tar.gz) di-extract ke direktori terpisah, checksum SHA-256 2 file cocok 100%. Detail lengkap dan gap RPO/RTO di `RUNBOOK.md` §Backup dan restore.
- **P6 Deployment readiness**: `RUNBOOK.md` §Deployment readiness ditulis ulang lengkap (checklist env var tanpa nilai secret, DNS/TLS, urutan migration, smoke test, rollback plan, verifikasi pasca-deploy). **Gap blocking ditemukan saat penyusunan**: adapter storage production (Supabase) dan email production (Resend) belum diimplementasikan sama sekali di kode (`getPrivateStorage()`/`LocalEmailSinkAdapter` keduanya `throw` saat `NODE_ENV=production`) - env var-nya baru placeholder di `.env.example`. Ini sudah tercatat sebagai blocking item di `DECISIONS.md`, tapi belum diimplementasikan.
- **P7 UAT checklist**: `UAT_CHECKLIST.md` baru, 3 bagian (Super Admin, PJ Birdep, Peserta), format aksi->hasil diharapkan dengan checkbox, larangan eksplisit klik kirim broadcast nyata dan larangan data pribadi asli.
- Final gate Phase 8: ESLint 0 error/warning, TypeScript strict 0 error, unit 11 file/54 test, integration 12 file/106 test PostgreSQL (2 file baru: authorization-matrix 14 test, load-performance 2 test), E2E 44/44 (2 file baru: accessibility 20 test, responsive 12 test), production build Next.js 16.3.0, `npm audit` 0 vulnerabilities.

## Bukti Phase 7

- 1 file/6 unit test baru (CSV escaping); 5 file/28 integration test baru (account lifecycle, period admin, candidate admin/override, export, broadcast) mencakup F7-01 s.d. F7-04.
- Total setelah Phase 7: 11 file/54 unit test, 10 file/90 integration test PostgreSQL, 12 E2E Playwright (1 assertion shell + 3 assertion nav Super-Admin-only diperbarui/ditambah untuk konten Phase 7).
- Production build Next.js 16.2.12 mengompilasi 16 route API baru dan 3 halaman admin baru (`akun`, `periode`, `broadcast`).
- Akun Super Admin baru sengaja **tidak** dapat dibuat lewat UI (keputusan eksplisit pemilik proyek) — hanya lewat seed/database.
- Broadcast double-confirmation diimplementasikan sebagai token HMAC (bukan sekadar modal "yakin?"): preview mengunci konten+filter persis; mengubah pesan setelah preview membatalkan token dan memaksa preview ulang; token yang sama direplay tidak mengirim ulang (outbox idempotent lewat unique constraint).

## Bukti Phase 6

- 1 file/8 unit test baru untuk validasi reason/placement; 1 file/10 integration test PostgreSQL baru mencakup race 50 lock konkuren, authorization lintas Birdep, aturan periode unlock (OPEN/CLOSED/ARCHIVED, `allowUnlock`), audit LOCK/UNLOCK, siklus placement (create-on-lock, update status, delete-on-unlock), dan isolasi placement lintas Birdep.
- Total setelah Phase 6: 10 file/48 unit test, 5 file/66 integration test PostgreSQL, 12 E2E Playwright (tanpa perubahan assertion baru).
- Production build Next.js 16.2.12 mengompilasi 2 route API baru (`lock`, `placement`) dan UI lock/placement pada halaman detail kandidat.
- Bug desain ditemukan dan diperbaiki selama pengembangan F6-01 (bukan sekadar test yang salah - lihat detail di `PHASE6_VISUAL_QA.md`/`PHASE_STATUS.md`): implementasi awal memakai isolasi `Serializable` untuk transaksi lock, yang di bawah 50 percobaan konkuren pada satu baris kandidat menyebabkan *retry storm* (seluruh 50 percobaan gagal, bukan hanya 49). Diperbaiki dengan mendesain ulang agar partial unique index PostgreSQL menjadi satu-satunya sumber kebenaran konkurensi (native unique-violation, fail-fast, tanpa retry), plus memperbesar connection pool aplikasi (`max: 20`) yang sebelumnya memakai default node-postgres (10) dan menjadi bottleneck terpisah di bawah beban yang sama.

## Bukti Phase 5

- 4 file/14 unit test baru untuk validasi query list dan body catatan; 1 file/14 integration test PostgreSQL baru mencakup segmentasi, isolasi lintas Birdep (termasuk kandidat terkunci Birdep lain), file viewer + audit `FILE_VIEW`, upload PENDING tersembunyi, search, cursor pagination tiga halaman, dan CRUD catatan (create/update/soft-delete + isolasi lintas Birdep + audit trail CREATE/UPDATE/SOFT_DELETE).
- Total setelah Phase 5: 9 file/40 unit test, 4 file/56 integration test PostgreSQL, 12 E2E Playwright (1 assertion shell Phase 4 diperbarui ke konten Phase 5).
- Production build Next.js 16.2.12 mengompilasi seluruh route Phase 1-5 termasuk 5 route API kandidat baru dan 2 halaman dashboard.
- Visual QA 4 viewport (360x800, 390x844, 768x1024, 1440x900) mencakup dashboard tersegmentasi, pencarian, detail kandidat, dan catatan; lihat `PHASE5_VISUAL_QA.md`.
- Bug ditemukan dan diperbaiki selama verifikasi manual: E2E `auth.spec.ts` masih menegaskan placeholder shell Phase 4 ("Identitas terverifikasi", "Tidak ada kandidat, statistik") yang sudah digantikan Dashboard PJ; assertion diperbarui ke heading dan `phase-boundary-note` Phase 5 yang benar.

## Bukti Phase 4

- 8 file/29 unit test, 3 file/42 integration test PostgreSQL, dan 12 E2E Playwright lulus. Terdapat 29 test khusus auth ditambah boundary/role/origin variants di dalam test; total case keamanan yang diverifikasi melampaui 30 skenario wajib.
- Login dua role, generic error, disabled/banned, Argon2id, password boundaries, temporary expiry, atomic concurrent rate limit, cookie attributes, CSRF, dan open redirect diuji.
- Absolute/idle expiry, logout, revoke-all, session version, forced password, change rotation, reset invalid/expired/replay/single-use, serta email sink idempotent diuji.
- Permission Super Admin/PJ, department scope, outside-scope 404, authorization audit, dan redaction password/cookie/token diuji pada backend nyata.
- Visual QA 360x800, 390x844, 768x1024, dan 1440x900 beserta enam artefak tersedia pada `PHASE4_VISUAL_QA.md`.
- Empat migration berhasil dari nol pada `sekolah_ormawa_phase4_clean`; seed sintetis lulus dua kali. Tidak ada migration atau resource production.
