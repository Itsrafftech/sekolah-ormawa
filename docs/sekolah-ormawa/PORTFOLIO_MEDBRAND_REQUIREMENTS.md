# Kontrak Portofolio Media Branding

> **SUPERSEDED (Phase D, ADR-045)**: seluruh dokumen di bawah ini mendeskripsikan mekanisme Phase 3 asli (upload file privat + `CandidatePortfolio`, multi-item). Keputusan pemilik proyek di Phase D mengganti mekanisme ini sepenuhnya untuk Medbrand/Badmedbrnd/RAB Komanggar menjadi satu field teks URL Google Drive (`CandidateSupplementalData.portfolioUrl`/`budgetPlanUrl`) - `CandidatePortfolio` sudah di-drop dari schema. Dokumen ini dipertahankan sebagai referensi historis keputusan Phase 3, bukan sebagai deskripsi perilaku saat ini - lihat ADR-043/ADR-045 di `DECISIONS.md` dan laporan "Hasil Phase C"/"Hasil Phase D" di `PHASE_STATUS.md` untuk keadaan terkini.

## Status dan batas fase

Dokumen ini mengunci requirement produk untuk Biro Media Branding. Phase 3 telah mengimplementasikan input conditional, file privat/URL HTTPS, validasi submit, metadata, migration, serta pengujiannya. Preview/download oleh PJ tetap pekerjaan Phase 5.

## Aturan produk

- Requirement aktif jika Media Branding dipilih sebagai Pilihan 1 atau Pilihan 2.
- Kandidat wajib memberikan sedikitnya satu item portofolio yang valid.
- Item dapat berupa file JPG, JPEG, atau PNG, atau URL portofolio yang valid.
- Metadata judul, deskripsi/kategori, peran, dan tahun pembuatan tersedia. Karena kebijakan final belum disetujui, server tidak mengarang kewajiban deskripsi; batas yang sudah final hanya jumlah, ukuran file, dan panjang URL melalui environment.
- Default development: maksimum 5 item dan maksimum 5 MiB per file. Keduanya wajib configurable melalui environment/config periode sebelum production.
- File disimpan pada bucket private; object key tidak memuat PII dan tidak pernah menjadi URL publik permanen.
- Server memvalidasi pilihan Birdep, jumlah item, ownership draft, status upload, extension, declared/detected MIME, magic byte, ukuran, dan URL. Validasi client hanya untuk bantuan pengguna.
- Hanya kandidat pemilik draft yang dapat mengubah item sebelum submit. Pada Phase 5, hanya Super Admin dan PJ Media Branding yang lolos policy backend yang dapat melihat item kandidat sesuai scope.

## Evaluasi schema Phase 1

`FileUpload` sudah menyediakan lifecycle private file generik untuk CV, foto, dan KTM: ownership token hash, bucket/object key, MIME declared/detected, ukuran, checksum, status, expiry, dan relasi kandidat. Model tersebut tepat untuk binary object, tetapi belum cukup mewakili:

- item portofolio berupa URL tanpa object storage;
- deskripsi per item;
- urutan item;
- keterkaitan eksplisit dengan requirement Media Branding;
- constraint maksimum item dan validasi kondisional berdasarkan kedua pilihan.

Migration `20260802001000_registration_phase3` mengimplementasikan model `CandidatePortfolio` yang merujuk kandidat dan opsional ke `FileUpload`:

```text
CandidatePortfolio
- id
- candidateId
- type: FILE atau EXTERNAL_LINK
- fileUploadId nullable, unique
- externalUrl nullable
- description
- sortOrder
- createdAt / updatedAt
```

Check constraint database memastikan tepat satu sumber file atau URL terisi. Service submit menegakkan batas jumlah, HTTPS tanpa server-side fetch, pilihan Media Branding pada kedua posisi, ownership token, dan status upload `VALIDATED`, lalu membuat candidate/portfolio dan mengubah upload menjadi `FINALIZED` dalam satu transaksi. Draft teks browser tidak membuat row kandidat dan tidak menyimpan reference file.

## Konfigurasi yang disiapkan untuk Phase 3

Config loader Phase 3 memakai nama non-secret berikut:

- `PORTFOLIO_MAX_FILES=5`
- `PORTFOLIO_MAX_FILE_BYTES=5242880`
- `PORTFOLIO_URL_MAX_LENGTH=2048`

Allowed MIME tetap dibatasi kode ke JPEG/PNG sesuai requirement yang disetujui; protocol URL hanya HTTPS dan server tidak melakukan fetch atau preview otomatis.

Validasi URL perlu keputusan threat model Phase 3: redirect, DNS rebinding, private-network host, serta apakah server mengambil metadata/preview. Default paling aman adalah menyimpan URL HTTPS tervalidasi tanpa server-side fetch otomatis.

## Traceability fase

| Fase | Hasil wajib |
|---:|---|
| 2 | Profil Media Branding dan FAQ menjelaskan requirement; kontrak, rancangan schema, dan test matrix tersedia |
| 3 | Selesai: input conditional, private upload/URL, metadata, konfigurasi, backend validation, ownership, submit transaction, dan test F3-P01 sampai F3-P12 |
| 5 | Preview/download terotorisasi untuk PJ Media Branding dan Super Admin; tidak ada public URL permanen |
| 8 | Security review URL/file, malware/content policy, retention, load, accessibility, dan UAT |

## Data dan kebijakan yang masih blocking

- Teks/deskripsi resmi requirement yang akan dipublikasikan.
- Apakah deskripsi setiap item wajib dan batas panjang final.
- Batas jumlah/ukuran production bila berbeda dari default development.
- Policy URL domain/protocol, preview, malware scanning, retensi, serta penghapusan.
- Policy akses PJ terhadap portofolio Pilihan 2 dan setelah kandidat ditempatkan.

Ketiadaan keputusan tersebut tidak menghalangi validasi development Phase 3 karena release gate default tertutup, consent tetap `DRAFT`, dan seluruh data uji sintetis. Keputusan ini tetap blocking sebelum pembukaan production.
