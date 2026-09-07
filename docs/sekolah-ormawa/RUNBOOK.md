# Runbook Sekolah Ormawa Standalone

## Status dan batas

Phase 3 menyediakan alur pendaftaran lengkap untuk development dengan data sintetis. Dokumen ini belum mengizinkan setup production, migration production, deploy, pembuatan akun nyata, broadcast, purge, atau pembukaan pendaftaran resmi. Release gate tetap fail-closed.

## Repository kanonis

`C:\Users\rafii\OneDrive\Documents\projectan\sekolah-ormawa`

Repository ini berdiri sendiri. Jangan menyalin `.env`, password database, session, upload, generated build, atau dependency dari Nexus-Tevo. Referensi Nexus-Tevo hanya boleh dipakai untuk terminologi, struktur organisasi, dan identitas visual yang telah dikonfirmasi.

## Setup lokal Phase 1

```text
npm ci
npm run db:validate
npm run db:generate
npm run db:migrate:deploy
npm run db:seed
npm run dev
npm run lint
npm run typecheck
npm run test
npm run test:integration
npm run test:e2e
npm run build
```

Untuk PostgreSQL Docker lokal, jalankan `docker compose up -d postgres` lebih dahulu. Database development dan test menggunakan port lokal **`15432`** (bukan `5432`/`55432`; keputusan permanen sejak Phase 9 - lihat catatan Windows WinNAT di bawah); nilainya dapat diubah di environment development. `npm run db:seed` aman dijalankan ulang. `npm run db:reset:dev` bersifat destruktif, hanya untuk database development sintetis, dan Prisma akan meminta consent eksplisit saat dijalankan oleh agent.

**Kenapa `15432`, bukan port Postgres standar**: pada Windows, Hyper-V/WinNAT kadang mengunci rentang port dinamis yang menabrak port dev standar (`55432`, kadang juga rentang di sekitar `5432`), menyebabkan `docker compose up` gagal bind port meski container sehat (`docker ps` terlihat "healthy" tapi port forwarding tidak aktif). Diagnosis: `netsh interface ipv4 show excludedportrange protocol=tcp` menunjukkan port yang diblokir masuk rentang exclusion WinNAT. Perbaikan permanen butuh privilese admin (`net stop winnat && net start winnat`, restart Docker Desktop, atau reboot) yang tidak selalu tersedia untuk agent/CI. `15432` dipilih sebagai port tetap yang terverifikasi bebas dari exclusion range di lingkungan development ini (keputusan Phase 9, menggantikan workaround sementara Phase 8). `docker-compose.yml` dan `.env`/`.env.example` sudah konsisten memakai `15432`.

**Sejak Phase 9, `npm run build` butuh 5 variable production-only sebagai placeholder** (`MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`), meski dijalankan di mesin development - `next build` selalu berjalan dalam mode production secara internal (`NODE_ENV=production`), dan `env.ts` superRefine mewajibkan variable itu hadir (isi bebas, tidak divalidasi terhubung ke MinIO/Resend sungguhan) begitu `NODE_ENV=production`. Nilai apa pun yang valid secara format sudah cukup, mis.:
```bash
MINIO_ENDPOINT="http://build-only:9000" MINIO_ACCESS_KEY="build-only" MINIO_SECRET_KEY="build-only" RESEND_API_KEY="build-only" RESEND_FROM_EMAIL="build-only@example.test" npm run build
```
`Dockerfile` sudah menyertakan placeholder yang sama di stage builder (lihat komentarnya) - hanya perlu diperhatikan untuk verifikasi build lokal di luar Docker.

## Environment management

1. `.env.example` hanya mendokumentasikan nama variable.
2. `.env`, `.env.local`, folder `secrets`, file key/PEM, dan secret production tidak masuk Git.
3. Pisahkan development, preview/staging, dan production.
4. Credential database runtime dipisahkan dari credential migration jika provider mendukungnya.
5. `AUTH_SECRET`, service role storage, email key, cron secret, dan IP hash secret disimpan di secret manager.
6. Hanya variable yang memang aman untuk browser boleh memakai prefix `NEXT_PUBLIC_`.
7. Rotasi secret memiliki owner, tanggal, dan prosedur revoke.
8. Daftar final nama variable berada di `DECISIONS.md`.

## Operasi akun internal

### Membuat akun PJ (implementasi Phase 7)

1. Super Admin membuka `/admin/dashboard/akun`, mengisi nama/email/Birdep. UI dan API (`POST api/admin/accounts`) hanya membuat akun `DEPT_PJ` — akun `SUPER_ADMIN` baru sengaja tetap manual lewat seed/database (keputusan eksplisit pemilik proyek).
2. Server memastikan normalized email unik dan Birdep aktif; `departmentId` wajib.
3. **Tidak ada temporary password yang pernah ditampilkan/dicetak.** Kredensial awal adalah hash acak yang tidak pernah dipakai; akun hanya bisa diaktifkan lewat tautan setup sekali-pakai (`password_reset_tokens`, TTL `TEMP_PASSWORD_TTL_SECONDS`) yang dikirim lewat `EmailOutbox` (sink development), mengikuti preferensi terdokumentasi ("link reset satu kali lebih disukai ketika kanal email tersedia").
4. `mustChangePassword=true` di-set sejak awal; aksi CREATE tercatat audit dengan actor/department/request ID.
5. Super Admin juga dapat: edit nama/Birdep (`PATCH api/admin/accounts/[id]`), nonaktifkan/aktifkan + cabut sesi otomatis (`POST .../disable`), kirim ulang tautan reset (`POST .../reset`), dan cabut seluruh sesi (`POST .../revoke`).

### Login pertama

1. Verifikasi credential dan rate limit.
2. Bila temporary credential expired, arahkan ke reset aman.
3. Guard backend menandai session sebagai forced-password dan membatasi route ke ganti password/logout hingga password baru valid.
4. Setelah berubah, transaksi menghapus status temporary, menaikkan session version, mencabut session lama, lalu menerbitkan session baru.

### Reset password

1. Self-service memakai respons generik agar tidak mengungkap akun.
2. Aplikasi menyimpan hanya hash token pada `password_reset_tokens`; token mentah hanya berada dalam URL email sink/provider dan wajib direduksi dari log.
3. Reset Super Admin memerlukan audit; password lama tidak pernah ditampilkan.
4. Setelah berhasil, invalidate token lain dan revoke seluruh session user.

### Menonaktifkan/revoke

1. Set user `banned=true` melalui primitive admin Better Auth dan catat actor/reason/timestamp.
2. Revoke seluruh row session user melalui primitive admin Better Auth.
3. Semua backend guard harus menolak session lama segera setelah lookup berikutnya.
4. Reaktivasi tidak otomatis memulihkan session; user harus login kembali.

### Route dan guard Phase 4

- Login/reset/change/logout/revoke hanya melalui `/api/admin/auth/*`; `/api/auth/*` mentah ditutup dengan 404.
- POST auth wajib memiliki `Origin` yang cocok dan tidak boleh berstatus cross-site.
- Guard mengecek expiry library, absolute expiry, idle timeout, session version, account active/banned, role, department constraint, temporary-password expiry, forced password, permission, lalu resource scope.
- Resource PJ di luar `departmentId` session menghasilkan 404 dan audit `AUTHORIZATION_DENIED`.
- Parameter development dapat diubah melalui `SESSION_MAX_AGE_SECONDS`, `SESSION_IDLE_TIMEOUT_SECONDS`, `SESSION_UPDATE_AGE_SECONDS`, `PASSWORD_RESET_TTL_SECONDS`, `TEMP_PASSWORD_TTL_SECONDS`, `LOGIN_RATE_LIMIT_WINDOW_SECONDS`, `LOGIN_RATE_LIMIT_MAX_ATTEMPTS`, dan `PASSWORD_MAX_LENGTH`.
- Production wajib memakai `AUTH_SECRET` dan `IP_HASH_SECRET` acak dari secret manager; minimum deployment untuk `IP_HASH_SECRET` adalah 32 karakter walaupun parser development menerima minimum 16 agar local production build reproducible.

### Reset development

1. Buka `/admin/lupa-password` dan gunakan hanya email fixture sintetis.
2. Respons selalu generik. File outbox development muncul di `storage/<EMAIL_SINK_ROOT>` dan tidak boleh dikirim ke provider nyata.
3. Gunakan URL sekali, simpan password baru, lalu pastikan URL replay invalid serta semua session lama ditolak.
4. Hapus sink development setelah pengujian. Jangan menyalin token ke issue, chat, screenshot publik, atau log.

## Migration database standalone

### Development/staging

1. Pastikan host/database target adalah milik Sekolah dan bukan production.
2. Ambil backup bila database tidak kosong.
3. Review SQL untuk operasi destructive, role-scope check, unique index, foreign key, dan partial unique active lock.
4. Apply pada database kosong lalu seed sintetis.
5. Jalankan integration test role/scope, email akun, NIM/email kandidat, pilihan, IPK, dan active lock.
6. Untuk pembuktian reproducibility tanpa penghapusan, buat database development kosong baru dan jalankan `npm run db:migrate:deploy` dengan `DATABASE_URL` yang menunjuk ke database tersebut.
7. Uji rollback pada environment terpisah; dokumentasikan durasi dan lock.

### Production - belum dieksekusi

Urutan rencana: backup terverifikasi -> migration additive -> deploy kompatibel -> smoke test -> monitoring. Utamakan roll-forward; drop schema/tabel memerlukan persetujuan eksplisit dan restore drill. Perintah konkret (dijalankan lewat container `app` di server Contabo, bukan dari mesin lokal): lihat §Deployment readiness bagian 4 "Urutan migration untuk production deploy".

## Private storage

- Production: bucket MinIO self-hosted (Contabo) privat khusus kandidat - lihat ADR-035, §Deployment readiness.
- Credential MinIO hanya server-side (`MINIO_ACCESS_KEY`/`MINIO_SECRET_KEY`, tidak pernah `NEXT_PUBLIC_*`).
- Server membuat `FileUpload` milik draft/period yang tepat sebelum bytes ditulis ke storage.
- Download production tetap lewat authorized proxy (endpoint Next.js, lihat "Endpoint download" di bawah) untuk setiap call site yang sudah ada; adapter juga menyediakan `createSignedUpload`/`createSignedDownload` (presigned S3 URL 5 menit default, `STORAGE_SIGNED_URL_TTL_SECONDS`, rentang 5-10 menit) untuk pemakaian langsung-ke-client di masa depan bila diperlukan.
- Validasi extension, declared MIME, detected MIME/magic byte, size, checksum, ownership, dan finalize state.
- Object key acak (`${periodId}/${randomUUID()}${extension}`) dan tidak memuat PII.
- CV/foto/KTM tidak boleh ditempatkan di `public/`.
- Cleanup orphan dan retensi/purge wajib ter-audit.
- Portofolio Media Branding mengikuti kontrak `PORTFOLIO_MEDBRAND_REQUIREMENTS.md`; input/upload/URL Phase 3 dan akses PJ/Super Admin (Phase 5, `api/admin/candidates/[id]/files/[fileId]`) sudah tersedia.

### Adapter (Phase 3 development, Phase 9 production)

- Development memakai adapter filesystem privat di `storage/<STORAGE_PRIVATE_ROOT>`; path dinormalisasi dan tidak diekspos sebagai static route.
- Production memakai `MinioPrivateStorage` (`src/server/storage/private-storage.ts`) lewat `@aws-sdk/client-s3` (MinIO S3-compatible, `forcePathStyle: true`) - diuji terhadap MinIO nyata di `tests/integration/storage-minio.test.ts` (put/read round-trip, delete, presigned upload/download yang benar-benar bisa diakses, TTL kedaluwarsa ditolak).
- Kontrak `PrivateStorageAdapter` (`put`/`read`/`delete`) sama di kedua adapter, sehingga `getPrivateStorage()` (`NODE_ENV`-based factory) dapat ditukar tanpa mengubah service registrasi/upload.
- Endpoint download publik (`api/registration/uploads/[id]`) membutuhkan owner cookie serta signature HMAC berumur pendek; hanya berlaku selama draft belum menjadi kandidat.
- Endpoint download dashboard (`api/admin/candidates/[id]/files/[fileId]`, Phase 5) memakai policy role/scope backend: setiap request diautorisasi ulang lewat session admin (`requireDepartmentAccess`), kandidat harus dalam scope Birdep (dan tidak terkunci Birdep lain), dan setiap akses berhasil ditulis ke audit log `FILE_VIEW`. Tidak ada signature terpisah; sesi admin adalah mekanisme otorisasinya.
- Job orphan upload dipanggil melalui endpoint internal dengan Bearer `CRON_SECRET`; tanpa secret yang dikonfigurasi endpoint menolak request.

## Operasi registrasi development

1. Gunakan hanya database development/test dan data sintetis.
2. Pastikan periode berstatus `OPEN`, `configStatus=ACTIVE`, consent sesuai, serta `REGISTRATION_SUBMISSION_ENABLED=true` hanya pada environment uji terkontrol.
3. Jalankan aplikasi, isi `/daftar`, lalu verifikasi `/daftar/sukses?token=...` tanpa membagikan token.
4. Proses outbox melalui `POST /api/internal/jobs/email-outbox` dengan Bearer cron secret development; output email masuk ke `storage/<EMAIL_SINK_ROOT>`.
5. Jalankan orphan cleanup melalui `POST /api/internal/jobs/orphan-uploads` dengan mekanisme yang sama.
6. Kembalikan gate ke `false` setelah pengujian manual. Seed normal tetap menghasilkan periode `DRAFT` dan tidak membuka form.

Email provider production, malware scanning, kebijakan retensi, serta owner bucket belum disetujui. Kegagalan email tidak membatalkan kandidat karena pesan sudah disimpan di outbox dan dapat dicoba ulang secara idempotent.

## Operasi Dashboard PJ (Phase 5)

1. Login dengan akun fixture `pj.ristek.fixture@sekolah.local` (scope Birdep RISTEK) atau `superadmin.fixture@sekolah.local` (SUPER_ADMIN, pilih Birdep lewat switcher) pada `/admin/dashboard`.
2. Dashboard membaca periode terbaru (`RecruitmentPeriod` dengan `createdAt` terbesar) tanpa memandang status; period selector eksplisit tetap Phase 7 (ADM-02).
3. Tiga tab (`Pilihan utama`, `Pilihan kedua`, `Terkunci Birdep ini`) memfilter berdasarkan `CandidateChoice.rank` dan `Candidate.status`; kandidat yang terkunci Birdep lain tidak akan pernah muncul (ADR-026).
4. Pencarian mencocokkan nama, NIM, email, dan nomor registrasi; pagination memakai cursor keystone `id` dengan `orderBy` whitelist (`submittedAt`/`name`, asc/desc).
5. Detail kandidat (`/admin/dashboard/kandidat/[id]`) menampilkan identitas, pilihan, esai, dokumen (CV/foto/KTM), portofolio, status lock, dan catatan Birdep.
6. File CV/foto/KTM/portofolio dibuka lewat `api/admin/candidates/[id]/files/[fileId]`; tidak ada URL publik atau signature yang dibagikan ke luar sesi admin.
7. Catatan Birdep (create/update/soft-delete) hanya terlihat oleh Birdep yang membuatnya dan Super Admin; setiap aksi tercatat di `audit_logs` dengan `entityType='DEPARTMENT_NOTE'`.
8. Untuk QA manual, fixture kandidat sintetis dapat dibuat langsung di database development (lihat `docs/artifacts/phase-5/` untuk contoh); jangan menyalin data ini ke database lain atau menganggapnya data resmi.

## Seed dan data

- Hanya fixture sintetis; jangan memakai mahasiswa atau credential nyata.
- Tiga belas unit referensi tersedia sebagai fixture `DRAFT`; semuanya default tidak menerima pendaftaran, termasuk BPH.
- Seed role minimum hanya `SUPER_ADMIN` dan `DEPT_PJ`.
- Seed auth development menggunakan credential dummy yang jelas dan tidak terkirim ke provider email production.
- `prisma/seed.ts` tidak menyertakan fixture `Candidate` (registrasi tetap tertutup by default). Screenshot Phase 5 di `docs/artifacts/phase-5/` dibuat dari tiga kandidat sintetis yang disisipkan manual ke database development untuk kebutuhan visual QA; data ini bukan bagian dari seed resmi dan tidak direplikasi otomatis.

## Backup dan restore

### Cakupan

- PostgreSQL Sekolah beserta migration history.
- Object dan metadata/checksum private storage.
- Konfigurasi non-secret yang diperlukan untuk reproduksi.
- Audit log sesuai retensi yang disetujui.

### Restore drill

1. Gunakan environment terpisah dan domain non-production.
2. Restore database serta storage.
3. Verifikasi record count, foreign key, role-scope constraint, session revocation state, active-lock invariant, dan checksum object.
4. Jalankan smoke test publik/admin dengan fixture.
5. Catat RPO/RTO aktual, owner, tanggal, dan gap.

### Hasil drill Phase 8 (2026-08-12)

Drill dijalankan terhadap `sekolah_ormawa_dev` (bukan test DB), dengan environment restore yang benar-benar terpisah: container Postgres baru (`sekolah-ormawa-restore-drill`, image `postgres:16-alpine`), volume kosong baru, tanpa port host, tanpa berbagi volume/container dengan sumber (`sekolah-ormawa-postgres`). Restore dijalankan lewat `docker exec -i ... pg_restore`, bukan lewat `DATABASE_URL` dev/test yang ada, sehingga betul-betul independen dari environment sumber.

**Prosedur yang dijalankan:**
1. `pg_dump -F c` (custom format) dari container sumber, dialirkan lewat stdout ke file `.dump` di host (menghindari path translation Git Bash/Windows saat pakai `-f` di dalam container).
2. `tar -czf` atas folder `storage/` (private uploads + email sink dev) sebagai backup metadata/objek.
3. Container restore baru dibuat dari image bersih, database dibuat ulang.
4. `pg_restore --no-owner` menerima dump tanpa error.
5. Verifikasi row count 7 tabel inti (`departments`, `recruitment_periods`, `users`, `roles`, `candidates`, `study_programs`, `file_uploads`) - sumber vs restore identik.
6. Verifikasi checksum level konten (`md5(string_agg(...))` atas `candidates` dan `departments`) - identik byte-untuk-byte, bukan cuma cocok jumlah baris.
7. Extract tarball storage ke direktori terpisah, `sha256sum` tiap file - identik dengan checksum asli.
8. Container drill dan file backup sementara dibersihkan setelah verifikasi; database dan storage sumber tidak pernah ditulis selama drill.

**Hasil:**
- Dump: 78.491 bytes, ~0.8 detik (dataset dev saat ini: 13 department, 1 periode, 2 user, 2 role, 3 kandidat, 1 program studi, 1 file upload).
- Restore: ~1.3 detik termasuk drop+create database.
- Row count dan checksum konten: cocok 100% pada kedua sisi.
- Storage backup (2 file, ~1.5 KB): checksum SHA-256 cocok 100% setelah extract ke direktori terpisah.
- Tidak ada error pada `pg_restore` maupun `tar`/`sha256sum`.

**RPO/RTO dan gap yang belum tertutup:**
- Dataset dev sangat kecil; waktu dump/restore di atas TIDAK mewakili skala production. Drill ulang wajib dijalankan terhadap dataset berskala production (atau snapshot mendekati skala target) sebelum go-live untuk mendapat angka RTO nyata.
- Environment restore adalah container Docker terpisah pada host yang sama, bukan environment/hosting fisik atau region berbeda. Sebelum go-live, restore harus diuji ke provider hosting Postgres production yang sesungguhnya (mis. instance/managed Postgres terpisah), bukan hanya container lokal.
- RPO bergantung pada jadwal backup production yang belum ditentukan (belum ada owner/jadwal terjadwal - lihat Prioritas 6 deployment readiness). Rekomendasi: backup harian otomatis + retention sesuai kebijakan data, dengan drill restore berkala (mis. bulanan) setelah go-live.
- Drill ini tidak menguji foreign-key/role-scope/session-revocation/active-lock invariant secara eksplisit di luar row count dan checksum konten - checksum konten pada `candidates`/`departments` cukup membuktikan integritas data, tapi verifikasi foreign-key/invariant aplikasi sebaiknya ditambahkan (mis. smoke test login + baca dashboard) pada drill production pertama.
- Owner drill berkala: belum ditunjuk (di luar cakupan Phase 8; perlu keputusan Super Admin/DevOps saat deployment).

## Deployment readiness

Deploy production hanya dilakukan dengan perintah eksplisit. Bagian ini adalah checklist yang harus disiapkan/dijalankan sebelum perintah itu diberikan - bukan langkah yang sudah dieksekusi. Target deployment: **self-hosted di server Contabo milik Biro**, lewat Docker Compose, bukan Vercel/PaaS (ADR-037). Owner domain/hosting/backup: pemilik proyek sendiri (ADR-038).

### Status prasyarat (per Phase 9)

- ~~Private storage production~~ **SELESAI (ADR-035)**: MinIO self-hosted, adapter `MinioPrivateStorage` (`src/server/storage/private-storage.ts`) diimplementasikan dan diuji terhadap MinIO nyata (`tests/integration/storage-minio.test.ts`).
- ~~Email production~~ **SELESAI (ADR-036)**: Resend, adapter `ResendEmailAdapter` (`src/server/email/outbox.ts`) diimplementasikan dan diuji dengan SDK yang di-mock (`tests/unit/resend-email-adapter.test.ts`). **Belum diuji dengan API key Resend sungguhan** - wajib smoke test kirim email nyata sebelum production (langkah 4 di bawah), sesuai instruksi eksplisit pemilik proyek.
- ~~Schema drift `auth_rate_limits`/`password_reset_tokens`~~ **SELESAI (Phase 9)**: migration `20260812070054_fix_auth_rate_limit_reset_token_id_type` menyelaraskan tipe kolom `id` (native `uuid` -> `text`, konsisten dengan seluruh tabel lain).
- ~~Owner domain/hosting/backup~~ **SELESAI (ADR-038)**: pemilik proyek sendiri, server Contabo milik Biro.
- **Belum dibangun, bukan blocking untuk go-live MVP**: CAPTCHA (`TURNSTILE_SECRET_KEY`) dan error tracking (`SENTRY_DSN`) - tidak direferensikan di kode sama sekali, tidak ada keputusan produk. Boleh ditambahkan pasca-MVP.
- **Belum dieksekusi (di luar kendali agent)**: deploy container sungguhan ke server Contabo, provisioning DNS/TLS nyata, pengisian credential production sungguhan (MinIO/Resend/Postgres/`AUTH_SECRET` dll). Semua artefak (`Dockerfile`, `docker-compose.prod.yml`, `deploy/nginx/nginx.conf`) sudah dibangun dan diverifikasi lokal (image build sukses, stack app+Postgres+MinIO+Nginx jalan dan saling terhubung lewat Docker network internal, `/api/health`+`/api/readiness` 200, redirect HTTP->HTTPS dan ACME challenge path nginx bekerja) - tapi belum pernah dijalankan di server sungguhan.

### 1. Checklist environment variable production (tanpa nilai secret)

Sumber kebenaran nama variabel: `.env.example`. Kolom "Secret" menandai nilai yang tidak boleh pernah masuk log, chat, atau dokumen manapun - hanya disimpan di `.env` pada server (tidak di git; `.env` sudah di-`.gitignore`) dengan permission file dibatasi ke user yang menjalankan Docker.

| Variabel | Secret? | Catatan production |
|---|---|---|
| `NODE_ENV` | tidak | harus `production` |
| `NEXT_PUBLIC_APP_URL` | tidak | `https://sekolah.ormawaeksekutifpku.com` (harus HTTPS - menentukan cookie `Secure` dan CSP) |
| `DATABASE_URL`, `DIRECT_DATABASE_URL` | ya | mengarah ke service `postgres` di `docker-compose.prod.yml` (`postgres:5432`, nama service sebagai host, bukan IP) |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | ya (password) | dibaca langsung oleh service `postgres` di `docker-compose.prod.yml` untuk inisialisasi database |
| `AUTH_SECRET` | ya | ≥48 karakter di production saat `REGISTRATION_SUBMISSION_ENABLED=true` (ditegakkan oleh `env.ts` superRefine); generate baru, jangan reuse dev |
| `SESSION_COOKIE_NAME`, `SESSION_MAX_AGE_SECONDS`, `SESSION_IDLE_TIMEOUT_SECONDS`, `SESSION_UPDATE_AGE_SECONDS` | tidak | tinjau ulang nilai dev (idle timeout 900s dsb) sesuai kebijakan operasional final |
| `PASSWORD_RESET_TTL_SECONDS`, `TEMP_PASSWORD_TTL_SECONDS` | tidak | kebijakan lifecycle password |
| `LOGIN_RATE_LIMIT_WINDOW_SECONDS`, `LOGIN_RATE_LIMIT_MAX_ATTEMPTS` | tidak | jangan diperlonggar dari nilai yang sudah diuji Phase 8 P1 tanpa alasan kuat |
| `PASSWORD_MAX_LENGTH` | tidak | |
| `SEED_SUPER_ADMIN_PASSWORD`, `SEED_DEPT_PJ_PASSWORD` | ya | hanya dipakai sekali saat seed awal production; rotate/reset setelah seed pertama, jangan biarkan tersimpan di `.env` production setelah itu |
| `REGISTRATION_SUBMISSION_ENABLED` | tidak | tetap `false` sampai seluruh checklist ini lolos; ini adalah kill switch utama |
| `REGISTRATION_DRAFT_TTL_SECONDS`, `REGISTRATION_UPLOAD_TTL_SECONDS`, `REGISTRATION_CONFIRMATION_TTL_SECONDS` | tidak | |
| `MOTIVATION_MIN_WORDS`, `ESSAY_MIN_WORDS`, `ESSAY_MAX_WORDS` | tidak | kebijakan konten, konfirmasi ke pemilik produk sebelum lock |
| `PORTFOLIO_MAX_FILES`, `PORTFOLIO_MAX_FILE_BYTES`, `PORTFOLIO_URL_MAX_LENGTH` | tidak | Phase C (ADR-043): `PORTFOLIO_MAX_FILE_BYTES` default naik ke 10MB, policy diperluas ke PDF/ZIP/gambar - dipakai bersama oleh Medbrand eksekutif dan Badan Media dan Branding legislatif |
| `BUDGET_PLAN_MAX_FILE_BYTES` | tidak | Phase C (ADR-043): cap RAB Komisi Anggaran legislatif (opsional), default 5MB, PDF/XLS/XLSX |
| `IP_HASH_SECRET` | ya | ≥16 karakter, beda dari `AUTH_SECRET` |
| `MINIO_ENDPOINT` | tidak | `http://minio:9000` - nama service Docker internal, BUKAN URL publik (MinIO tidak diekspos ke internet, lihat `docker-compose.prod.yml`) |
| `MINIO_REGION` | tidak | default `us-east-1`, MinIO tidak benar-benar memakai region tapi SDK S3 mewajibkan nilai |
| `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY` | ya | credential yang dipakai APLIKASI untuk otentikasi S3 API; boleh sama dengan `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD` untuk kesederhanaan, atau (disarankan) access key terpisah berhak akses minimal (scoped ke `STORAGE_BUCKET_CANDIDATES` saja) dibuat lewat console/`mc` MinIO - lihat langkah 3 |
| `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` | ya | credential bootstrap CONTAINER MinIO itu sendiri (dipakai `docker-compose.prod.yml`, bukan oleh Next.js langsung) |
| `STORAGE_BUCKET_CANDIDATES` | tidak | nama bucket private kandidat; harus sudah dibuat manual sebelum app pertama kali start (langkah 3) |
| `STORAGE_PRIVATE_ROOT` | tidak | tidak relevan untuk MinIO (hanya dipakai `DevelopmentPrivateStorage`, disk lokal) |
| `STORAGE_SIGNED_URL_TTL_SECONDS` | tidak | umur presigned URL (`createSignedUpload`/`createSignedDownload`), default 300 detik (5 menit), sesuai rentang 5-10 menit yang diminta |
| `RESEND_API_KEY` | ya | dari dashboard resend.com, scope "Sending access" cukup |
| `RESEND_FROM_EMAIL` | tidak | harus alamat pada domain yang sudah diverifikasi (SPF/DKIM) di dashboard Resend - kirim akan gagal/masuk spam kalau belum |
| `EMAIL_SINK_ROOT`, `EMAIL_OUTBOX_MAX_ATTEMPTS` | tidak | `EMAIL_SINK_ROOT` tidak relevan lagi di production (`ResendEmailAdapter` dipakai, bukan sink lokal) |
| `CRON_SECRET` | ya | ≥32 karakter; melindungi `/api/internal/jobs/*` (outbox, orphan upload cleanup) - dipanggil lewat host crontab, lihat langkah 6 |
| `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | ya (secret key) | **belum diimplementasikan di kode** - hapus dari rencana atau bangun dulu sebelum diisi |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | ya (server DSN)/tidak (public DSN) | **belum diimplementasikan di kode** |
| `LOG_LEVEL` | tidak | `info` atau `warn` di production, bukan `debug` |

### 2. DNS dan TLS - `sekolah.ormawaeksekutifpku.com` (Contabo, self-hosted)

1. Catat IP publik statis VPS Contabo (`curl -4 ifconfig.me` dari server itu sendiri).
2. Buat record DNS: `A sekolah -> <ip-publik-contabo>` (dan `AAAA` kalau Contabo menyediakan IPv6). Bukan `CNAME` - tidak ada hostname provider PaaS di setup ini.
3. Firewall server: hanya buka port 22 (SSH, idealnya dibatasi IP admin atau key-only), 80, dan 443. Port Postgres/MinIO/aplikasi (5432/9000/9001/3000) **tidak boleh** ter-expose ke internet - `docker-compose.prod.yml` sudah tidak mem-publish port-port itu ke host, hanya `nginx` yang publish 80/443 (lihat file tersebut).
4. Install Docker + Docker Compose plugin di server (`curl -fsSL https://get.docker.com | sh`, lalu `apt install docker-compose-plugin` atau ikuti dokumentasi Docker resmi untuk distro Contabo yang dipakai).
5. Clone/transfer kode ke server, `cp .env.example .env`, isi seluruh nilai production (checklist di atas) - **jangan pernah commit `.env` ke git**.
6. Jalankan stack HANYA dengan blok HTTP (port 80) aktif dulu - `deploy/nginx/nginx.conf` sudah didesain begitu (blok HTTPS/443 sengaja dikomentari sampai sertifikat ada):
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```
7. Minta sertifikat lewat certbot mode webroot (satu kali, image resmi certbot, tidak perlu instalasi tambahan di host):
   ```bash
   docker run --rm \
     -v "$(pwd)/deploy/nginx/certbot-webroot:/var/www/certbot" \
     -v "$(pwd)/deploy/nginx/certs:/etc/letsencrypt" \
     certbot/certbot certonly --webroot -w /var/www/certbot \
     -d sekolah.ormawaeksekutifpku.com \
     --email <email-admin> --agree-tos --no-eff-email
   ```
8. Buka `deploy/nginx/nginx.conf`, hapus tanda komentar pada blok `server { listen 443 ssl; ... }`, lalu reload nginx tanpa downtime: `docker compose -f docker-compose.prod.yml exec nginx nginx -s reload`.
9. Verifikasi propagasi DNS dan sertifikat (`curl -vI https://sekolah.ormawaeksekutifpku.com`, atau browser padlock) sebelum mengarahkan traffic nyata.
10. Jadwalkan renewal otomatis lewat host crontab (sertifikat Let's Encrypt berlaku 90 hari):
    ```cron
    0 3 * * 1 cd /path/ke/repo && docker run --rm -v "$(pwd)/deploy/nginx/certbot-webroot:/var/www/certbot" -v "$(pwd)/deploy/nginx/certs:/etc/letsencrypt" certbot/certbot renew --webroot -w /var/www/certbot --quiet && docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
    ```
11. Set `NEXT_PUBLIC_APP_URL=https://sekolah.ormawaeksekutifpku.com` di `.env` - nilai ini menentukan `Secure` flag cookie session dan origin yang diterima oleh `assertValidCsrf` (Phase 8 P1); URL yang salah berarti CSRF/cookie gagal diam-diam.
12. Catat tanggal renewal berikutnya dan siapa yang menerima alert kalau job cron gagal (mis. cron mengirim email ke admin secara default kalau ada output/error).

### 3. Setup awal MinIO (bucket + access key, sekali saat provisioning)

1. Setelah stack jalan (langkah 2.6), buat tunnel SSH sementara ke console MinIO (port 9001 tidak di-publish ke internet secara sengaja): `ssh -L 9001:localhost:9001 <user>@<ip-contabo>`, lalu buka `http://localhost:9001` di browser lokal dan login dengan `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD`.
2. Buat bucket dengan nama persis `STORAGE_BUCKET_CANDIDATES` (default `sekolah-candidates-private`). Pastikan bucket **private** (default MinIO, jangan diubah jadi public).
3. (Disarankan, bukan wajib) Buat access key baru khusus aplikasi dengan policy readwrite hanya ke bucket ini, lalu isi `MINIO_ACCESS_KEY`/`MINIO_SECRET_KEY` di `.env` dengan access key itu (bukan root credential) - prinsip least privilege. Restart service `app` setelah mengubah `.env`: `docker compose -f docker-compose.prod.yml up -d app`.
4. Tutup SSH tunnel setelah selesai.

### 4. Urutan migration untuk production deploy

Migration history saat ini (`prisma/migrations/`, diterapkan berurutan berdasarkan timestamp nama folder oleh `prisma migrate deploy`):

1. `20260801110915_init`
2. `20260801112500_normalized_user_email`
3. `20260802001000_registration_phase3`
4. `20260803001000_auth_phase4`
5. `20260810180707_candidate_dashboard_phase5`
6. `20260812070054_fix_auth_rate_limit_reset_token_id_type` (Phase 9 - lihat §Status prasyarat)
7. `20260812170632_make_candidate_gpa_nullable`
8. `20260903163335_selection_decision_system`
9. `20260905173817_add_track_legislative`
10. `20260906090000_department_specific_fields`
11. `20260906120000_portfolio_google_drive_url`
12. `20260907090000_study_program_free_text`
13. `20260907120000_add_follow_evidence_upload_kind`
14. `20260907150000_guidebook_and_payment`

**Prasyarat image**: `Dockerfile`'s runner stage menyertakan penuh `node_modules` dari stage `deps` (bukan cuma output standalone Next.js) supaya CLI `prisma` (devDependency, tidak pernah di-trace masuk oleh Next's standalone output tracing karena tidak diimpor kode aplikasi - beda dari `@prisma/client` yang memang dipakai runtime) tersedia offline di versi yang persis sama dengan `package-lock.json`. Tanpa ini, `npx prisma ...` di dalam container mencoba auto-install versi prisma TERBARU dari npm (bisa berbeda major version, berisiko untuk migration) dan bisa gagal total (pernah terjadi: npm resolver crash "Cannot read properties of null (reading 'edgesOut')" saat mencoba install `prisma@8.0.0-rc.13` di image yang belum punya perbaikan ini). Image yang dibangun dari `Dockerfile` versi sekarang sudah membawa `prisma` CLI offline - pastikan image yang dipakai di server adalah hasil build ULANG setelah perbaikan ini (`docker compose -f docker-compose.prod.yml build app`), bukan image lama.

Urutan deploy yang aman:
1. Ambil backup pre-deploy (lihat §Backup dan restore) - wajib sebelum migration apa pun disentuh.
2. Jalankan migration lewat container `app` yang sudah punya `DIRECT_DATABASE_URL`, bukan dari mesin lokal:
   ```bash
   docker compose -f docker-compose.prod.yml run --rm app npx prisma migrate deploy
   ```
3. Verifikasi `docker compose -f docker-compose.prod.yml run --rm app npx prisma migrate status` bersih (tidak ada pending/failed migration) sebelum melanjutkan.
4. Jalankan seed **hanya sekali** saat provisioning awal (role, permission, department, Super Admin pertama): `docker compose -f docker-compose.prod.yml run --rm app npx prisma db seed` - jangan dijalankan ulang di database yang sudah berisi data nyata; seed memakai `SEED_SUPER_ADMIN_PASSWORD`/`SEED_DEPT_PJ_PASSWORD` yang harus dirotasi setelah dipakai. **Catatan cakupan seed**: script ini HANYA membuat role/permission/18 department (draft)/1 periode (draft)/1 study program fixture/2 akun (`superadmin.fixture@sekolah.local` + 1 PJ Ristek) - akun PJ untuk 17 Birdep lainnya dan konfigurasi periode (entryYear/prefix/consent/jadwal) tetap manual lewat UI Super Admin setelahnya, tidak ada mekanisme seed otomatis untuk itu.
5. `docker compose -f docker-compose.prod.yml up -d --build app` untuk deploy kode aplikasi (image sudah lolos quality gate - lint, typecheck, unit, integration, E2E, build, lihat TEST_MATRIX.md) setelah migration sukses, bukan sebelumnya.
6. `REGISTRATION_SUBMISSION_ENABLED` tetap `false` sampai smoke test post-deploy (bagian 5) lolos.

### 5. Smoke test post-deploy

Jalankan berurutan terhadap `https://sekolah.ormawaeksekutifpku.com` yang baru di-deploy, dengan akun/fixture yang jelas ditandai sebagai smoke test (bukan data peserta nyata):

1. `GET /api/health` dan `GET /api/readiness` mengembalikan 200; `docker compose -f docker-compose.prod.yml ps` menunjukkan seluruh service (app/postgres/minio/nginx) `healthy`.
2. Login Super Admin (akun seed) berhasil, dipaksa ganti password, redirect ke dashboard.
3. Login PJ Birdep (akun seed) berhasil, scope Birdep benar, tidak melihat menu Super Admin (`Kelola akun PJ`, `Periode & override lock`, `Broadcast`).
4. Header keamanan (`Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) hadir pada `/`, `/admin/login`, dan satu route admin - verifikasi lewat `curl -I`.
5. Cookie session: `Secure`, `HttpOnly`, `SameSite=Lax` (lihat pola verifikasi di `tests/e2e/auth.spec.ts`).
6. **Smoke test kirim email nyata (wajib, instruksi eksplisit pemilik proyek)**: picu satu email sungguhan (mis. lewat "lupa password" ke alamat test milik admin) dan konfirmasi benar-benar sampai ke inbox (bukan folder spam) - kalau gagal, cek domain terverifikasi di dashboard Resend dan `RESEND_FROM_EMAIL` sebelum lanjut.
7. Submit pendaftaran sintetis end-to-end (identitas + 2 pilihan Birdep + upload CV/foto) **hanya setelah** `REGISTRATION_SUBMISSION_ENABLED=true` diaktifkan secara sengaja untuk uji ini - upload tersimpan di MinIO (bisa diverifikasi lewat console MinIO via SSH tunnel), email konfirmasi benar-benar terkirim lewat Resend.
8. Halaman sukses pendaftaran (`/daftar/sukses?token=...`) menampilkan nomor registrasi yang benar.
9. Lock kandidat oleh PJ, override oleh Super Admin, unlock - audit log tercatat.
10. Export CSV menghasilkan file valid dengan scope Birdep yang benar.
11. Broadcast: jalankan **preview saja**, verifikasi jumlah penerima dan konten - **jangan klik send** pada smoke test (larangan eksplisit: jangan kirim broadcast nyata di luar jadwal resmi).
12. Setelah seluruh smoke test lolos, set `REGISTRATION_SUBMISSION_ENABLED=false` kembali sampai jadwal pendaftaran resmi dimulai (kecuali smoke test dilakukan tepat saat go-live).
13. Cek log aplikasi (`docker compose -f docker-compose.prod.yml logs app`): tidak ada PII/CV/esai mentah di structured log (lihat pola redaksi Phase 8 P1).

### 6. Rollback plan

1. **Trigger rollback**: smoke test post-deploy gagal, error rate/5xx melonjak, healthcheck container terus gagal (`docker compose ps` menunjukkan `unhealthy`), atau laporan insiden kritis (kebocoran data, auth bypass) dalam window pemantauan pasca-deploy.
2. **Kode**: checkout commit/tag sebelumnya yang diketahui baik, lalu `docker compose -f docker-compose.prod.yml up -d --build app` untuk rebuild+redeploy image dari commit itu. Jangan hotfix langsung di production tanpa lewat quality gate.
3. **Migration**: proyek ini tidak menyimpan migration "down" otomatis (Prisma migrate tidak generate downgrade script). Jika migration terbaru bermasalah:
   - Jika migration additive (kolom/tabel baru, tidak mengubah/menghapus data lama) dan kode lama masih kompatibel: rollback kode saja, biarkan skema; buat migration korektif terpisah setelah root cause jelas.
   - Jika migration destruktif/breaking: **restore dari backup pre-deploy** (§Backup dan restore) ke database production, bukan mencoba menulis migration "down" secara ad-hoc di bawah tekanan insiden.
4. **Feature flag cepat**: `REGISTRATION_SUBMISSION_ENABLED=false` di `.env` lalu `docker compose -f docker-compose.prod.yml up -d app` adalah rollback tercepat untuk masalah spesifik alur pendaftaran publik tanpa perlu rollback deploy penuh.
5. **Komunikasi**: catat waktu mulai/selesai insiden, root cause, dan tindakan di ringkasan insiden (lihat §Penanganan insiden) segera setelah stabil.
6. **Owner rollback**: pemilik proyek sendiri (ADR-038).

### 7. Verifikasi pasca-deploy (berkelanjutan, bukan sekali jalan)

- `restart: unless-stopped` sudah diset pada semua service di `docker-compose.prod.yml` - container yang crash akan otomatis restart oleh Docker daemon; verifikasi Docker daemon sendiri start-on-boot (`systemctl enable docker` di kebanyakan distro) supaya server reboot tidak butuh intervensi manual.
- Uptime monitor eksternal (mis. layanan uptime-check pihak ketiga gratis/berbayar, di luar cakupan kode ini) mengecek `/api/health`/`/api/readiness` dari luar server, dengan alert ke pemilik proyek.
- Error tracking (Sentry) belum diimplementasikan - untuk saat ini, pantau `docker compose -f docker-compose.prod.yml logs -f app` dan `docker compose ... logs -f nginx` secara berkala; pertimbangkan menambah Sentry pasca-MVP.
- Outbox worker dan orphan upload cleanup (`/api/internal/jobs/email-outbox`, `/api/internal/jobs/orphan-uploads`) dipanggil lewat host crontab (bukan job scheduler PaaS), dilindungi `CRON_SECRET`, mis.:
  ```cron
  */5 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://sekolah.ormawaeksekutifpku.com/api/internal/jobs/email-outbox
  0 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://sekolah.ormawaeksekutifpku.com/api/internal/jobs/orphan-uploads
  ```
  Verifikasi log job pertama sukses sebelum menganggap terjadwal dengan benar.
- Rate limit table (`auth_rate_limits`) tidak tumbuh tanpa batas - pastikan job pembersihan/TTL berjalan atau baris lama di-cleanup berkala.
- Backup harian otomatis terjadwal di host crontab (lihat §Backup dan restore untuk prosedur `pg_dump`/tar storage yang sudah diuji Phase 8) - drill restore pertama di environment terpisah (bukan Contabo yang sama) sebelum traffic pendaftaran nyata dibuka.
- Volume Docker (`sekolah_ormawa_postgres_prod_data`, `sekolah_ormawa_minio_data`) berada di disk lokal Contabo - pastikan backup mencakup volume ini juga, bukan hanya `pg_dump` (mis. snapshot Contabo kalau tersedia, atau backup volume secara terpisah).
- Tinjau log 24-48 jam pertama untuk pola anomali (rate limit terpicu, 5xx, upload gagal) sebelum dianggap stabil.

## Penanganan insiden

### Brute force/login abuse

1. Periksa rate-limit bucket dan pola IP/email hash tanpa membuka PII.
2. Tingkatkan lockout/CAPTCHA sesuai playbook tanpa mengubah pesan generik.
3. Jangan menonaktifkan password verification atau rate limit untuk memulihkan akses.

### Akun diduga kompromi

1. Ban akun, revoke seluruh row session melalui Better Auth, dan batalkan verification token reset aktif.
2. Pertahankan audit evidence dan redacted logs.
3. Reset melalui token/kanal aman; jangan mengirim password lama.
4. Review aksi kandidat, export, lock, dan catatan oleh actor tersebut.

### Kebocoran dokumen/PII

1. Batasi bucket/key, cabut signed access, dan rotasi service credential bila perlu.
2. Jangan menghapus evidence.
3. Identifikasi object, actor, waktu, dan dampak; eskalasi ke owner data/security.
4. Ikuti kebijakan notifikasi dan post-incident review yang disetujui.

### Konflik lock

1. Verifikasi maksimum satu row `unlocked_at IS NULL` per kandidat (`candidate_locks_one_active_per_candidate_key`, partial unique index sejak Fase 1).
2. Jika invariant utuh, 409 (`LOCK_CONFLICT`) adalah konflik normal dan UI harus refresh.
3. Jika invariant rusak, hentikan operasi lock dan jangan koreksi row manual tanpa aksi ter-audit.
4. Phase 6 sengaja tidak memakai isolasi `Serializable` untuk transaksi lock — partial unique index (fail-fast native constraint) adalah sumber kebenaran konkurensi. Lihat `PHASE_STATUS.md` Hasil Phase 6 untuk detail kenapa `Serializable` justru menyebabkan retry storm di bawah kontensi tinggi.

## Operasi Lock/Unlock dan Placement (Phase 6)

1. Lock hanya dapat dilakukan pada kandidat berstatus `SUBMITTED` yang memilih Birdep tersebut (primary atau secondary), dan hanya saat periode berstatus `OPEN` (ADR-030 - lebih sempit dari unlock). `lockReason` wajib diisi (ADR-031, minimal 5 karakter).
2. Lock mengubah `Candidate.status` menjadi `LOCKED`, membuat/mereset `CandidatePlacement` ke `UNDER_REVIEW`, dan menulis audit `LOCK`.
3. Unlock hanya dapat dilakukan oleh Birdep yang memegang lock aktif, saat periode `OPEN`/`CLOSED` dan `allowUnlock=true` pada periode tsb. `unlockReason` wajib. Mengembalikan `Candidate.status` ke `SUBMITTED`, menghapus row `CandidatePlacement`, dan menulis audit `UNLOCK`.
4. Selama kandidat terkunci, PJ pemegang lock dapat mengubah status placement (`UNDER_REVIEW`/`PLACED`/`WAITLISTED`/`NOT_SELECTED`/`WITHDRAWN`) lewat `PATCH api/admin/candidates/[id]/placement`; setiap perubahan tercatat audit `UPDATE` pada `entityType=CANDIDATE_PLACEMENT`.
5. Override lock (Super Admin membuka paksa kunci Birdep manapun, mengisi `overrideReason`) diimplementasikan Phase 7 - lihat bagian di bawah.
6. Untuk pengujian manual: lock butuh periode `OPEN`; unlock butuh periode `OPEN`/`CLOSED` dengan `allowUnlock=true`. Seed default menghasilkan periode `DRAFT` yang akan ditolak endpoint lock/unlock sesuai desain.

## Operasi Phase 7 (Periode, Override, Export, Broadcast)

### Manajemen periode

1. `/admin/dashboard/periode` (Super Admin) menampilkan seluruh periode dan memungkinkan edit field (`status`, `configStatus`, `entryYear`, `registrationPrefix`, `consentVersion`, `opensAt`/`closesAt`, `choice2Required`, `allowUnlock`) serta ketersediaan per Birdep (`acceptsApplications`, `quota`).
2. **Membuat periode BARU tidak dibangun di Phase 7** — hanya edit periode yang sudah ada (dari seed). Banyak field periode baru (prodi resmi, tahun masuk, prefix, jadwal) masih blocking sesuai `DECISIONS.md`; menambah UI create periode dianggap di luar scope aman untuk fase ini.
3. Transisi status tidak divalidasi sebagai state machine (semua kombinasi enum diizinkan) — operator bertanggung jawab memilih transisi yang masuk akal.

### Override lock lintas-Birdep

1. `/admin/dashboard/periode` juga menampilkan seluruh kandidat yang sedang terkunci lintas-Birdep (`GET api/admin/locks`).
2. Super Admin dapat force-unlock kandidat manapun lewat `POST api/admin/candidates/[id]/override`, **bypass** aturan periode `OPEN`/`CLOSED`/`allowUnlock` yang berlaku untuk unlock biasa. `overrideReason` wajib (ADR-031, minimal 5 karakter) dan tercatat audit `OVERRIDE` (bukan `UNLOCK`), sehingga tetap bisa dibedakan dari unlock normal oleh Birdep pemegang lock.
3. Override menghapus row `CandidatePlacement` seperti unlock biasa.

### Soft-delete dan restore kandidat

1. Tombol hapus (soft-delete) tersedia di halaman detail kandidat, khusus Super Admin, dan **hanya saat kandidat tidak sedang terkunci** (`POST api/admin/candidates/[id]/delete` menolak dengan 409 `CANDIDATE_LOCKED` jika masih locked — override/unlock dulu).
2. Kandidat yang dihapus otomatis tersembunyi dari seluruh query dashboard PJ (filter `deletedAt: null` sudah dipakai di semua tempat sejak Fase 5).
3. Pulihkan lewat daftar "Kandidat Terhapus" di `/admin/dashboard/periode` (`POST api/admin/candidates/[id]/restore`).

### Export CSV

1. Tombol "Export CSV" tersedia di dashboard kandidat (`GET api/admin/candidates/export?departmentId=...`), untuk PJ (scope sendiri) maupun Super Admin (Birdep terpilih) — memakai permission `sekolah.export.own_birdep` yang sudah ada sejak Fase 1.
2. Kolom yang diekspor sama dengan yang tampil di dashboard (identitas, IPK, pilihan, status, status placement). **Tidak ada** object key, signed URL, atau referensi file lain di dalam CSV.
3. Sel yang diawali `=`, `+`, `-`, atau `@` diberi prefix apostrof untuk mencegah eksekusi formula saat file dibuka di Excel/Sheets (mitigasi CSV injection).
4. Kandidat `WITHDRAWN`/`ARCHIVED`/soft-deleted tidak disertakan.

### Broadcast kandidat

1. `/admin/dashboard/broadcast` (Super Admin only) mengirim ke **kandidat**, difilter periode (implisit, sama seperti dashboard)/Birdep (opsional)/status placement (opsional) - bukan ke akun PJ.
2. Alur wajib dua langkah: `POST api/admin/broadcast/preview` (hitung penerima + sampel nama, tidak mengirim apa pun) menghasilkan `previewToken` (HMAC, TTL 10 menit) yang mengikat filter+subjek+isi pesan persis. `POST api/admin/broadcast/send` menolak jika token tidak ada/kedaluwarsa/tidak cocok dengan payload saat ini (mis. pesan diedit setelah preview) — operator harus preview ulang.
3. Mengirim ulang request `send` dengan `previewToken` yang sama (retry/klik ganda) tidak mengirim email dua kali: `idempotencyKey` outbox diturunkan deterministik dari token, sehingga baris duplikat ditolak unique constraint dan diperlakukan sebagai no-op.
4. Setiap broadcast yang berhasil menulis satu audit `BROADCAST` berisi jumlah penerima dan subjek (bukan isi pesan lengkap maupun daftar penerima).
5. Provider email production belum ada (blocker Fase 3 tetap berlaku); broadcast development masuk ke sink lokal (`storage/<EMAIL_SINK_ROOT>`) lewat mekanisme outbox yang sama dengan reset password/konfirmasi registrasi.

## Checklist handoff operasional

- [x] Repository kanonis ditentukan.
- [x] Arsitektur standalone dan auth internal ditentukan.
- [x] Git repository dan branch `main` tersedia.
- [ ] Git remote dan baseline commit tersedia.
- [ ] Owner database, storage, email, domain, backup, monitoring.
- [ ] Data organisasi/periode/eligibility dan kebijakan privasi disetujui.
- [ ] Backup/restore drill berhasil.
- [ ] UAT Super Admin, PJ, dan peserta berhasil.
- [ ] Security/accessibility/performance gate berhasil.
- [ ] Deployment dan rollback rehearsal berhasil.
