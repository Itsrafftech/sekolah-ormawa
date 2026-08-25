# Phase 7 Visual QA

## Status

PASS — 2026-08-11 (Asia/Jakarta)

Audit dilakukan pada `next dev` (Turbopack) lokal dengan database development dan fixture dari Fase 5/6 (Ahmad/Budi/Citra). Production build (`next build`) sudah diverifikasi lulus terpisah sebelum audit ini. Periode fixture disetel sementara ke `OPEN`/`allowUnlock=true` khusus untuk audit manual (nilai default seed tetap `DRAFT`/`allowUnlock=false`). Akun PJ QA yang dibuat selama audit ini (`pj.qa.fixture@example.test`) dihapus permanen setelah audit selesai; tidak ada data yang tersisa di luar tiga kandidat fixture yang sudah ada sejak Fase 5.

## Cakupan

| Viewport | Route/state | Pemeriksaan | Hasil |
|---|---|---|---|
| 390x844 | `/admin/dashboard` (Super Admin) | Nav "Kelola akun PJ", "Periode & override lock", "Broadcast" tampil; tombol "Export CSV" pada dashboard kandidat | PASS |
| 390x844 | `/admin/dashboard/akun` setelah create | Form create, akun baru tampil di list dengan badge "Belum setup", notice setup link terkirim | PASS |
| 390x844 | `/admin/dashboard/periode` expanded | Semua field periode terisi dari data aktual, checkbox `choice2Required`/`allowUnlock`, ketersediaan per Birdep | PASS |
| 390x844 | Override Lock panel | Kandidat locked (Citra) tampil dengan alasan asli, input alasan override + tombol, panel "Kandidat Terhapus" empty state | PASS |
| 390x844 | `/admin/dashboard/broadcast` preview | Filter Birdep/status placement, preview menghitung 3 kandidat dengan sampel nama, tombol "Kirim ke 3 kandidat" + "Batal" | PASS |
| 390x844 | Detail kandidat (Ahmad, SUBMITTED) | "Zona Super Admin" dengan tombol hapus (soft delete) tampil di bawah Catatan Birdep | PASS |
| 1440x900 | `/admin/dashboard/akun` | Layout desktop 3 akun (PJ Ristek, Super Admin, PJ QA baru) dengan badge role/Birdep/status | PASS |

## Fungsional yang turut terbukti selama audit visual

- Create akun PJ end-to-end lewat HTTP asli: form submit → akun baru muncul di list tanpa reload penuh → notice setup link dikirim lewat outbox.
- Period manager membaca dan menyimpan field asli (bukan hanya placeholder) - checkbox status ter-centang sesuai data database (`choice2Required=true`, `allowUnlock=true` karena disetel manual untuk audit).
- Override lock panel benar-benar membaca `candidate_locks` lintas-Birdep (Citra dikunci Biro Riset dan Teknologi oleh PJ Ristek Fixture, dengan alasan asli dari Fase 5).
- Broadcast preview menghitung penerima dari database real-time (3 kandidat cocok filter kosong = seluruh kandidat aktif pada periode).
- Danger zone hanya tampil untuk Super Admin dan hanya saat kandidat tidak locked (`candidate.status !== "LOCKED"`), sesuai desain.

## State dan accessibility

- Semua form baru menggunakan `<label>` terhubung; tombol aksi memiliki state disabled+loading saat pending.
- Notice/error memakai `role="status"`/`role="alert"` konsisten dengan pola Fase 5/6.
- Tidak ada horizontal overflow pada 390x844 atau 1440x900 dalam pemeriksaan visual.

## Artefak

Folder: `docs/artifacts/phase-7/`

- `dashboard-superadmin-nav-390x844.png`
- `account-manager-created-390x844.png`
- `account-manager-1440x900.png`
- `period-manager-expanded-390x844.png`
- `override-lock-panel-390x844.png`
- `broadcast-preview-390x844.png`
- `candidate-detail-danger-zone-390x844.png`

## Catatan reproduksi

1. Gunakan hanya database development dan fixture sintetis.
2. Set sementara `recruitment_periods.status='OPEN'` dan `allowUnlock=true` pada periode fixture untuk menguji lock/override; default seed adalah `DRAFT`/`false`.
3. Jalankan `npm run dev`, login sebagai `superadmin.fixture@sekolah.local`.
4. Uji create akun PJ, edit/disable/reset/revoke, edit periode, override lock (butuh kandidat locked - lihat `RUNBOOK.md`), export CSV, dan broadcast preview→kirim.
5. Hapus akun PJ dan kandidat sintetis yang dibuat khusus untuk QA, kembalikan periode ke `DRAFT`/`false`, lalu jalankan ulang `npm run db:seed`.
