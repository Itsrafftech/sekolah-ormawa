# Checklist UAT (User Acceptance Testing) - Sekolah Ormawa Eksekutif PKU

Dokumen ini untuk penguji **non-teknis**. Tidak perlu tahu coding - cukup ikuti langkah, amati hasil, lalu centang.

## Sebelum mulai

- [ ] Sudah tahu alamat (URL) aplikasi yang akan diuji, dan **paham ini bukan alamat production sungguhan** kecuali diberi tahu eksplisit.
- [ ] Sudah punya akun uji untuk role yang akan diuji (Super Admin dan/atau PJ Birdep), diberikan oleh tim teknis lewat kanal aman (bukan lewat chat biasa).
- [ ] Gunakan browser modern (Chrome, Edge, atau Firefox versi terbaru).
- [ ] Uji minimal di dua ukuran layar: **laptop/desktop** dan **HP** (atau browser di-resize sekecil layar HP).
- [ ] **JANGAN** memasukkan data pribadi asli (NIK, nomor HP asli, email asli milik orang lain) - gunakan data contoh/rekaan saja.
- [ ] **JANGAN** klik tombol kirim broadcast (di bagian Broadcast) - untuk skenario broadcast, cukup sampai langkah "Preview", jangan klik "Kirim".
- [ ] Setiap langkah gagal: tulis apa yang terjadi (screenshot kalau bisa), jangan coba "perbaiki sendiri" atau ulangi berkali-kali.

Format tiap langkah: **Aksi** (apa yang dilakukan) -> **Hasil yang diharapkan** (apa yang seharusnya terjadi). Centang jika hasil sesuai; kalau tidak sesuai, tandai **GAGAL** dan catat di kolom catatan di akhir dokumen.

---

## Bagian 1 - Super Admin

### 1.1 Login pertama kali dan ganti password

- [ ] Buka halaman login admin. **Hasil**: muncul form login dengan kolom "Email akun Sekolah" dan "Password".
- [ ] Masukkan email dan password sementara yang diberikan tim teknis, klik "Masuk ke ruang kerja". **Hasil**: diarahkan ke halaman "Ganti password" (bukan langsung ke dashboard) - ini wajib untuk password sementara.
- [ ] Isi "Password sementara/saat ini" dengan password lama, "Password baru" dan "Ulangi password baru" dengan password baru yang kuat (bukan kata umum, minimal seperti yang diminta form). **Hasil**: setelah klik "Ganti password", masuk ke Dashboard.
- [ ] Coba login ulang pakai password LAMA. **Hasil**: ditolak dengan pesan error (password lama tidak berlaku lagi).
- [ ] Login ulang pakai password BARU. **Hasil**: langsung masuk ke Dashboard tanpa diminta ganti password lagi.

### 1.2 Dashboard dan navigasi

- [ ] Lihat halaman Dashboard. **Hasil**: terlihat nama akun, role "SUPER_ADMIN", dan daftar permission/kewenangan.
- [ ] Cari menu/tombol untuk berpindah antar Birdep (department switcher) di daftar kandidat. **Hasil**: bisa memilih Birdep yang berbeda-beda, dan daftar kandidat berubah sesuai Birdep yang dipilih.
- [ ] Perhatikan menu yang HANYA muncul untuk Super Admin: "Kelola akun PJ", "Periode & override lock", "Broadcast". **Hasil**: ketiga menu ini terlihat jelas di Dashboard.

### 1.3 Kelola akun PJ

- [ ] Buka menu "Kelola akun PJ". **Hasil**: muncul daftar akun PJ yang sudah ada per Birdep.
- [ ] Buat akun PJ baru: isi nama, email, dan pilih satu Birdep. **Hasil**: akun baru muncul di daftar, berstatus aktif; sistem memberi tahu ada password sementara yang perlu disampaikan lewat kanal aman.
- [ ] Coba buat akun baru dengan email yang SAMA seperti akun yang sudah ada. **Hasil**: ditolak dengan pesan error yang jelas (email sudah dipakai).
- [ ] Nonaktifkan salah satu akun PJ (bukan akun yang sedang dipakai untuk uji ini). **Hasil**: status akun berubah jadi nonaktif; coba bayangkan/tanyakan ke tim teknis apakah akun itu memang tidak bisa login lagi.
- [ ] Aktifkan kembali akun yang barusan dinonaktifkan. **Hasil**: status kembali aktif.
- [ ] Reset password salah satu akun PJ. **Hasil**: sistem memberi tahu ada password sementara baru yang perlu disampaikan ke PJ terkait.
- [ ] Cabut sesi (revoke) salah satu akun PJ yang sedang login di tab/browser lain (kalau memungkinkan diuji bersama rekan yang berperan sebagai PJ). **Hasil**: akun PJ tersebut otomatis logout/diminta login ulang.

### 1.4 Kelola periode pendaftaran

- [ ] Buka menu "Periode & override lock". **Hasil**: muncul detail periode pendaftaran aktif (nama, status, tanggal buka/tutup).
- [ ] Ubah pengaturan Birdep dalam periode (misal kuota atau apakah Birdep menerima pendaftaran) lalu simpan. **Hasil**: perubahan tersimpan dan terlihat saat halaman dimuat ulang.
- [ ] Cari daftar kandidat yang sedang dikunci (locked) oleh PJ Birdep. **Hasil**: daftar terlihat dengan nama Birdep yang mengunci.

### 1.5 Override unlock (buka paksa kandidat yang dikunci)

- [ ] Pilih satu kandidat yang sedang dikunci PJ Birdep, isi alasan override, lakukan override unlock. **Hasil**: kandidat tersebut tidak lagi berstatus terkunci; ada catatan/alasan tersimpan (audit).
- [ ] Coba lakukan override TANPA mengisi alasan. **Hasil**: ditolak, sistem meminta alasan diisi terlebih dahulu.

### 1.6 Export data kandidat

- [ ] Buka fitur export CSV untuk satu Birdep. **Hasil**: file CSV terunduh, bisa dibuka di Excel/Google Sheets, isinya sesuai kandidat Birdep yang dipilih.

### 1.7 Broadcast (PENTING: jangan kirim beneran)

- [ ] Buka menu Broadcast, pilih filter penerima (misal semua peserta di satu periode), isi judul dan isi pesan contoh. **Hasil**: muncul opsi "Preview" yang menampilkan perkiraan jumlah penerima dan isi pesan.
- [ ] Klik Preview. **Hasil**: jumlah penerima dan isi pesan tampil sesuai filter yang dipilih; **tidak ada email yang benar-benar terkirim**.
- [ ] **JANGAN klik tombol kirim/send.** Tutup halaman ini setelah preview terlihat benar.

### 1.8 Hapus dan pulihkan kandidat (soft-delete)

- [ ] Pilih satu kandidat contoh, gunakan tombol hapus (danger zone) untuk soft-delete. **Hasil**: kandidat hilang dari daftar utama, ada pesan bahwa data tetap ada dan bisa dipulihkan.
- [ ] Buka daftar kandidat terhapus dan pulihkan kandidat yang sama. **Hasil**: kandidat muncul kembali di daftar utama.

### 1.9 Logout dan sesi

- [ ] Klik "Logout sesi ini". **Hasil**: keluar dari akun, kembali ke halaman login.
- [ ] Login lagi, lalu klik "Cabut semua sesi". **Hasil**: keluar dari akun (sesi saat ini juga ikut tercabut), harus login ulang untuk masuk lagi.

---

## Bagian 2 - PJ Birdep

### 2.1 Login pertama kali dan ganti password

- [ ] Ulangi langkah 1.1 memakai akun PJ. **Hasil**: sama seperti Super Admin - dipaksa ganti password sementara di login pertama.

### 2.2 Dashboard dan batas kewenangan

- [ ] Lihat Dashboard. **Hasil**: role tertulis "DEPT_PJ" dan nama Birdep yang menjadi tanggung jawab akun ini.
- [ ] Periksa menu "Kelola akun PJ", "Periode & override lock", "Broadcast". **Hasil**: ketiga menu ini **TIDAK terlihat/tidak bisa diakses** oleh akun PJ (khusus Super Admin).
- [ ] Lihat daftar kandidat. **Hasil**: hanya kandidat yang memilih Birdep ini yang muncul (Pilihan Utama, Pilihan Kedua, dan Terkunci Birdep Ini).

### 2.3 Detail kandidat dan dokumen

- [ ] Klik salah satu kandidat untuk membuka detail. **Hasil**: terlihat identitas, esai, pilihan Birdep, dan dokumen (CV, foto, portofolio jika ada).
- [ ] Buka salah satu dokumen (misal CV). **Hasil**: dokumen bisa dilihat/diunduh dari dalam aplikasi (bukan lewat link publik yang bisa dibagikan sembarangan).

### 2.4 Catatan Birdep

- [ ] Tambahkan catatan evaluasi pada satu kandidat. **Hasil**: catatan tersimpan dan tampil di halaman detail kandidat.
- [ ] Ubah catatan yang baru dibuat. **Hasil**: perubahan tersimpan.
- [ ] Hapus catatan tersebut. **Hasil**: catatan hilang dari daftar.

### 2.5 Kunci (lock) dan buka kunci (unlock) kandidat

- [ ] Kunci satu kandidat, isi alasan kunci. **Hasil**: status kandidat berubah jadi terkunci oleh Birdep ini; kandidat pindah ke tab "Terkunci Birdep Ini".
- [ ] Coba kunci kandidat yang SAMA dari sisi lain (atau minta rekan tester mencoba lewat akun PJ Birdep lain). **Hasil**: ditolak - kandidat sudah dikunci pihak lain.
- [ ] Coba kunci TANPA mengisi alasan. **Hasil**: ditolak, alasan wajib diisi.
- [ ] Buka kunci (unlock) kandidat yang tadi dikunci, isi alasan. **Hasil**: kandidat tidak lagi terkunci, kembali ke daftar utama.

### 2.6 Batas akses lintas-Birdep

- [ ] Minta tim teknis memberi tahu ID/link kandidat yang HANYA memilih Birdep lain (bukan Birdep akun PJ ini), lalu coba buka langsung lewat link tersebut. **Hasil**: ditolak/tidak ditemukan (kandidat tidak terlihat sama sekali, bukan pesan "akses ditolak" yang menyebutkan kandidat itu ada).

### 2.7 Logout

- [ ] Klik "Logout sesi ini". **Hasil**: keluar dari akun, kembali ke halaman login.

---

## Bagian 3 - Peserta (alur pendaftaran publik)

### 3.1 Membuka form pendaftaran

- [ ] Buka halaman pendaftaran publik dari halaman utama. **Hasil**: form pendaftaran terbuka, ada indikator periode pendaftaran yang sedang aktif (nama periode, batas waktu).
- [ ] Kalau ada draft tersimpan dari sesi sebelumnya, coba refresh halaman. **Hasil**: data yang sudah diisi sebelumnya (kecuali persetujuan/consent) muncul kembali otomatis; ada pemberitahuan "draft dipulihkan".

### 3.2 Mengisi identitas

- [ ] Isi nama lengkap, NIM, kelas, program studi, nomor WhatsApp, email aktif, dan domisili dengan data contoh. **Hasil**: form menerima input, tidak ada error selama data valid; field IPK sudah tidak ada di form (dihapus - peserta Angkatan 63 belum punya IPK, lihat ADR-040).
- [ ] Coba lanjut TANPA mengisi salah satu field wajib (misal nama dikosongkan). **Hasil**: muncul ringkasan error yang jelas menunjukkan field mana yang belum benar, dan fokus otomatis pindah ke ringkasan tersebut (bisa dites pakai tombol Tab/Enter di keyboard saja, tanpa mouse).

### 3.3 Memilih Birdep dan motivasi

- [ ] Pilih dua Birdep berbeda untuk Pilihan 1 dan Pilihan 2. **Hasil**: tidak bisa memilih Birdep yang sama untuk kedua pilihan.
- [ ] Isi motivasi untuk masing-masing pilihan dengan teks yang cukup panjang (ratusan kata) sesuai minimal yang diminta form. **Hasil**: form menerima jika sudah memenuhi jumlah kata minimal; menolak dengan pesan jelas jika terlalu pendek.
- [ ] Jika salah satu pilihan adalah Biro Media Branding: lanjutkan ke bagian portofolio. **Hasil**: form mewajibkan minimal satu portofolio (file atau tautan) sebelum bisa lanjut.

### 3.4 Upload dokumen

- [ ] Upload CV (format PDF) dan foto (format gambar) sesuai contoh ukuran yang diizinkan. **Hasil**: setelah upload, muncul konfirmasi "tervalidasi", bukan hanya "terupload".
- [ ] Coba upload file dengan tipe yang salah (misal file `.exe` diberi nama `.pdf`) kalau memungkinkan. **Hasil**: ditolak dengan pesan error, bukan diterima begitu saja.
- [ ] Coba upload file yang melebihi batas ukuran yang diizinkan. **Hasil**: ditolak dengan pesan jelas soal ukuran file.

### 3.5 Esai dan persetujuan

- [ ] Isi tiga esai (pengalaman organisasi, kontribusi, keseimbangan akademik) sesuai batas kata yang diminta. **Hasil**: form menerima jika sesuai batas, menolak dengan pesan jelas jika di luar batas.
- [ ] Centang persetujuan (consent) yang diminta sebelum submit. **Hasil**: tombol submit baru bisa diklik setelah persetujuan dicentang.

### 3.6 Submit dan bukti pendaftaran

- [ ] Klik submit/kirim pendaftaran. **Hasil**: diarahkan ke halaman sukses dengan nomor registrasi yang jelas dan bisa dicatat/screenshot.
- [ ] Cek email yang didaftarkan (kalau environment uji memang mengirim email sungguhan). **Hasil**: email konfirmasi pendaftaran diterima, berisi nomor registrasi yang sama.
- [ ] Coba isi ulang dan submit form dengan NIM ATAU email yang **SAMA PERSIS** seperti pendaftaran sebelumnya. **Hasil**: ditolak dengan pesan bahwa NIM/email sudah terdaftar - tidak membuat pendaftaran ganda.

### 3.7 Kondisi periode ditutup (kalau ada environment uji yang bisa disimulasikan tim teknis)

- [ ] Minta tim teknis menutup sementara periode pendaftaran uji, lalu coba submit form yang sudah terisi lengkap. **Hasil**: submit ditolak dengan pesan jelas bahwa pendaftaran sudah ditutup; data yang sudah diisi tidak hilang percuma (tidak ada file/pendaftaran "nyangkut" tanpa kejelasan status).

---

## Ringkasan hasil

| Bagian | Jumlah langkah | Lolos | Gagal | Dilewati (tidak sempat diuji) |
|---|---|---|---|---|
| 1. Super Admin | | | | |
| 2. PJ Birdep | | | | |
| 3. Peserta | | | | |

## Catatan kegagalan (isi jika ada langkah GAGAL)

| Bagian & langkah | Yang diharapkan | Yang benar-benar terjadi | Screenshot/bukti |
|---|---|---|---|
| | | | |

## Penguji

- Nama: ______________________
- Role yang diuji: ______________________
- Tanggal: ______________________
- Environment yang diuji (URL): ______________________ (konfirmasi ini BUKAN alamat production kecuali diberi tahu eksplisit)
