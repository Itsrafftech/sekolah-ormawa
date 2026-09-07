# PRD — Sekolah Ormawa Eksekutif PKU

> Dokumen ini merekonstruksi requirement produk dari kondisi implementasi saat ini (lihat `PHASE_STATUS.md` dan `DECISIONS.md`). Bagian yang masih berstatus `DRAFT` atau menunggu keputusan pengurus ditandai eksplisit sebagai **belum final**, bukan diasumsikan selesai.

## 1. Ringkasan

**Sekolah Ormawa** adalah aplikasi web standalone untuk mengelola siklus penuh program pengenalan dan magang organisasi (Sekolah Ormawa) di bawah **Ormawa Eksekutif PKU**, ditujukan pada mahasiswa baru IPB Angkatan 63. Aplikasi mencakup tiga permukaan:

1. **Kanal publik** — informasi program, profil unit kerja (Birdep/Biro/BPH), dan FAQ.
2. **Pendaftaran** — form pendaftaran calon peserta, upload dokumen, dan konfirmasi.
3. **Panel internal** — seleksi kandidat oleh penanggung jawab unit (PJ/Birdep) dan operasional oleh Super Admin.

Repository ini berdiri sendiri secara arsitektural: database, auth, storage, email, dan siklus rilisnya independen dari sistem lain (mis. Nexus-Tevo). Keputusan ini final (ADR-001 s.d. ADR-003 di `DECISIONS.md`).

## 2. Latar belakang & masalah

Sebelumnya, proses pendaftaran dan seleksi peserta magang organisasi dilakukan secara manual/tersebar (formulir non-terstruktur, seleksi tanpa alat bantu terpusat). Ini menyulitkan:

- Validasi data pendaftar (dokumen wajib, eligibility) secara konsisten.
- Koordinasi antar-unit kerja saat kandidat memilih lebih dari satu unit (Pilihan 1/Pilihan 2), termasuk konflik klaim kandidat yang sama oleh dua unit.
- Jejak audit siapa mengubah/melihat data kandidat, kapan, dan mengapa.
- Menjaga kerahasiaan dokumen pribadi pendaftar (CV, KTM, foto, portofolio).

Aplikasi ini menggantikan proses tersebut dengan alur pendaftaran daring, dashboard seleksi per unit, dan mekanisme lock/placement yang menghindari duplikasi keputusan penerimaan.

## 3. Tujuan produk

- Menyediakan kanal publik yang jelas tentang program, unit kerja, dan status pendaftaran — sumber kebenaran status pendaftaran adalah server (periode di database), bukan pengumuman statis.
- Menyediakan form pendaftaran yang tervalidasi, aman (upload privat, tidak ada dokumen pribadi yang publicly-accessible), dan tahan terhadap submit ganda (idempotent).
- Memberi setiap unit kerja (Birdep) ruang kerja terisolasi untuk meninjau kandidat yang relevan dengan mereka saja — kandidat yang dikunci unit lain tidak terlihat.
- Mencegah dua unit "merebut" kandidat yang sama secara bersamaan (concurrency-safe lock).
- Memberi Super Admin kontrol operasional penuh: kelola akun PJ, kelola periode/kuota, override lock saat diperlukan, export data, broadcast pengumuman, dan pemulihan data yang terhapus (soft-delete/restore).
- Menjaga seluruh keputusan akses dan data sensitif tegak di backend (bukan hanya UI), dengan audit log untuk aksi-aksi penting.

### Non-tujuan (out of scope untuk MVP)

- Single sign-on (SSO) dengan sistem lain (Nexus). Auth sepenuhnya internal untuk MVP (ADR-004, ADR-011).
- Monorepo/shared schema dengan sistem lain (ADR-001–003).
- CMS untuk konten publik — konten landing dikelola in-code (`src/content/public-site.ts`), keputusan CMS vs in-code masih non-blocking/future.
- Analytics non-esensial, 2FA, dual-approval aksi kritis, scheduling wawancara, tracking publik pendaftar — dicatat sebagai future/non-blocking di `DECISIONS.md`.
- State machine validasi transisi status periode (DRAFT/OPEN/CLOSED/ARCHIVED) — dicatat sebagai technical debt post-MVP (ADR-034); operator bertanggung jawab memilih transisi yang benar.
- Pembuatan periode baru dari nol lewat UI (hanya edit periode dari seed) — ditunda post-Phase 8 (ADR-032).
- Browse/search kandidat lintas-Birdep penuh untuk Super Admin — cukup department switcher + daftar locked (ADR-033).

## 4. Target pengguna & persona

| Persona | Peran | Kebutuhan utama |
|---|---|---|
| **Calon peserta** | Mahasiswa baru IPB Angkatan 63 | Info program jelas, tahu kapan pendaftaran dibuka, form pendaftaran mudah diisi (bisa disimpan sebagai draft), tahu status submisinya, dokumen pribadinya aman. |
| **Penanggung Jawab unit (`DEPT_PJ`)** | Pengurus satu Birdep/Biro/BPH | Melihat kandidat yang memilih unitnya (primary/secondary), membaca dokumen & esai, memberi catatan internal, mengunci kandidat yang diterima tanpa direbut unit lain. |
| **Super Admin (`SUPER_ADMIN`)** | Pengurus inti/Biro yang menjalankan sistem | Mengelola akun PJ, mengatur periode & kuota tiap unit, menyelesaikan sengketa lock (override), memulihkan data yang terhapus, export data ke CSV, broadcast pengumuman ke seluruh/segmen kandidat. |

## 5. Ruang lingkup fungsional

### 5.1 Kanal publik

- `/` — landing page: hero, profil program, timeline seleksi/magang, testimoni (placeholder sampai diverifikasi), CTA pendaftaran yang statusnya dibaca dari periode aktif di server.
- `/tentang` — definisi program, tujuan, manfaat, hak & kewajiban peserta.
- `/departemen` — direktori 13 unit kerja (BPH/Biro/Departemen) dari master data database, menandai unit mana yang membuka slot pada periode aktif.
- `/faq` — pertanyaan umum, termasuk requirement portofolio untuk pilihan Biro Media Branding.
- `/kebijakan-privasi` — struktur kebijakan privasi (status `DRAFT`, belum final secara hukum).
- Seluruh salinan/konten di atas memiliki status `DRAFT`/preview sampai dikonfirmasi pengurus (lihat `PUBLIC_CONTENT_STATUS` di `src/content/public-site.ts`) — bagian yang belum dikonfirmasi ditandai jelas di UI, tidak disamarkan sebagai final.

### 5.2 Pendaftaran

- Form pendaftaran lima langkah (`/daftar`), dengan:
  - Draft otomatis tersimpan di browser (**teks saja** — file, token, dan consent sengaja tidak disimpan di `localStorage`, ADR-019).
  - Dua pilihan unit (Pilihan 1 wajib, Pilihan 2 sesuai konfigurasi periode `choice2Required`).
  - Requirement portofolio wajib (file gambar atau tautan eksternal) jika Biro Media Branding dipilih sebagai Pilihan 1/2.
  - Upload dokumen (CV, foto, KTM, portofolio) ke storage privat lewat endpoint tervalidasi (`/api/registration/uploads`) sebelum submit final.
  - Validasi NIM dan email unik per periode.
- Form/CTA hanya aktif jika periode berstatus `OPEN` **dan** `REGISTRATION_SUBMISSION_ENABLED=true` (release gate terpisah, fail-closed by default — ADR-018). Jika tidak, halaman menampilkan state tertutup, bukan form kosong.
- Submit (`/api/registration/submit`) bersifat idempotent dalam satu transaksi database: pembuatan kandidat, nomor registrasi, entri audit, dan entri email outbox terjadi atomik; replay dengan idempotency key/payload identik mengembalikan hasil awal yang sama (ADR-021).
- Halaman sukses (`/daftar/sukses?token=...`) menampilkan bukti submit lewat token acak berumur pendek.
- Email konfirmasi dikirim asinkron lewat email outbox (job `/api/internal/jobs/email-outbox`), retry otomatis, tidak memblokir keberhasilan submit jika pengiriman gagal.
- Job `/api/internal/jobs/orphan-uploads` membersihkan file upload yang tidak pernah dituntaskan menjadi submission (fail-safe kebersihan storage).

### 5.3 Auth internal & authorization

- Dua role sistem: `SUPER_ADMIN` dan `DEPT_PJ` (ADR-005). Tidak ada role lain tanpa revisi keputusan.
- Setiap akun `DEPT_PJ` terikat pada tepat satu department scope, dipaksa dari session server — tidak pernah dari input client (ADR-006).
- Login (`/admin/login`) memberi respons generik untuk email/password salah (tidak membocorkan mana yang salah). Password di-hash Argon2id (ADR-007).
- Akun baru mendapat temporary password yang wajib diganti pada login pertama (`/admin/ganti-password`, ADR-008).
- Lupa password (`/admin/lupa-password` → `/admin/reset-password`) memakai token hash sekali pakai yang dikirim lewat email; reset mencabut seluruh session lama akun tersebut (ADR-023).
- Session dapat dicabut lewat logout, revoke-all, reset password, atau disable akun — divalidasi ulang tiap request terhadap status akun, session version, absolute expiry, dan idle timeout (ADR-009).
- Login rate-limited dan tercatat di audit log; rate limit & revocation diimplementasikan atomik di PostgreSQL untuk menghindari race condition (ADR-024).
- Seluruh authorization ditegakkan di backend: resource di luar scope role/department mengembalikan 404 (bukan 403) untuk mengurangi enumeration (ADR-014, ADR-025).
- Endpoint auth mentah Better Auth (`/api/auth/*`) ditutup; hanya `/api/admin/auth/*` (dibungkus policy aplikasi) yang dipakai, agar kebijakan sensitif tidak bisa dilewati (ADR-022).

### 5.4 Dashboard PJ (`DEPT_PJ`)

- `/admin/dashboard/kandidat` — daftar kandidat tersegmentasi per Birdep: kandidat yang memilih unit ini sebagai Pilihan 1 (primary), Pilihan 2 (secondary), dan kandidat yang sudah dikunci (locked) oleh unit ini.
- Kandidat yang dikunci unit *lain* hilang total dari daftar (tidak hanya disembunyikan sebagian) — mengurangi enumeration lintas-unit (ADR-026).
- `/admin/dashboard/kandidat/[id]` — detail kandidat: data diri, esai, pilihan unit, dan **file viewer terautentikasi** (CV/foto/KTM/portofolio) yang mengautorisasi tiap request lewat session admin, bukan token pemilik (ADR-027).
- Catatan internal per kandidat (`DepartmentNote`) bersifat scoped per-Birdep, bukan per-pembuat — PJ manapun dalam Birdep yang sama dapat mengubah/menghapus (soft-delete) catatan tersebut (ADR-029).
- **Lock/unlock kandidat**: PJ dapat mengunci kandidat sebagai "diklaim" unitnya, dengan alasan wajib diisi (`lockReason`). Lock hanya diizinkan saat periode `OPEN`. Unlock (juga wajib alasan) diizinkan saat periode `OPEN` atau `CLOSED`, ditolak saat `ARCHIVED`, dan mensyaratkan `allowUnlock=true` pada periode (ADR-030, ADR-031). Lock ditegakkan atomik di database untuk menghindari race condition saat banyak PJ mengunci kandidat yang sama secara bersamaan.

### 5.5 Panel Super Admin (`SUPER_ADMIN`)

- **Manajemen akun** (`/admin/dashboard/akun`): create/disable/reset-password/revoke-session akun PJ; seluruh aksi lifecycle ter-audit (ADR-010).
- **Manajemen periode** (`/admin/dashboard/periode`): edit periode (dari seed — pembuatan periode baru dari nol ditunda, ADR-032), kuota per departemen, `acceptsApplications` per unit, `choice2Required`, `allowUnlock`, jadwal buka/tutup.
- **Review kandidat lintas unit**: department switcher untuk meninjau kandidat per departemen terpilih (bukan overview gabungan seluruh unit sekaligus, ADR-028), plus daftar kandidat locked.
- **Override lock**: menyelesaikan sengketa klaim kandidat antar-unit dengan alasan wajib (`overrideReason`, ADR-031).
- **Soft-delete/restore kandidat**: kandidat dapat dihapus-lunak dan dipulihkan, bukan dihapus permanen langsung.
- **Export CSV** kandidat untuk kebutuhan pelaporan/rapat seleksi.
- **Broadcast email** (`/admin/dashboard/broadcast`): kirim pengumuman ke kandidat (dengan preview sebelum kirim), melalui email outbox yang sama dengan alur konfirmasi pendaftaran.

### 5.6 Operasional & observability

- `/api/health` — liveness, tidak bergantung database (untuk healthcheck container/orchestrator).
- `/api/readiness` — readiness aplikasi + koneksi PostgreSQL.
- Audit log (`AuditLog`) mencatat aksi sensitif: create/update/soft-delete/restore, login/login-denied, password reset/change, session revoke, lock/unlock/override, export, broadcast, submit, dan authorization-denied — dengan `requestId`, actor, before/after JSON, dan alasan bila relevan.

## 6. Model data (ringkasan)

Entitas inti (skema penuh: `prisma/schema.prisma`):

- **Identitas & akses**: `Role`, `Permission`, `RolePermission`, `User` (role + department scope), `Session`, `Account`, `PasswordResetToken`, `AuthRateLimit`.
- **Master data organisasi**: `Department` (13 unit: BPH/Biro/Departemen), `StudyProgram`, `RecruitmentPeriod`, `PeriodDepartment` (kuota & partisipasi unit per periode).
- **Pendaftaran & kandidat**: `Candidate` (data diri, esai, status, soft-delete via `deletedAt`), `CandidateChoice` (Pilihan 1/2), `FileUpload` (dokumen privat), `CandidatePortfolio` (file atau tautan eksternal), `RegistrationConfirmation`.
- **Seleksi**: `DepartmentNote` (catatan per-Birdep), `CandidateLock` (klaim + alasan + jejak unlock/override), `CandidatePlacement` (status penempatan akhir: under review/placed/waitlisted/not selected/withdrawn).
- **Infrastruktur aplikasi**: `IdempotencyRecord`, `AuditLog`, `EmailOutbox`.

Catatan desain: field `Candidate.gpa` (IPK) dibuat *nullable*, bukan dihapus, karena peserta Angkatan 63 mendaftar sebagai mahasiswa baru sebelum memiliki IPK — field ini sudah dihapus dari form pendaftaran, dashboard PJ, dan export CSV, namun kolom dipertahankan agar tidak perlu migration destruktif (ADR-040).

## 7. Requirement non-fungsional

- **Keamanan**
  - Dokumen kandidat (CV, foto, KTM, portofolio) di private object storage, tidak pernah punya URL publik permanen — diakses lewat signed URL berumur pendek (development) atau file viewer terautentikasi session (dashboard, ADR-013, ADR-027).
  - Semua authorization di backend; UI hanya mencerminkan hasil policy (ADR-014).
  - Cookie session production: `HttpOnly`, `Secure`, `SameSite=Lax`, path `/`, host-only; POST auth memerlukan origin/CSRF valid.
  - Reverse proxy production tidak mempercayai `X-Forwarded-For` dari client (mencegah spoofing IP yang melewati rate limiter login/submit) — ditemukan dan diperbaiki saat hardening Phase 9.
- **Idempotency & konsistensi**: submit pendaftaran dan lock kandidat harus atomik/concurrency-safe (diverifikasi lewat test race 50 lock bersamaan).
- **Accessibility**: halaman publik dan admin diuji dengan `@axe-core/playwright`; visual QA per breakpoint (mobile 360, tablet 768, desktop 1280/1440) didokumentasikan di `docs/artifacts/`.
- **Responsive**: seluruh halaman publik dan dashboard diverifikasi pada mobile/tablet/desktop.
- **Audit**: aksi sensitif tercatat dengan requestId, actor, before/after state, dan alasan.
- **Ketahanan operasional**: healthcheck per service, restart policy `unless-stopped` di Docker Compose production, job pembersihan upload orphan berjalan terjadwal.
- **Environment/secrets**: seluruh credential dari environment variable, tidak ada hard-code; variable wajib berbeda antara development (opsional) dan production (`superRefine` di `src/lib/env.ts`).

## 8. Status implementasi (ringkas)

Lihat `PHASE_STATUS.md` untuk laporan lengkap tiap fase. Ringkasan:

| Fase | Cakupan | Status |
|---:|---|---|
| 0 | Discovery, audit, kontrak standalone | PASS WITH NOTES |
| 1 | Fondasi aplikasi & data model | PASS |
| 2 | Landing page publik | PASS |
| 3 | Pendaftaran & upload | PASS |
| 4 | Auth internal & authorization | PASS |
| 5 | Dashboard PJ | PASS |
| 6 | Lock/unlock & placement | PASS |
| 7 | Super Admin & operasional | PASS |
| 8 | Hardening, QA, UAT | PASS |
| 9 | Adapter production (MinIO, Resend), deployment self-hosted, perbaikan schema drift | PASS (diverifikasi lokal — belum pernah dijalankan di server production sungguhan) |

## 9. Keputusan yang masih terbuka (blocking)

Dikutip dari `DECISIONS.md` — belum boleh dianggap selesai sampai pengurus mengonfirmasi:

**Blocking sebelum informasi/fitur dipublikasikan ke publik:**
1. Nama resmi produk/organisasi dan identitas visual final.
2. Konfirmasi 13 unit, unit yang menerima peserta, status BPH, dan kuota per Birdep.
3. Daftar prodi resmi, tahun masuk Angkatan 63, dan aturan eligibility final.
4. Tanggal periode, registration prefix/tahun, aturan Pilihan 2, dan kebijakan unlock.
5. Kebijakan privasi, versi consent, retensi, koreksi/penghapusan data, dan owner data.

**Blocking sebelum fitur diaktifkan di production:**
1. Identitas Super Admin awal dan kanal aman distribusi credential sebelum UAT auth.
2. Parameter session/reset/rate-limit final berdasarkan risk review.
3. ~~Provider storage & email production~~ — **selesai** (MinIO self-hosted, Resend — ADR-035/036), namun sender domain/template Resend konkret masih perlu dikonfigurasi pengurus.
4. ~~Owner domain/hosting/backup~~ — **selesai**, server Contabo milik Biro (ADR-037/038).

**Non-blocking/future**: CMS vs content-in-code, analytics non-esensial, scheduling wawancara, tracking publik, 2FA & dual-approval aksi kritis, integrasi SSO Nexus pasca-MVP, state machine transisi status periode, pembuatan periode baru dari UI, browse/search kandidat lintas-Birdep penuh.

## 10. Risiko & asumsi

- Seluruh verifikasi deployment (Docker build, stack Compose lengkap, TLS, healthcheck) dilakukan di lingkungan lokal — **belum pernah dijalankan di server Contabo sungguhan**. Go-live nyata memerlukan eksekusi penuh `RUNBOOK.md` §Deployment readiness dengan credential production asli.
- CAPTCHA (Turnstile) dan error tracking (Sentry) belum diimplementasikan — masih placeholder environment variable tanpa kode.
- Rollback drill deployment (redeploy image sebelumnya) baru didokumentasikan sebagai prosedur, belum pernah benar-benar dilatih (berbeda dari restore drill database yang sudah diverifikasi).
- Konten publik (profil organisasi, jadwal, kebijakan privasi) masih `DRAFT` — risiko: jika periode dibuka sebelum konten final disahkan, informasi yang tampil ke calon peserta belum akurat. Mitigasi: seluruh bagian draft ditandai jelas di UI dan release gate pendaftaran default nonaktif.
