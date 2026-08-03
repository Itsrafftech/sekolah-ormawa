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
| F5-01 | Kandidat tersegmentasi | Primary/secondary/locked dan ordering stabil | 5 | PLANNED |
| F5-02 | Isolasi data/catatan | PJ di luar scope mendapat 404/tidak dapat CRUD | 5 | PLANNED |
| F5-03 | File viewer | Authorization server dan URL pendek | 5 | PLANNED |
| F5-04 | Search/filter/cursor | Whitelist sort dan pagination stabil | 5 | PLANNED |
| F6-01 | Race 50 lock | Tepat satu sukses, lainnya 409, satu active row | 6 | PLANNED |
| F6-02 | Lock authorization | Hanya kandidat yang memilih department session | 6 | PLANNED |
| F6-03 | Unlock/override/audit | Transactional, period rule, rollback bila audit gagal | 6 | PLANNED |
| F7-01 | Account PJ lifecycle | Create/edit/reset/disable/revoke oleh Super Admin | 7 | PLANNED |
| F7-02 | Period/candidate admin | Close, soft delete/restore, override ter-audit | 7 | PLANNED |
| F7-03 | Export safety | Scope, formula escaping, tanpa object key/URL | 7 | PLANNED |
| F7-04 | Broadcast guard | Preview, test, confirmation, outbox idempotent | 7 | PLANNED |
| F8-01 | Full quality/security gate | lint/typecheck/unit/integration/E2E/build/security | 8 | PLANNED |
| F8-02 | Performance/accessibility | Load, pooling, route visual dan WCAG | 8 | PLANNED |
| F8-03 | Backup/restore | Database dan storage di environment terpisah | 8 | PLANNED |
| F8-04 | Deployment readiness | DNS/TLS/env/migration/smoke/rollback/UAT | 8 | PLANNED |

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

## Bukti Phase 4

- 8 file/29 unit test, 3 file/42 integration test PostgreSQL, dan 12 E2E Playwright lulus. Terdapat 29 test khusus auth ditambah boundary/role/origin variants di dalam test; total case keamanan yang diverifikasi melampaui 30 skenario wajib.
- Login dua role, generic error, disabled/banned, Argon2id, password boundaries, temporary expiry, atomic concurrent rate limit, cookie attributes, CSRF, dan open redirect diuji.
- Absolute/idle expiry, logout, revoke-all, session version, forced password, change rotation, reset invalid/expired/replay/single-use, serta email sink idempotent diuji.
- Permission Super Admin/PJ, department scope, outside-scope 404, authorization audit, dan redaction password/cookie/token diuji pada backend nyata.
- Visual QA 360x800, 390x844, 768x1024, dan 1440x900 beserta enam artefak tersedia pada `PHASE4_VISUAL_QA.md`.
- Empat migration berhasil dari nol pada `sekolah_ormawa_phase4_clean`; seed sintetis lulus dua kali. Tidak ada migration atau resource production.
