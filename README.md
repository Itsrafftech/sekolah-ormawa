# Sekolah Ormawa Eksekutif PKU

Aplikasi standalone untuk kanal publik, pendaftaran, dan seleksi program Sekolah Ormawa. Repository ini tidak memiliki runtime dependency ke Nexus-Tevo.

## Status

Phase 4 selesai. Aplikasi memiliki autentikasi internal Better Auth + Argon2id, forced password change, logout/revoke-all, reset sekali pakai, login rate limit, audit tereduksi, guard role/scope backend, dan shell admin tanpa fitur kandidat. Gate submission tetap default `false`; fixture dan consent masih `DRAFT`, sehingga seed normal tidak membuka pendaftaran.

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

Integration test memerlukan `TEST_DATABASE_URL` yang menunjuk ke PostgreSQL development/test, bukan production.

## Route pendaftaran Phase 3

- `/daftar`: form lima langkah atau state tertutup yang fail-closed.
- `/daftar/sukses?token=...`: bukti submit melalui token acak berumur pendek.
- `/api/registration/uploads`: upload tervalidasi ke adapter storage privat.
- `/api/registration/submit`: submit idempotent dalam transaksi database.
- `/api/internal/jobs/email-outbox` dan `/api/internal/jobs/orphan-uploads`: job internal berotorisasi `CRON_SECRET`.

Storage development dan email sink berada di folder `storage/` yang di-ignore. Implementasi produksi tetap memakai kontrak adapter Supabase private bucket dan provider email yang belum dikonfigurasi.

## Endpoint operasional

- `/api/health`: liveness aplikasi, tidak bergantung database.
- `/api/readiness`: readiness aplikasi dan PostgreSQL.

## Route autentikasi Phase 4

- `/admin/login`: login akun individual dengan respons generik.
- `/admin/ganti-password`: forced password dan rotasi credential.
- `/admin/lupa-password` serta `/admin/reset-password`: reset token sekali pakai melalui email sink development.
- `/admin/tidak-berwenang`: state akses ditolak.
- `/admin/dashboard`: shell identitas, role, department scope, dan permission; belum memuat kandidat atau fitur Phase 5.
- `/api/admin/auth/*`: route autentikasi aplikasi. Endpoint mentah `/api/auth/*` ditutup agar policy aplikasi tidak dapat dilewati.

## Route publik

- `/`: landing lengkap dan status pendaftaran dari server.
- `/tentang`: profil organisasi dan program.
- `/departemen`: direktori 13 unit dari master data database.
- `/faq`: pertanyaan umum, termasuk requirement portofolio Media Branding.
- `/kebijakan-privasi`: struktur kebijakan berstatus `DRAFT`, bukan kebijakan legal final.

## Batas keamanan sampai Phase 4

- Better Auth menjadi engine auth internal; password memakai Argon2id dan session selalu divalidasi ulang terhadap status akun, version, absolute expiry, idle timeout, role, serta department scope.
- Pendaftaran publik akun dimatikan.
- Akun seed bersifat sintetis dan hanya untuk development.
- Reset token disimpan sebagai hash, berlaku sekali, dan reset/password change mencabut session lama.
- Cookie session production memakai `HttpOnly`, `Secure`, `SameSite=Lax`, path `/`, dan host-only; POST auth juga memerlukan origin/CSRF yang valid.
- Bucket/storage production, email, akun nyata, dan deployment belum dibuat.
- Tidak ada daftar kandidat yang dimuat route publik. Periode `DRAFT`/tertutup dan release gate nonaktif tidak menyediakan form aktif.
- Draft browser hanya menyimpan teks; file, consent, token, dan reference upload tidak disimpan di `localStorage`.
- CV, pas foto, KTM, dan portofolio file tidak memiliki URL publik permanen.
