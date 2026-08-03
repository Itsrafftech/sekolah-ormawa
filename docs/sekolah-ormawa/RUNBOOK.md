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

Untuk PostgreSQL Docker lokal, jalankan `docker compose up -d postgres` lebih dahulu. Database development dan test menggunakan port lokal `55432`; nilainya dapat diubah di environment development. `npm run db:seed` aman dijalankan ulang. `npm run db:reset:dev` bersifat destruktif, hanya untuk database development sintetis, dan Prisma akan meminta consent eksplisit saat dijalankan oleh agent.

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

### Membuat akun PJ

1. Super Admin memilih user individual dan Birdep aktif; workflow UI/API ini baru diimplementasikan pada Phase 7.
2. Server memastikan normalized email unik dan role `DEPT_PJ` memiliki `departmentId`.
3. Buat reset link sekali pakai atau temporary password acak dengan expiry.
4. Set `mustChangePassword=true`; Better Auth menyimpan hash Argon2id pada credential account, lalu aplikasi mengaudit actor/target/department/request ID.
5. Jangan mencetak password/token ke log.

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

### Production - belum diotorisasi

Urutan rencana: backup terverifikasi -> migration additive -> deploy kompatibel -> smoke test -> monitoring. Utamakan roll-forward; drop schema/tabel memerlukan persetujuan eksplisit dan restore drill.

## Private storage

- Gunakan bucket Supabase Storage private khusus kandidat.
- Service-role key hanya server-side.
- Client mendapat signed upload token setelah server membuat `FileUpload` milik draft/period yang tepat.
- Download dilakukan lewat authorized proxy atau signed URL 5-10 menit.
- Validasi extension, declared MIME, detected MIME/magic byte, size, checksum, ownership, dan finalize state.
- Object key acak dan tidak memuat PII.
- CV/foto/KTM tidak boleh ditempatkan di `public/`.
- Cleanup orphan dan retensi/purge wajib ter-audit.
- Portofolio Media Branding mengikuti kontrak `PORTFOLIO_MEDBRAND_REQUIREMENTS.md`; input/upload/URL Phase 3 sudah tersedia, sedangkan akses PJ tetap Phase 5.

### Adapter Phase 3

- Development memakai adapter filesystem privat di `storage/<STORAGE_PRIVATE_ROOT>`; path dinormalisasi dan tidak diekspos sebagai static route.
- Kontrak `PrivateStorageAdapter` menjaga operasi `put`, `read`, dan `delete` agar implementasi Supabase dapat dipasang tanpa mengubah service registrasi.
- Endpoint download membutuhkan owner cookie serta signature HMAC berumur pendek. Dashboard Phase 5 wajib mengganti policy owner-draft dengan policy role/scope backend.
- Job orphan upload dipanggil melalui endpoint internal dengan Bearer `CRON_SECRET`; tanpa secret yang dikonfigurasi endpoint menolak request.

## Operasi registrasi development

1. Gunakan hanya database development/test dan data sintetis.
2. Pastikan periode berstatus `OPEN`, `configStatus=ACTIVE`, consent sesuai, serta `REGISTRATION_SUBMISSION_ENABLED=true` hanya pada environment uji terkontrol.
3. Jalankan aplikasi, isi `/daftar`, lalu verifikasi `/daftar/sukses?token=...` tanpa membagikan token.
4. Proses outbox melalui `POST /api/internal/jobs/email-outbox` dengan Bearer cron secret development; output email masuk ke `storage/<EMAIL_SINK_ROOT>`.
5. Jalankan orphan cleanup melalui `POST /api/internal/jobs/orphan-uploads` dengan mekanisme yang sama.
6. Kembalikan gate ke `false` setelah pengujian manual. Seed normal tetap menghasilkan periode `DRAFT` dan tidak membuka form.

Email provider production, malware scanning, kebijakan retensi, serta owner bucket belum disetujui. Kegagalan email tidak membatalkan kandidat karena pesan sudah disimpan di outbox dan dapat dicoba ulang secara idempotent.

## Seed dan data

- Hanya fixture sintetis; jangan memakai mahasiswa atau credential nyata.
- Tiga belas unit referensi tersedia sebagai fixture `DRAFT`; semuanya default tidak menerima pendaftaran, termasuk BPH.
- Seed role minimum hanya `SUPER_ADMIN` dan `DEPT_PJ`.
- Seed auth development menggunakan credential dummy yang jelas dan tidak terkirim ke provider email production.

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

## Deployment readiness

- DNS/TLS `sekolah.ormawaeksekutifpku.com`;
- project hosting, PostgreSQL, storage, email, dan secret manager milik Sekolah;
- migration dan backup teruji;
- cookie secure dan origin/CSRF policy benar;
- rate limit login/submit/upload;
- outbox/worker sehat;
- logging dengan request ID dan redaction;
- error tracking, uptime monitor, alert owner, serta on-call;
- smoke test login, forced-password, revoke, scope PJ, closed-period submit, upload privat, dan readiness;
- rollback threshold dan owner.

Deploy production hanya dilakukan dengan perintah eksplisit setelah Phase 8.

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

1. Verifikasi maksimum satu row `unlocked_at IS NULL` per kandidat.
2. Jika invariant utuh, 409 adalah konflik normal dan UI harus refresh.
3. Jika invariant rusak, hentikan operasi lock dan jangan koreksi row manual tanpa aksi ter-audit.

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
