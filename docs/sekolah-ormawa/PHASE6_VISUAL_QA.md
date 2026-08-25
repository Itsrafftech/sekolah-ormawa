# Phase 6 Visual QA

## Status

PASS — 2026-08-11 (Asia/Jakarta)

Audit dilakukan pada `next dev` (Turbopack) lokal dengan database development dan tiga kandidat sintetis dari Phase 5 (lihat `RUNBOOK.md`). Production build (`next build`) sudah diverifikasi lulus terpisah sebelum audit ini. Periode fixture disetel sementara ke `OPEN`/`allowUnlock=true` khusus untuk audit manual (nilai default seed tetap `DRAFT`/`allowUnlock=false`, sesuai desain fail-closed). Tidak ada akun, credential, kandidat, atau deployment production yang digunakan.

## Cakupan

| Viewport | Route/state | Pemeriksaan | Hasil |
|---|---|---|---|
| 390x844 | Detail kandidat `SUBMITTED` (Budi) | Panel "Kunci kandidat", status pill "Tersedia" | PASS |
| 390x844 | Setelah lock (reason wajib) | Panel "Terkunci", info pengunci+waktu+alasan, selector status placement, tombol "Buka kunci" | PASS |
| 390x844 | Setelah ubah placement ke PLACED | Selector merefleksikan "Ditempatkan" setelah `router.refresh()` | PASS |
| 390x844 | Setelah unlock (reason wajib) | Kembali ke status pill "Tersedia" dan panel "Kunci kandidat" | PASS |
| 390x844 | Kandidat locked tanpa placement (Citra, fixture Fase 5) | Panel "Terkunci" tampil tanpa selector placement (defensive null-check), tidak crash | PASS |
| 1440x900 | Dashboard tab "Terkunci Birdep ini" | Tab aktif menghitung 1, konsisten dengan state lock terbaru | PASS |

## Fungsional yang turut terbukti selama audit visual

- Alur lock end-to-end lewat HTTP asli: klik "Kunci kandidat ini" → isi alasan → submit → `router.refresh()` menampilkan status baru tanpa reload penuh.
- Placement selector memanggil `PATCH .../placement` dan merefleksikan status baru setelah refresh.
- Unlock mengembalikan kandidat ke status `SUBMITTED` dan menghapus card placement dari tampilan (karena row `CandidatePlacement` dihapus).
- Dashboard list (tab "Terkunci Birdep ini") menghitung ulang dengan benar setelah kandidat dikunci.

## Bug ditemukan dan diperbaiki selama pengembangan (bukan hanya audit visual)

1. **Retry storm di bawah race 50 lock (ditemukan lewat automated test F6-01, dikonfirmasi ulang manual)**: Implementasi awal `lockCandidate` memakai isolasi transaksi `Serializable` dan retry hingga 3 kali. Di bawah 50 percobaan konkuren pada satu baris kandidat, ini menyebabkan seluruh 50 percobaan gagal (0 sukses) karena retry yang saling bertabrakan berulang kali, bahkan sempat memicu `deadlock detected` sungguhan dari PostgreSQL saat retry diperluas ke error transaksi P2028. Diperbaiki dengan mendesain ulang: partial unique index PostgreSQL (`candidate_locks_one_active_per_candidate_key`) menjadi satu-satunya sumber kebenaran konkurensi lewat native unique-violation yang fail-fast, transaksi tanpa isolasi khusus (READ COMMITTED default), dan tanpa retry sama sekali. Hasil: tepat 1 sukses, 49 gagal bersih dengan status 409, dalam hitungan detik.
2. **Connection pool starvation**: `src/lib/db.ts` memakai default pool node-postgres (`max: 10`), yang menjadi bottleneck terpisah di bawah 50 request konkuren dan memunculkan error driver `P2028` (transaksi kedaluwarsa saat antre koneksi). Dinaikkan ke `max: 20` — nilai wajar untuk beban admin internal dan cukup untuk skenario race test.
3. Kedua temuan di atas murni di lapisan konkurensi/infrastruktur; tidak ada perbaikan pada logic otorisasi atau aturan bisnis lock/unlock.

## State dan accessibility

- Textarea alasan lock/unlock memiliki `<label>` terhubung; tombol submit dinonaktifkan saat pending dengan indikator loading.
- Status pill memakai `StatusPill` (Fase 5) yang sama, tone `warning` untuk terkunci dan `ready` untuk tersedia.
- Tidak ada horizontal overflow pada 390x844 atau 1440x900 dalam pemeriksaan visual.

## Artefak

Folder: `docs/artifacts/phase-6/`

- `lock-panel-available-390x844.png`
- `lock-panel-locked-390x844.png`
- `lock-panel-placed-390x844.png`
- `lock-panel-after-unlock-390x844.png`
- `lock-panel-locked-no-placement-390x844.png`
- `dashboard-locked-tab-1440x900.png`

## Catatan reproduksi

1. Gunakan hanya database development dan fixture sintetis.
2. Set sementara `recruitment_periods.status='OPEN'` dan `allowUnlock=true` pada periode fixture (default seed adalah `DRAFT`/`false`, sesuai desain fail-closed) — jangan lakukan ini pada database yang mendekati production.
3. Jalankan `npm run dev`, login sebagai `pj.ristek.fixture@sekolah.local`.
4. Buka detail kandidat `SUBMITTED`, uji lock → ubah placement → unlock, lalu bandingkan dengan kandidat locked tanpa placement (fixture Citra).
5. Kembalikan periode ke `DRAFT`/`allowUnlock=false` dan jalankan ulang `npm run db:seed` setelah selesai.
