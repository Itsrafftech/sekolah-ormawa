# Rencana Implementasi Sekolah Ormawa

## Identitas dan keputusan final

- Status: Phase 4 selesai, menunggu approval Phase 5
- Tanggal: 2026-08-03 (Asia/Jakarta)
- Repository kanonis: `C:\Users\rafii\OneDrive\Documents\projectan\sekolah-ormawa`
- Domain produksi: `sekolah.ormawaeksekutifpku.com`
- Bentuk aplikasi: repository dan aplikasi standalone
- Runtime dependency ke Nexus/Tevo: tidak ada untuk MVP
- Batas fase saat ini: auth internal dan shell identitas/permission selesai; dashboard kandidat Phase 5 dan deployment belum dimulai

Keputusan pemilik proyek ini menggantikan bagian PRD yang menyebut monorepo, akun Nexus, shared authentication, atau SSO sebagai kebutuhan MVP. SSO Nexus dipindahkan ke future scope. Nexus-Tevo hanya menjadi referensi read-only untuk struktur organisasi, terminologi, dan identitas visual yang relevan.

## Arsitektur standalone final

```text
Browser publik/admin
        |
        v
Sekolah Ormawa - Next.js standalone
  |-- halaman publik
  |-- pendaftaran dan upload API
  |-- autentikasi internal admin
  |-- dashboard PJ/Super Admin
  |-- worker/outbox
        |
        +--> PostgreSQL khusus Sekolah
        +--> private object storage khusus Sekolah
        +--> provider email
        +--> logging/error monitoring
```

Setiap environment memiliki database, bucket, secret, dan deployment sendiri. Tidak ada foreign key, session store, package runtime, atau query langsung ke database Nexus-Tevo.

### Baseline teknis yang diimplementasikan pada Phase 1

| Lapisan | Baseline |
|---|---|
| Web/API | Next.js 16.2.12 App Router, TypeScript strict |
| UI | Tailwind CSS dan komponen aksesibel |
| Database | PostgreSQL 16 development, Prisma 7.9.1, default schema `public` |
| Authentication | Better Auth 1.6.25, credential internal, Argon2id, database session |
| Storage | Supabase Storage private bucket untuk MVP; adapter dibatasi pada kontrak object storage |
| Email | Provider transactional melalui outbox |
| Testing | Vitest unit dan integration PostgreSQL; browser visual QA diwajibkan mulai Phase 2 |
| Deployment | Independently deployable; detail provider/CI diselesaikan tanpa mengikat Nexus/Tevo |

Tidak ada layanan production yang dibuat atau dikonfigurasi pada Phase 1.

## Struktur repository yang digunakan

```text
sekolah-ormawa/
|-- src/
|   |-- app/                    # route publik, auth, admin, dan API
|   |-- components/             # UI aplikasi
|   |-- features/               # auth, registration, candidate, lock, export
|   |-- lib/                    # db, env, storage, email, logging
|   |-- server/                 # service, guard, policy, transaction
|   `-- styles/
|-- prisma/
|   |-- schema.prisma
|   |-- migrations/
|   `-- seed.ts                 # hanya data sintetis
|-- tests/
|   |-- unit/
|   `-- integration/
|-- docker/                     # init database test development
|-- docker-compose.yml          # PostgreSQL development lokal
|-- docs/sekolah-ormawa/
|-- .github/workflows/          # quality gate ketika CI dibuat
|-- package.json
|-- package-lock.json
|-- tsconfig.json
|-- next.config.mjs
`-- .env.example                # nama variable dan contoh non-secret
```

Tidak dibuat subfolder `apps/sekolah`. Root repository adalah root aplikasi. Git telah diinisialisasi pada branch `main`; tidak ada remote GitHub dan tidak ada commit yang dibuat oleh Phase 1.

## Model autentikasi internal

### Prinsip

- Hanya `SUPER_ADMIN` dan `DEPT_PJ` yang dapat memiliki akun admin.
- Pendaftaran peserta tidak membuat akun.
- Satu akun mewakili satu orang; penggunaan akun bersama dilarang.
- `DEPT_PJ` wajib memiliki tepat satu `departmentId`; `SUPER_ADMIN` tidak memiliki scope Birdep.
- Password disimpan hanya sebagai hash Argon2id dengan salt acak per password. Target awal: memory 64 MiB, tiga iterasi, parallelism 1, kemudian dibenchmark pada runtime deployment sebelum dibakukan.
- Temporary password bersifat acak, berumur pendek, tidak disimpan plaintext, dan selalu menetapkan `mustChangePassword=true`.
- Semua route/API admin memvalidasi session, status akun, forced password change, role, dan scope di backend.
- Otorisasi tidak menerima actor ID, role, atau department scope dari client.
- Penonaktifan/reset password mencabut seluruh session aktif melalui primitive Better Auth; user banned juga ditolak ulang oleh backend guard.

### Alur login

1. Better Auth menerima email/password pada Route Handler internal dan menerapkan database-backed rate limit.
2. Credential diverifikasi memakai custom Argon2id `hash`/`verify`; pendaftaran akun publik dimatikan.
3. Bila valid, Better Auth membuat token session opaque dan cookie server-side; secure cookie dipaksa pada production.
4. Backend guard memuat ulang user, menolak akun banned/role tidak valid/scope tidak valid, dan memeriksa expiry temporary password.
5. Bila `mustChangePassword=true`, guard Phase 4 membatasi route admin ke ganti password dan logout sampai password berubah.
6. Semua policy kandidat/Birdep menggunakan role dan `departmentId` hasil session/database, bukan body atau query client.

### Reset dan revocation

- Self-service reset Better Auth menghasilkan verification token ber-TTL; aplikasi wajib menjaga respons generik dan mereduksi token dari log.
- Link reset menjadi invalid setelah digunakan/expired sesuai alur library; provider email belum diaktifkan pada Phase 1.
- Reset oleh Super Admin dicatat dalam audit, mencabut seluruh session target, dan tidak pernah menampilkan password lama.
- Jika temporary password digunakan, nilainya hanya dapat ditampilkan/dikirim sekali melalui kanal yang disetujui dan wajib diganti pada login pertama.
- Logout mencabut session saat ini; Super Admin dapat mencabut semua session user melalui penonaktifan/reset/revoke-all.

### Permission efektif

| Role | Permission efektif minimum | Scope |
|---|---|---|
| `SUPER_ADMIN` | `sekolah.admin.all` | Seluruh periode dan Birdep |
| `DEPT_PJ` | `sekolah.candidate.read.own_birdep` | `session.user.departmentId` |
| `DEPT_PJ` | `sekolah.candidate.lock.own_birdep` | Kandidat memilih Birdep session |
| `DEPT_PJ` | `sekolah.note.manage.own_birdep` | Catatan Birdep session |
| `DEPT_PJ` | `sekolah.export.own_birdep` | Query dan filter dipaksa oleh server |

## Rancangan tabel auth dan department scope

Nama final kolom dapat mengikuti konvensi Prisma pada Phase 1, tetapi invariant berikut wajib dipertahankan.

### `roles`

| Kolom | Aturan |
|---|---|
| `code` | Primary/unique; hanya `SUPER_ADMIN` atau `DEPT_PJ` untuk MVP |
| `name`, `description` | Metadata tampilan Bahasa Indonesia |
| `is_system` | `true` untuk dua role minimum; tidak dapat dihapus |
| `created_at`, `updated_at` | UTC |

### `departments`

| Kolom | Aturan |
|---|---|
| `id` | UUID primary key lokal Sekolah |
| `reference_code` | Kode unik berdasarkan referensi organisasi |
| `name`, `short_name`, `sort_order` | Snapshot lokal; bukan runtime lookup ke Nexus |
| `is_active` | Menonaktifkan scope tanpa menghapus histori |
| `created_at`, `updated_at` | UTC |

### `users`

| Kolom | Aturan |
|---|---|
| `id` | UUID primary key |
| `email` | Unique; functional unique index `lower(btrim(email))` mencegah variasi case/whitespace |
| `name` | Identitas individual, wajib |
| `role` | FK ke `roles.code` |
| `department_id` | FK nullable; wajib untuk `DEPT_PJ`, harus null untuk `SUPER_ADMIN` |
| `banned`, `ban_reason`, `ban_expires` | Lifecycle disable dari Better Auth admin plugin |
| `must_change_password` | `true` untuk akun/temp password baru |
| `temporary_password_expires_at` | Nullable; wajib saat temporary credential aktif |
| `last_login_at`, `password_changed_at` | Nullable, UTC |
| `created_at`, `updated_at` | UTC |

Constraint database wajib memastikan kombinasi role/scope valid:

```text
DEPT_PJ     -> department_id IS NOT NULL
SUPER_ADMIN -> department_id IS NULL
```

### `accounts` (credential Better Auth)

| Kolom | Aturan |
|---|---|
| `id`, `user_id` | Primary key dan FK user |
| `provider_id` | `credential` untuk password internal |
| `account_id` | Identitas account library |
| `password` | Argon2id PHC string melalui custom hash/verify; tidak pernah diekspor/log |
| field token provider | Nullable dan tidak digunakan pada credential MVP |
| `created_at`, `updated_at` | UTC |

### `sessions`

| Kolom | Aturan |
|---|---|
| `id` | UUID primary key |
| `user_id` | FK ke users; cascade/revoke sesuai kebijakan |
| `token` | Token opaque unique yang dikelola Better Auth; wajib direduksi dari log |
| `expires_at`, `updated_at` | Batas session dan pembaruan library |
| `absolute_expires_at`, `session_version` | Hard maximum dan snapshot versi revocation user |
| `ip_address`, `user_agent` | Field kompatibilitas library; kebijakan minimisasi/retensi masih blocking |
| `created_at` | UTC |

Revocation menghapus session terkait dan revoke-all juga menaikkan `users.sessionVersion`; aksi dicatat pada `audit_logs`.

### `password_reset_tokens`

| Kolom | Aturan |
|---|---|
| `id`, `user_id` | UUID primary key dan FK user cascade |
| `token_hash` | SHA-256 token acak; token mentah tidak disimpan/log |
| `expires_at` | Token berumur pendek |
| `used_at` | Single-use claim; replay selalu ditolak |
| `requested_ip_hash` | HMAC IP untuk audit/abuse tanpa raw IP |
| `created_at` | UTC |

Tabel `verifications` tetap tersedia untuk kompatibilitas Better Auth, tetapi bukan sumber kebenaran reset Phase 4. Keputusan ini dicatat pada ADR-023.

### Tabel pendukung keamanan

- `rate_limits`: store database Better Auth berisi key, count, dan waktu request terakhir; retensi/tuning final menyusul risk review.
- `auth_rate_limits`: counter atomik scope + HMAC identity/IP untuk login/reset aplikasi.
- `audit_logs`: actor, action, entity, department, reason, request ID, before/after yang telah direduksi.
- `permissions` dan `role_permissions` dapat dibuat sejak fondasi agar permission minimum tidak tersebar sebagai kondisi UI. Role tetap hanya dua pada MVP.

## Ownership data dan referensi organisasi

- Semua tabel aplikasi, auth, kandidat, dokumen, lock, catatan, export, email, audit, dan evaluasi dimiliki database Sekolah.
- Tiga belas unit pada PRD/Nexus dapat digunakan sebagai bahan seed sintetis setelah dikonfirmasi pemilik proyek.
- ID Nexus tidak menjadi foreign key dan tidak diperlukan saat runtime.
- Perubahan struktur organisasi dilakukan melalui konfigurasi/master lokal Sekolah dan tercatat per periode.
- Tidak ada data kandidat atau akun Sekolah yang dikirim ke Tevo.

## Private storage yang direkomendasikan

Gunakan Supabase Storage dengan bucket private khusus Sekolah untuk MVP. Bucket private menerapkan access control pada setiap operasi, mendukung batas MIME/ukuran di level bucket, signed upload, dan signed download berumur pendek. Akses service-role hanya dari server.

Aturan wajib:

- bucket tidak public;
- nama object acak dan tidak mengandung NIM/email/nama;
- metadata file berada di PostgreSQL (`FileUpload`) dan object key tidak dikirim ke UI;
- presign hanya setelah validasi jenis/ukuran dan ownership upload;
- setelah upload, server memverifikasi MIME, magic byte, size, checksum, dan status finalize;
- signed download dibuat setelah authorization kandidat/Birdep dan maksimum 5-10 menit;
- tidak ada URL permanen di log, export, atau database candidate-facing;
- orphan cleanup, lifecycle/retention, backup metadata, dan delete ter-audit;
- abstraction storage menjaga opsi migrasi ke object storage S3-compatible lain.

Referensi: [Supabase private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals), [Storage access control](https://supabase.com/docs/guides/storage/security/access-control), dan [signed upload URL](https://supabase.com/docs/reference/javascript/file-buckets-createsigneduploadurl).

## Traceability requirement ke fase

| ID | Requirement | Fase | Status |
|---|---|---:|---|
| FND-01 | Scaffold standalone, TypeScript strict, quality scripts | 1 | Selesai |
| FND-02 | Database/migration/seed sintetis dedicated | 1 | Selesai |
| FND-03 | Tabel roles/users/sessions/reset/rate-limit/audit | 1 | Selesai |
| FND-04 | Constraint kandidat, pilihan, active lock | 1 | Selesai |
| PUB-01 | Landing, konten, timeline, FAQ, privacy, SEO | 2 | Selesai |
| PUB-02 | Status periode server-side dan published-only | 2 | Selesai |
| REG-01 | Form lima langkah, validasi, draft, consent | 3 | Selesai; gate default tertutup dan consent fixture `DRAFT` |
| REG-02 | Private upload dan cleanup orphan | 3 | Selesai untuk adapter development dan kontrak Supabase; provider production belum dibuat |
| REG-03 | Submit atomik, duplicate guard, idempotency, nomor registrasi | 3 | Selesai dan diuji dengan request paralel |
| REG-04 | Email outbox dan halaman sukses bertoken pendek | 3 | Selesai untuk sink development; provider production belum dibuat |
| REG-05 | Portofolio wajib bersyarat untuk pilihan Media Branding, deskripsi item, validasi file/URL, dan batas configurable | 3 | Selesai; akses PJ tetap Phase 5 |
| AUTH-01 | Login internal, Argon2id, database session | 4 | Selesai; login/UI/cookie/generic error/E2E tersedia |
| AUTH-02 | Forced password, reset, logout, revoke, disable, rate limit | 4 | Selesai pada service/route; lifecycle akun oleh Super Admin tetap Phase 7 |
| AUTH-03 | Role/permission/backend guard/department scope | 4 | Selesai dan diuji; resource kandidat baru dipasang Phase 5 |
| PJ-01 | Dashboard/list/detail/search/filter/file viewer | 5 | Direncanakan |
| PJ-02 | Catatan dan export utility scoped | 5 | Direncanakan |
| PJ-03 | Preview/download portofolio Media Branding hanya untuk PJ yang berwenang dan Super Admin | 5 | Direncanakan |
| LOCK-01 | Lock/unlock atomik, 409, audit, visibility | 6 | Direncanakan |
| LOCK-02 | Placement terpisah dari lock | 6 | Direncanakan |
| ADM-01 | Akun PJ create/edit/disable/reset/revoke | 7 | Direncanakan |
| ADM-02 | Periode, kandidat, override, export, broadcast, audit | 7 | Direncanakan |
| OPS-01 | Security, full QA, backup/restore, UAT | 8 | Direncanakan |
| OPS-02 | Deployment standalone dan rollback | 8 | Direncanakan |
| FUT-01 | Integrasi/SSO Nexus | Future | Di luar scope MVP |

## Hasil migration development

1. Tiga migration additive tersedia untuk schema awal/domain constraints, normalized email akun, dan registrasi Phase 3.
2. Seluruh migration berhasil diterapkan dari nol pada database development kosong `sekolah_ormawa_phase3_clean`.
3. Check role/department dan IPK, unique NIM/email per periode, unique candidate/department choice, serta partial unique active lock diuji pada PostgreSQL nyata.
4. Seed sintetis dijalankan dua kali tanpa duplikasi.
5. Reset destruktif otomatis tidak dijalankan; Prisma meminta consent eksplisit. Reproducibility dibuktikan dengan database kosong baru tanpa menghapus data.
6. Rollback drill tetap Phase 8; production mengutamakan roll-forward.
7. Migration `20260802001000_registration_phase3` menambah model portofolio, confirmation token hash/expiry, relasi period-upload, serta ciphertext response idempotency tanpa operasi destructive.
8. Migration production belum diotorisasi dan tidak dijalankan.
