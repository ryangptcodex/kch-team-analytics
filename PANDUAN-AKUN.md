> **Pembaruan 29 Oktober 2026:** login Google Tamu pada panduan ini digantikan login username/password. Gunakan [PANDUAN-LOGIN-TAMU.md](PANDUAN-LOGIN-TAMU.md) untuk pemasangan terbaru. Google hanya untuk Admin.

# Dua akun: Admin dan Tamu

Revisi cabang **production**, 28 Oktober 2026. Nama akun pembaca adalah **Tamu**, bukan akun bos.

## Akses yang berlaku

| Akun Google | Peran webapp | Hak akses |
| --- | --- | --- |
| `mhmdryyan7@gmail.com` | ADMIN (label header tetap TEAM LEADER) | Seluruh fitur admin yang sudah ada: input/edit transaksi, absensi/foto, AA, rencana, meeting, berita, profil, dan pengelolaan status Tamu. |
| `juniortlkchlse@gmail.com` | GUEST (tampil **Tamu**) | Melihat progres seluruh tim: dashboard, laporan, riwayat/detail/ekspor transaksi, absensi/foto, Skor/AA, rencana, meeting, berita, master stok/harga, profil sales dan dokumen. Tidak boleh mengubah data. |

**Akun Google lain ditolak**, termasuk akun sales lama atau email lain yang baris ACCESS_USERS-nya diberi role ADMIN. Baris akun lama, master SALES, transaksi, stok, foto dan histori tidak dihapus. Jumlah akun login tidak membatasi jumlah profil sales yang dikelola admin.

Peran Tamu berasal dari email Google terverifikasi yang ditentukan di konfigurasi. Mengubah role baris Tamu menjadi ADMIN atau mengirim payload role ADMIN tidak memberi akses tulis. Tamu juga tidak dapat mengedit nama profil, mengelola akun, mengisi AA, mengunggah foto, membuat/mengedit transaksi, atau menulis aktivitas client. Pembatasan diberlakukan server dengan daftar operasi baca yang eksplisit, selain menyembunyikan tombol tulis.

Tamu dapat memilih semua sales/periode dan mengunduh ekspor data. Ekspor ini merupakan pembacaan data, bukan penulisan ke spreadsheet.

## Salin sembilan file lengkap ke Apps Script UJI COBA

Semua adalah **pengganti file yang sudah ada**, tidak ada file aplikasi baru. Buka tautan → **Raw / Copy raw file** → salin **seluruh isi** ke file dengan nama yang sesuai di Apps Script.

| File lengkap | File di editor |
| --- | --- |
| [firebase-config.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/production/firebase-config.gs) | Script `firebase-config`; berisi dua Gmail yang ditentukan. Konfigurasi Firebase dan ID spreadsheet tetap untuk UJI COBA. |
| [auth.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/production/auth.gs) | Script `auth`; verifikasi akun, peran, daftar operasi baca dan pengelolaan status Tamu. |
| [code.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/production/code.gs) | Script `code` / `Kode` yang sudah ada; jangan membuat dua salinan kode yang sama. Jalur laporan/rencana Tamu tidak menulis sheet. |
| [score.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/production/score.gs) | Script `score`; Tamu dapat memilih seluruh Motoris/MMTW untuk membaca Skor. |
| [auth-client.html](https://github.com/ryangptcodex/kch-team-analytics/blob/production/auth-client.html) | HTML `auth-client`; label Tamu, menu sesuai peran, reset sesi dan pengelolaan dua akun. |
| [auth-ui.html](https://github.com/ryangptcodex/kch-team-analytics/blob/production/auth-ui.html) | HTML `auth-ui`; keterangan login dan panel Kelola akun. Warna, ilustrasi dan copyright login tetap. |
| [index.html](https://github.com/ryangptcodex/kch-team-analytics/blob/production/index.html) | HTML `index`; menandai kontrol tulis agar disembunyikan untuk Tamu. |
| [js.html](https://github.com/ryangptcodex/kch-team-analytics/blob/production/js.html) | HTML `js`; pencegahan membuka form tulis dan pemulihan transaksi lama pada sesi Tamu. |
| [css.html](https://github.com/ryangptcodex/kch-team-analytics/blob/production/css.html) | HTML `css`; menyembunyikan kontrol tulis hanya ketika peran Tamu aktif. Layout responsif dan loading abu-abu tetap. |

Pertahankan `transactions.gs`, `transaction-edits.gs`, `score-client.html`, `setup.gs`, dan `appsscript.json` versi terbaru yang sudah dipasang. Jangan menyalin tests/tools atau panduan ke editor Apps Script.

1. Buka proyek Apps Script milik spreadsheet **KCH Analytics - UJI COBA**.
2. Ganti sembilan file di atas bersama-sama, lalu **Simpan**.
3. Untuk `/dev`: muat ulang URL aplikasi.
4. Untuk `/exec`: **Terapkan → Kelola deployment → pilih deployment UJI COBA yang sudah digunakan → ikon pensil → Versi baru → Terapkan**. Muat ulang URL `/exec` yang sama.
5. Keluar lalu masuk kembali agar menu akun dibangun ulang sesuai peran baru. Untuk uji Tamu gunakan `/exec` melalui profil Chrome terpisah; jangan memberikan akses editor spreadsheet/Apps Script kepada akun Tamu hanya agar bisa membuka `/dev`.

Tidak perlu menekan **Perbarui Sheet**, menjalankan repair, mengaktifkan API baru, mengganti konfigurasi Firebase, atau menghapus akun/data sales. Hak baru berlaku pada deployment yang telah diperbarui. Deployment versi lama yang masih digunakan tetap memakai kode lama; perbarui deployment yang dibagikan dan hentikan URL deployment lama yang tidak lagi dipakai melalui Kelola deployment.

## Memakai akun Tamu

Masuk melalui tombol Google dengan Gmail `juniortlkchlse@gmail.com`. Tidak perlu membuat profil SALES, menghubungkan sales_id, atau menambahkan baris ACCESS_USERS sebelum login pertama. Akun Tamu tampil sebagai **Tamu** dan tidak memiliki menu Input Penjualan, Edit profil, Kelola akun, input absensi/foto atau AA.

Login/pembacaan Tamu tidak membuat atau mengubah baris sheet. Jika email Tamu sudah ada di ACCESS_USERS, status ACTIVE dan kecocokan UID yang sudah terikat tetap diperiksa. Baris lama role SALES/ADMIN tidak menentukan izin Tamu; izin selalu hanya baca. Jika baris Tamu belum ada, aksesnya aktif berdasarkan konfigurasi email yang sudah disetujui pengguna.

Admin dapat membuka **menu akun → Kelola akun**, lalu memilih status Tamu **Aktif / Nonaktif** dan menekan **Simpan akses**. Penyimpanan oleh admin membuat/memperbarui hanya baris Tamu dengan role GUEST dan sales_id kosong; kolom tambahan serta seluruh baris akun lama dipertahankan. Status nonaktif berlaku pada permintaan Tamu berikutnya. Panel tidak dapat menambah akun ketiga atau mengganti Gmail admin/Tamu.

Laporan bulanan untuk Tamu dihitung langsung untuk ditampilkan, tanpa memperbarui sheet `MONTHLY_TEAM_REPORT`. Membuka rencana kunjungan sebagai Tamu tidak otomatis membuat sheet TODAY_PLAN jika belum tersedia. Admin tetap menggunakan perilaku lama untuk fitur-fiturnya.

## Uji penerimaan di UJI COBA

- Admin: masuk sebagai `mhmdryyan7@gmail.com`; seluruh sales tersedia; Input Penjualan, edit faktur, input absensi, AA dan menu Kelola akun tetap tersedia.
- Tamu: masuk di profil Chrome lain sebagai `juniortlkchlse@gmail.com`; label **Tamu**, dapat memilih seluruh sales dan bulan Skor/laporan, melihat seluruh riwayat/detail transaksi, tetapi tidak melihat tombol tulis.
- Periksa akun Tamu pada dashboard, riwayat, laporan bulanan, Skor, absensi, foto kunjungan, rencana dan meeting. Berpindah halaman tidak boleh memunculkan form admin atau menulis data baru ke sheet.
- Admin dapat menonaktifkan Tamu melalui Kelola akun. Permintaan baru pada tab Tamu harus ditolak. Aktifkan kembali lalu login ulang.
- Coba login dengan Gmail sales lama: harus ditolak meskipun barisnya masih ACTIVE. Profil SALES dan riwayatnya tetap dapat dibaca/dikelola admin.
- Keluar dari Tamu lalu masuk admin di tab yang sama: tombol admin kembali; lakukan arah sebaliknya dan pastikan kontrol tulis kembali tersembunyi.

## Validasi pengembangan

`node --test tests/*.test.cjs` → **170 lulus, 0 gagal, 0 dilewati**. Tes akun lama yang tidak lagi berlaku diganti dengan kontrak dua akun; tes transaksi/edit/stok yang relevan tetap dijalankan. Pemeriksaan mencakup email allowlist, Firebase/token, role Tamu tidak bisa ditingkatkan melalui sheet/payload, penolakan seluruh endpoint tulis, pembacaan lintas sales, tidak ada perubahan sheet saat Tamu membaca termasuk laporan/rencana, status/UID, profil admin dan pergantian sesi.

`node tools/guest-ui-check.cjs` dengan Playwright/Chromium: kode aplikasi asli dan resolver/gateway Tamu asli memakai layanan Firebase/Sheets tiruan; kontrol tulis tersembunyi, seluruh tim tersedia, tidak ada mutasi sheet saat pembacaan, dan transisi Tamu → Admin → Tamu lulus. Ini belum membuktikan pemasangan atau login Google nyata pada deployment pengguna. Agen belum melakukan perubahan pada Google Sheets/Apps Script nyata.
