# Sekolah Ormawa Eksekutif PKU

Aplikasi standalone (Next.js) untuk kanal publik, pendaftaran, dan seleksi program **Sekolah Ormawa** — program pengenalan dan magang organisasi untuk mahasiswa baru IPB Angkatan 63 di bawah Ormawa Eksekutif PKU. Repository ini berdiri sendiri: tidak ada runtime dependency ke sistem lain (mis. Nexus-Tevo); database, storage, auth, dan siklus rilisnya sepenuhnya mandiri.

Dokumen produk lengkap ada di [`docs/sekolah-ormawa/PRD.md`](docs/sekolah-ormawa/PRD.md). Riwayat keputusan arsitektur ada di [`docs/sekolah-ormawa/DECISIONS.md`](docs/sekolah-ormawa/DECISIONS.md), dan status implementasi per fase ada di [`docs/sekolah-ormawa/PHASE_STATUS.md`](docs/sekolah-ormawa/PHASE_STATUS.md).

## Status

Implementasi sudah melewati Phase 9 dari rencana (lihat `PHASE_STATUS.md`): landing page, pendaftaran + upload privat, auth internal, dashboard PJ per-Birdep, lock/unlock + placement, tooling Super Admin (akun, periode, broadcast, export), hardening/QA/UAT, serta adapter production (MinIO untuk storage, Resend untuk email) dan Docker Compose self-hosted sudah dibangun dan diverifikasi secara lokal. **Belum pernah dijalankan di server production sungguhan** — belum ada database, storage, atau domain production yang live. Konten publik (profil organisasi, jadwal, kebijakan privasi) masih berstatus `DRAFT` sampai disahkan pengurus, dan release gate pendaftaran (`REGISTRATION_SUBMISSION_ENABLED`) default `false` (fail-closed).

## Fitur utama

- **Kanal publik**: landing, profil program, direktori 13 unit (Birdep/Biro/BPH), FAQ, kebijakan privasi — status pendaftaran dibaca langsung dari periode di server, bukan hard-code.
- **Pendaftaran**: form lima langkah dengan draft lokal (teks saja), upload dokumen (CV, foto, KTM, portofolio) ke storage privat, submit idempotent, halaman konfirmasi, dan email outbox.
- **Auth internal**: Better Auth + Argon2id, forced password change, forgot/reset password sekali pakai, login rate limit, revoke session/logout-all, guard role & department scope di backend.
- **Dashboard PJ (`DEPT_PJ`)**: daftar kandidat tersegmentasi (primary/secondary/locked) per Birdep, detail kandidat, catatan internal per-Birdep, file viewer terautentikasi, lock/unlock klaim kandidat.
- **Panel Super Admin (`SUPER_ADMIN`)**: manajemen akun PJ (create/disable/reset/revoke), manajemen periode & kuota per departemen, override lock, soft-delete/restore kandidat, export CSV, broadcast email.
- **Endpoint operasional**: `/api/health`, `/api/readiness`, job internal terjadwal (`email-outbox`, `orphan-uploads`) diautentikasi `CRON_SECRET`.

## Tech stack

- **Framework**: Next.js 16 (App Router, React 19), TypeScript, Tailwind CSS 4
- **Auth**: Better Auth + adapter Prisma, hashing Argon2id (`@node-rs/argon2`)
- **Database**: PostgreSQL 16 via Prisma 7 (`prisma-client`)
- **Storage**: adapter privat — development pakai filesystem lokal, production pakai MinIO (S3-compatible) via `@aws-sdk/client-s3`
- **Email**: adapter — development pakai sink lokal, production pakai Resend
- **Deployment**: Docker multi-stage (`output: "standalone"`), Docker Compose (`app` + `postgres` + `minio` + `nginx`), TLS via certbot
- **Testing**: Vitest (unit + integration), Playwright (E2E + a11y via `@axe-core/playwright`)

## Prasyarat development

- Node.js 22 atau lebih baru
- npm
- PostgreSQL 16; Docker Compose dapat digunakan untuk environment lokal

## Setup

1. Salin `.env.example` menjadi `.env` dan isi hanya credential development.
2. Jalankan `npm ci`.
3. Jalankan PostgreSQL development, misalnya `docker compose up -d postgres`.
4. Jalankan `npm run db:generate` dan `npm run db:migrate:deploy`.
5. Jalankan `npm run db:seed` untuk fixture sintetis.
6. Jalankan `npm run dev`.

## Quality commands

```text
npm run lint
npm run typecheck
npm run test
npm run test:integration
npm run test:e2e
npm run build
```

`npm run quality` menjalankan lint, typecheck, test, dan build secara berurutan. Integration test memerlukan `TEST_DATABASE_URL` yang menunjuk ke PostgreSQL development/test, bukan production. `test:integration` untuk storage MinIO memerlukan `MINIO_TEST_ENDPOINT` menunjuk ke container MinIO lokal.

## Route publik

- `/`: landing lengkap dan status pendaftaran dari server.
- `/tentang`: profil organisasi dan program.
- `/departemen`: direktori 13 unit dari master data database.
- `/faq`: pertanyaan umum, termasuk requirement portofolio Media Branding.
- `/kebijakan-privasi`: struktur kebijakan berstatus `DRAFT`, bukan kebijakan legal final.

## Route pendaftaran

- `/daftar`: form lima langkah atau state tertutup yang fail-closed.
- `/daftar/sukses?token=...`: bukti submit melalui token acak berumur pendek.
- `/api/registration/uploads`: upload tervalidasi ke adapter storage privat.
- `/api/registration/submit`: submit idempotent dalam transaksi database.
- `/api/internal/jobs/email-outbox` dan `/api/internal/jobs/orphan-uploads`: job internal berotorisasi `CRON_SECRET`.

Storage development dan email sink berada di folder `storage/` yang di-ignore.

## Route autentikasi & admin

- `/admin/login`: login akun individual dengan respons generik.
- `/admin/ganti-password`: forced password dan rotasi credential.
- `/admin/lupa-password` serta `/admin/reset-password`: reset token sekali pakai.
- `/admin/tidak-berwenang`: state akses ditolak.
- `/admin/dashboard`: shell identitas, role, department scope, dan permission.
- `/admin/dashboard/kandidat` dan `/admin/dashboard/kandidat/[id]`: daftar dan detail kandidat per-Birdep (PJ) atau per departemen terpilih (Super Admin).
- `/admin/dashboard/periode`: manajemen periode, kuota, dan konfigurasi departemen (Super Admin).
- `/admin/dashboard/akun`: manajemen akun PJ (Super Admin).
- `/admin/dashboard/broadcast`: broadcast email ke kandidat (Super Admin).
- `/api/admin/auth/*`: route autentikasi aplikasi. Endpoint mentah `/api/auth/*` ditutup agar policy aplikasi tidak dapat dilewati.
- `/api/admin/candidates/*`, `/api/admin/locks`, `/api/admin/periods/*`, `/api/admin/accounts/*`, `/api/admin/broadcast/*`, `/api/admin/departments`, `/api/admin/deleted-candidates`: API backend dashboard, seluruhnya di-guard role/scope di backend.

## Endpoint operasional

- `/api/health`: liveness aplikasi, tidak bergantung database.
- `/api/readiness`: readiness aplikasi dan PostgreSQL.

## Batas keamanan

- Better Auth menjadi engine auth internal; password memakai Argon2id dan session selalu divalidasi ulang terhadap status akun, version, absolute expiry, idle timeout, role, serta department scope.
- Pendaftaran publik akun dimatikan; akun hanya dibuat Super Admin.
- Akun seed bersifat sintetis dan hanya untuk development.
- Reset token disimpan sebagai hash, berlaku sekali, dan reset/password change mencabut session lama.
- Cookie session production memakai `HttpOnly`, `Secure`, `SameSite=Lax`, path `/`, dan host-only; POST auth juga memerlukan origin/CSRF yang valid.
- Seluruh authorization ditegakkan backend; resource di luar scope role/department mengembalikan 404, bukan 403, untuk mengurangi enumeration.
- Kandidat yang terkunci (`LOCKED`) oleh Birdep lain hilang total dari dashboard Birdep lain.
- Tidak ada daftar kandidat yang dimuat route publik. Periode `DRAFT`/tertutup dan release gate nonaktif tidak menyediakan form aktif.
- Draft browser hanya menyimpan teks; file, consent, token, dan reference upload tidak disimpan di `localStorage`.
- CV, pas foto, KTM, dan portofolio file tidak memiliki URL publik permanen — selalu lewat signed URL berumur pendek atau file viewer terautentikasi.

## Deployment

Target production adalah self-hosted Docker Compose di server milik Biro (bukan Vercel/PaaS): `Dockerfile` (multi-stage), `docker-compose.prod.yml` (app + Postgres + MinIO + Nginx, hanya Nginx yang publish port ke host), `deploy/nginx/nginx.conf` (reverse proxy, TLS via certbot). Urutan lengkap go-live ada di [`docs/sekolah-ormawa/RUNBOOK.md`](docs/sekolah-ormawa/RUNBOOK.md) §Deployment readiness — belum satu pun langkah di sana dijalankan terhadap server production sungguhan.

## Dokumentasi lanjutan

- `docs/sekolah-ormawa/PRD.md` — requirement produk lengkap.
- `docs/sekolah-ormawa/DECISIONS.md` — ADR dan keputusan arsitektur.
- `docs/sekolah-ormawa/PHASE_STATUS.md` — laporan hasil per fase implementasi.
- `docs/sekolah-ormawa/TEST_MATRIX.md` — matriks skenario test.
- `docs/sekolah-ormawa/UAT_CHECKLIST.md` — checklist UAT.
- `docs/sekolah-ormawa/RUNBOOK.md` — runbook operasional dan deployment.
