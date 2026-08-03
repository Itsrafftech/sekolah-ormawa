# Phase 4 Visual QA

## Status

PASS — 2026-08-03 (Asia/Jakarta)

Audit dilakukan pada build produksi lokal dengan database dan akun fixture sintetis. Tidak ada akun, credential, email, storage, atau deployment production yang digunakan.

## Cakupan

| Viewport | Route/state | Pemeriksaan | Hasil |
|---|---|---|---|
| 360x800 | `/admin/login`, error credential, password visible | wrapping, form, feedback generik, visibility toggle, horizontal overflow | PASS |
| 390x844 | `/admin/lupa-password`, success generik; reset token invalid | loading, anti-enumeration copy, invalid/replay state, horizontal overflow | PASS |
| 768x1024 | `/admin/ganti-password`; `/admin/tidak-berwenang` | forced password identity/scope, three password fields, 403 state, responsive layout | PASS |
| 1440x900 | `/admin/dashboard` | identity, role, scope, permission ledger, logout/revoke actions, batas Phase 4 | PASS |

## State dan accessibility

- Loading route dan loading submit terlihat serta memakai live status.
- Error login dan reset memakai `role=alert`; respons login/reset tidak mengungkap keberadaan akun.
- Label, landmark, heading order, tombol visibility dengan pressed state, dan skip link tersedia.
- E2E membuktikan feedback error menerima fokus dan seluruh alur utama dapat dijalankan dengan keyboard.
- Tidak ada horizontal overflow pada 360, 390, 768, atau 1440 dalam pemeriksaan DOM.
- Console browser tidak memuat error atau warning pada route yang diaudit.
- `/admin/dashboard` tidak memuat tabel kandidat, statistik, lock, catatan, export, atau account management.

## Artefak

Folder: `docs/artifacts/phase-4/`

- `login-error-360x800.png`
- `forgot-password-390x844.png`
- `reset-invalid-390x844.png`
- `forced-password-768x1024.png`
- `access-denied-768x1024.png`
- `dashboard-shell-1440x900.png`

## Catatan reproduksi

1. Gunakan hanya `TEST_DATABASE_URL` dan fixture E2E sintetis.
2. Jalankan migration dan global fixture setup.
3. Jalankan production build lokal pada origin development yang sama dengan `NEXT_PUBLIC_APP_URL`.
4. Audit state di atas, lalu reset fixture test. Jangan memakai akun pengurus nyata.

