# Keputusan Arsitektur dan Pertanyaan Terbuka

## Keputusan final Opsi A

| ID | Status | Keputusan | Konsekuensi |
|---|---|---|---|
| ADR-001 | FINAL | Sekolah adalah repository standalone pada path kanonis workspace | Root repository langsung menjadi aplikasi; tidak ada `apps/sekolah` |
| ADR-002 | FINAL | Domain produksi `sekolah.ormawaeksekutifpku.com` | DNS/TLS dan deployment independen |
| ADR-003 | FINAL | PostgreSQL, migration, storage, environment, dan release cycle mandiri | Tidak ada schema/foreign key/runtime dependency Nexus-Tevo |
| ADR-004 | FINAL | Auth internal untuk MVP | User, password hash, session, reset, revoke, dan audit dimiliki Sekolah |
| ADR-005 | FINAL | Role minimum `SUPER_ADMIN` dan `DEPT_PJ` | Role lain tidak dibuat tanpa revisi keputusan |
| ADR-006 | FINAL | Setiap `DEPT_PJ` memiliki satu department scope wajib | Backend memaksa scope dari session, bukan request client |
| ADR-007 | FINAL | Argon2id untuk password | Salt acak, parameter dibenchmark, tidak ada plaintext/legacy hash |
| ADR-008 | FINAL | Temporary password wajib diganti pada login pertama | Akses admin dibatasi hingga password berubah |
| ADR-009 | FINAL | Session database dapat dicabut | Logout, reset, disable, revoke-one/revoke-all, dan expiry menghapus atau menginvalidasi row session Better Auth |
| ADR-010 | FINAL | Super Admin mengelola lifecycle akun PJ | Create/edit/disable/reset/revoke wajib ter-audit |
| ADR-011 | FINAL | SSO Nexus di luar scope MVP | Hanya dapat masuk melalui future ADR dan migration plan tersendiri |
| ADR-012 | FINAL | Nexus-Tevo hanya referensi organisasi/visual | Data disalin sebagai seed/master lokal setelah divalidasi |
| ADR-013 | FINAL | Dokumen kandidat berada di private object storage | Tidak ada dokumen di `public/` atau URL publik permanen |
| ADR-014 | FINAL | Seluruh authorization ditegakkan backend | UI hanya mencerminkan hasil policy, bukan kontrol keamanan |
| ADR-015 | FINAL - Phase 1 | Gunakan Better Auth dengan Prisma adapter | Dokumentasi resmi menyatakan kompatibel dengan Next.js 16; menyediakan email/password, database session, reset password, rate limit, dan admin session controls |
| ADR-016 | FINAL - Phase 1 | Override password hashing Better Auth dengan Argon2id melalui `@node-rs/argon2` | Memenuhi keputusan Argon2id tanpa membangun credential flow dari nol |
| ADR-017 | FINAL - Phase 1, PARTIALLY SUPERSEDED | Ikuti schema auth Better Auth lalu tambahkan field domain Sekolah | Password/session tetap mengikuti library; keputusan reset `verifications` diganti ADR-023 |
| ADR-018 | FINAL - Phase 3 | Pendaftaran memiliki release gate terpisah dan fail-closed | `REGISTRATION_SUBMISSION_ENABLED` default `false`; status OPEN saja tidak cukup membuka form/submit |
| ADR-019 | FINAL - Phase 3 | Draft browser hanya menyimpan teks dengan schema, period, dan expiry | File, upload reference, token, dan consent tidak masuk `localStorage`; consent selalu diminta ulang |
| ADR-020 | FINAL - Phase 3 | Portofolio dimodelkan setelah candidate dibuat | `CandidatePortfolio` menunjuk kandidat serta tepat satu `fileUploadId` atau `externalUrl`; draft file dimiliki owner token hash |
| ADR-021 | FINAL - Phase 3 | Submit, nomor registrasi, outbox, audit, dan idempotency disatukan secara transaksional | Replay key/payload identik mengembalikan hasil awal; response secret disimpan terenkripsi; email gagal tidak membatalkan kandidat |
| ADR-022 | FINAL - Phase 4 | Better Auth tetap engine, seluruh policy sensitif dimiliki route aplikasi | Endpoint auth mentah ditutup; policy tidak dapat dilewati |
| ADR-023 | FINAL - Phase 4 | Reset memakai token hash aplikasi | `password_reset_tokens` single-use menggantikan sumber kebenaran `verifications` |
| ADR-024 | FINAL - Phase 4 | Rate limit dan revocation atomik di PostgreSQL | HMAC identity/IP, counter conflict-safe, dan session version |
| ADR-025 | FINAL - Phase 4 | Authorization backend; resource luar scope menjadi 404 | Role/scope tidak diterima dari client dan denial ter-audit |

## Dampak terhadap PRD awal

Keputusan pemilik proyek secara eksplisit menggantikan asumsi PRD berikut untuk MVP:

- struktur monorepo Nexus-Tevo-Sekolah;
- penggunaan akun, password, session, role, permission, atau membership Nexus;
- shared cookie/session package dan SSO handoff;
- panel Sekolah yang mendelegasikan reset akun ke Nexus;
- penggunaan schema/database yang sama dengan Nexus-Tevo.

Requirement produk lain - termasuk program untuk Angkatan 63, dua role admin, isolasi Birdep, lock concurrency-safe, private upload, audit, accessibility, dan phase gate - tetap berlaku.

## Evaluasi authentication library Phase 1

Better Auth `1.6.25` dipilih untuk Next.js `16.2.7`, dengan Prisma `7.9.1`, dibanding membangun auth manual atau memakai Credentials provider generik karena:

- kompatibel resmi dengan Next.js 16 dan Route Handler;
- memiliki Prisma adapter dan schema generator;
- menyediakan email/password, change/reset password, database session, revoke session, admin ban/unban, dan rate limit;
- mengizinkan fungsi hash/verify password kustom sehingga Argon2id dapat dipakai;
- additional user fields memungkinkan `mustChangePassword` dan `departmentId` disimpan pada user.

Batasan dan keputusan mitigasi:

- Prisma adapter hanya mendukung schema generation, bukan migration otomatis; migration tetap dibuat, ditinjau, dan dijalankan melalui Prisma.
- Password credential disimpan pada `accounts.password`, bukan `users.password_hash` seperti rancangan awal Phase 0.
- Token reset menggunakan tabel `verifications`, bukan tabel khusus `password_reset_tokens`.
- Session token disimpan sebagai token opaque pada tabel `sessions` sesuai schema library, bukan hash token. Database harus least-privilege, log wajib redact, cookie `HttpOnly`/`Secure`, dan revocation menghapus session row.
- Admin plugin memiliki ban/revoke controls, tetapi policy `SUPER_ADMIN`/`DEPT_PJ`, forced password, dan scope Birdep tetap ditegakkan guard server aplikasi.
- Rate limit bawaan diaktifkan juga pada development dan parameternya dibaca dari environment. Trust terhadap proxy IP header harus dikunci saat provider hosting dipilih.
- `updateAge` Better Auth adalah interval pembaruan rolling session, bukan hard idle timeout. Nama environment Phase 0 direvisi menjadi `SESSION_UPDATE_AGE_SECONDS`; hard idle policy, bila disetujui, harus dibuat dan diuji pada Phase 4.
- Callback pengiriman email reset belum diaktifkan karena provider/sender belum disetujui. Engine token reset sudah tersedia, tetapi fitur reset end-to-end tetap pekerjaan Phase 4.
- Plugin admin menyediakan primitive ban/unban dan revoke; UI serta workflow Super Admin baru dibangun pada Phase 7.

Pemetaan requirement keamanan ke fondasi yang dibuat:

| Requirement | Implementasi fondasi Phase 1 | Batas fase |
|---|---|---|
| Argon2id | Custom `hash`/`verify` memakai `@node-rs/argon2`, memory 64 MiB, time cost 3, parallelism 1 | Benchmark runtime final di Phase 4/8 |
| `mustChangePassword` | Field user tambahan dan server guard; semua akun fixture bernilai `true` | UI/alur ganti password pertama di Phase 4 |
| Account disable | Field `banned` Better Auth dan guard backend menolak user banned | UI lifecycle akun di Phase 7 |
| Session revocation | Database session dan admin revoke API; reset dikonfigurasi `revokeSessionsOnPasswordReset` | E2E lifecycle di Phase 4 |
| Reset password | Tabel `verifications`, TTL dari environment, callback reset membersihkan forced-password state | Pengiriman email belum aktif |
| Login rate limit | Better Auth database rate limit pada sign-in dan request reset | Tuning proxy/IP di Phase 8 |
| Role dan department scope | Custom access control, server guard, FK role, serta check constraint PostgreSQL | Test endpoint penuh di Phase 4-7 |

Referensi resmi: [Next.js integration](https://better-auth.com/docs/integrations/next), [email/password dan Argon2](https://better-auth.com/docs/authentication/email-password), [Prisma adapter](https://better-auth.com/docs/adapters/prisma), [admin session controls](https://better-auth.com/docs/plugins/admin), dan [rate limit](https://better-auth.com/docs/concepts/rate-limit).

## ADR-022 - Better Auth tetap menjadi engine; policy sensitif dimiliki aplikasi

Status: Accepted pada Phase 4.

Better Auth `1.6.25` tetap dipakai untuk credential account, Argon2id adapter, pembuatan/database session, cookie, dan primitive sign-in/sign-out. Endpoint mentah `/api/auth/*` sengaja ditutup; seluruh alur publik admin masuk melalui `/api/admin/auth/*` agar forced password, disable/ban, absolute/idle expiry, session version, rate limit gabungan, audit, dan response redaction tidak dapat dilewati.

Konsekuensi:

- password tetap berada pada `accounts.password` dalam format PHC Argon2id;
- token session opaque dikelola Better Auth dan tersimpan pada database library, sehingga least privilege dan redaction database/log tetap wajib;
- `users.isActive`, `users.sessionVersion`, `sessions.absoluteExpiresAt`, dan `sessions.sessionVersion` menjadi extension aplikasi;
- session actor/role/scope selalu dimuat ulang dari database; client tidak boleh menyuplai role atau department actor;
- cookie bersifat host-only, `HttpOnly`, `SameSite=Lax`, path `/`, dan `Secure` pada production.

## ADR-023 - Reset password memakai token hash aplikasi

Status: Accepted; menggantikan rancangan Phase 1 yang mengandalkan `verifications` untuk alur reset.

Phase 4 memakai tabel `password_reset_tokens` dengan random token 32 byte yang hanya dikirim melalui outbox development dan disimpan sebagai SHA-256 hash. Token ber-TTL, single-use, memiliki `usedAt`, dan token lama user diinvalidasi saat request/reset baru. Reset berhasil memperbarui hash Argon2id, membersihkan forced-password state, menaikkan `sessionVersion`, mencabut seluruh session, serta tidak melakukan auto-login.

Alasan perubahan: lifecycle single-use, replay test, request IP hash, bulk invalidation, dan audit lebih eksplisit daripada memaksakan contract `verifications`. Tabel `verifications` tetap bagian schema Better Auth tetapi bukan sumber kebenaran reset Phase 4.

## ADR-024 - Rate limit dan revocation dibuat atomik di PostgreSQL

Status: Accepted.

`auth_rate_limits` menyimpan hanya HMAC key gabungan scope + normalized identity + IP hash. `INSERT ... ON CONFLICT` menaikkan counter secara atomik agar request paralel tidak melampaui batas. Better Auth rate limit tetap aktif sebagai defense-in-depth, tetapi response dan batas alur aplikasi ditentukan service Phase 4.

Logout menghapus session saat ini. Revoke-all, password change/reset, dan account disable menaikkan `users.sessionVersion` serta menghapus session user; guard juga membandingkan versi session sehingga row lama tidak dapat digunakan bila deletion/replikasi terlambat.

## ADR-025 - Authorization selalu backend dan di luar scope menjadi 404

Status: Accepted.

Urutan guard: session valid -> expiry absolut/idle -> session version -> akun aktif/tidak banned -> role valid -> department constraint -> forced password -> permission/resource scope. `DEPT_PJ` wajib satu `departmentId` aktif, `SUPER_ADMIN` wajib tanpa department. Resource di luar Birdep PJ menghasilkan 404 untuk mengurangi enumeration; penolakan authorization ditulis ke audit tanpa password, cookie, raw IP, atau token.

## Environment variable standalone

Nama berikut adalah kontrak konfigurasi yang direncanakan. File `.env.example` hanya berisi nama dan dokumentasi, tanpa nilai production.

| Nama | Sensitif | Tujuan |
|---|---:|---|
| `NODE_ENV` | Tidak | Mode runtime |
| `NEXT_PUBLIC_APP_URL` | Tidak | Origin publik Sekolah |
| `DATABASE_URL` | Ya | Connection string aplikasi/runtime |
| `DIRECT_DATABASE_URL` | Ya | Connection langsung untuk migration bila provider memerlukannya |
| `TEST_DATABASE_URL` | Ya | Connection string database integration test |
| `AUTH_SECRET` | Ya | Secret signing/derivation auth aplikasi |
| `SESSION_COOKIE_NAME` | Tidak | Nama cookie session |
| `SESSION_MAX_AGE_SECONDS` | Tidak | Umur absolut session |
| `SESSION_IDLE_TIMEOUT_SECONDS` | Tidak | Hard idle timeout berdasarkan aktivitas session |
| `SESSION_UPDATE_AGE_SECONDS` | Tidak | Interval pembaruan rolling session Better Auth |
| `PASSWORD_RESET_TTL_SECONDS` | Tidak | Umur token reset |
| `TEMP_PASSWORD_TTL_SECONDS` | Tidak | Umur temporary password |
| `LOGIN_RATE_LIMIT_WINDOW_SECONDS` | Tidak | Window rate limit login |
| `LOGIN_RATE_LIMIT_MAX_ATTEMPTS` | Tidak | Batas percobaan per window |
| `PASSWORD_MAX_LENGTH` | Tidak | Batas password tanpa truncation |
| `SEED_SUPER_ADMIN_PASSWORD` | Ya | Password akun fixture Super Admin development |
| `SEED_DEPT_PJ_PASSWORD` | Ya | Password akun fixture PJ development |
| `IP_HASH_SECRET` | Ya | HMAC/hash IP pada audit/rate limit |
| `SUPABASE_URL` | Tidak | Endpoint project storage/database bila digunakan |
| `SUPABASE_SERVICE_ROLE_KEY` | Ya | Akses server-only ke private storage |
| `STORAGE_BUCKET_CANDIDATES` | Tidak | Nama bucket private kandidat |
| `STORAGE_SIGNED_URL_TTL_SECONDS` | Tidak | Umur URL unduh sementara |
| `RESEND_API_KEY` | Ya | Credential provider email yang direncanakan |
| `EMAIL_FROM` | Tidak | Sender terverifikasi |
| `CRON_SECRET` | Ya | Otorisasi worker/outbox/cleanup |
| `TURNSTILE_SECRET_KEY` | Ya | Abuse protection server bila diaktifkan |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Tidak | Site key public bila diaktifkan |
| `SENTRY_DSN` | Ya | Error reporting server bila diaktifkan |
| `NEXT_PUBLIC_SENTRY_DSN` | Tidak | Error reporting client bila diaktifkan |
| `LOG_LEVEL` | Tidak | Tingkat structured logging |
| `REGISTRATION_SUBMISSION_ENABLED` | Tidak | Release gate pendaftaran; default `false` |
| `REGISTRATION_DRAFT_TTL_SECONDS` | Tidak | Umur draft teks di browser |
| `REGISTRATION_UPLOAD_TTL_SECONDS` | Tidak | Umur upload tervalidasi sebelum cleanup orphan |
| `REGISTRATION_CONFIRMATION_TTL_SECONDS` | Tidak | Umur token bukti pendaftaran |
| `MOTIVATION_MIN_WORDS` | Tidak | Batas minimum motivasi per pilihan |
| `ESSAY_MIN_WORDS` | Tidak | Batas minimum jawaban esai |
| `ESSAY_MAX_WORDS` | Tidak | Batas maksimum jawaban esai |
| `PORTFOLIO_MAX_FILES` | Tidak | Maksimum item portofolio |
| `PORTFOLIO_MAX_FILE_BYTES` | Tidak | Maksimum ukuran file portofolio |
| `PORTFOLIO_URL_MAX_LENGTH` | Tidak | Maksimum panjang URL HTTPS |
| `STORAGE_PRIVATE_ROOT` | Tidak | Subfolder privat adapter development |
| `EMAIL_SINK_ROOT` | Tidak | Subfolder email sink development |
| `EMAIL_OUTBOX_MAX_ATTEMPTS` | Tidak | Maksimum retry email outbox |

`SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `AUTH_SECRET`, dan secret lain hanya tersedia pada server/secret manager dan dilarang menggunakan prefix `NEXT_PUBLIC_`.

## Rekomendasi private storage

Supabase Storage private bucket direkomendasikan untuk MVP karena mendukung access control/RLS, pembatasan MIME dan ukuran bucket, signed upload, serta signed URL download berumur pendek. Service role hanya digunakan server-side. Aplikasi tetap menyimpan metadata/ownership di PostgreSQL Sekolah dan menggunakan adapter agar dapat dipindahkan ke storage S3-compatible lain.

Sumber resmi: [private bucket dan signed download](https://supabase.com/docs/guides/storage/buckets/fundamentals), [access control](https://supabase.com/docs/guides/storage/security/access-control), dan [signed upload](https://supabase.com/docs/reference/javascript/file-buckets-createsigneduploadurl).

## Keputusan yang masih blocking

### Blocking sebelum informasi atau fitur terkait boleh dipublikasikan

1. Konfirmasi nama resmi produk/organisasi dan identitas visual final.
2. Konfirmasi 13 unit, unit yang menerima peserta, status BPH, dan kuota per Birdep.
3. Daftar prodi resmi, tahun masuk untuk Angkatan 63, serta aturan eligibility final.
4. Tanggal periode, registration prefix/tahun, aturan Pilihan 2, dan kebijakan unlock.
5. Kebijakan privasi, versi consent, retensi, koreksi/penghapusan, dan owner data.

### Blocking sebelum fitur terkait diaktifkan

1. Persetujuan project/provider Supabase dan owner database/storage sebelum storage production diaktifkan.
2. Sender domain, provider, template, volume, dan owner email sebelum email production diaktifkan.
3. Identitas Super Admin awal dan kanal aman distribusi credential sebelum UAT auth.
4. Parameter session/reset/rate-limit final berdasarkan risk review sebelum production/UAT final.
5. Owner domain, hosting, CI, backup, monitoring, dan on-call sebelum Phase 8 selesai.

### Non-blocking/future

- CMS versus content-in-code untuk landing.
- Analytics non-esensial dan consent platform.
- Scheduling wawancara dan tracking publik.
- 2FA dan dual approval untuk aksi kritis.
- Integrasi SSO Nexus setelah MVP.
