# Arsip bulanan otomatis — UJI COBA

Menggantikan rencana pembersihan data launch. **Histori dipertahankan**, aktivitas bulan yang sudah selesai dipindah dari sheet aktif, master/login/saldo stok diteruskan. Ada menu **Arsip Bulanan** untuk Admin dan Tamu. Tamu hanya membaca; salinan spreadsheet lengkap dan log/internal Skor hanya tersedia untuk Admin.

## Pasang dua file baru dan ganti sepuluh file

Buka tautan GitHub, klik **Copy raw file**, lalu tempel **seluruh isi** ke file Apps Script UJI COBA yang sesuai. File Script baru dibuat lewat **+ → Script**; file HTML baru lewat **+ → HTML**. Jangan membuat duplikat file lama.

| File lengkap | Tindakan di Apps Script |
|---|---|
| [monthly-archives.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/monthly-archives.gs) | **Script baru** `monthly-archives` |
| [archive-client.html](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/archive-client.html) | **HTML baru** `archive-client` |
| [sheet-updates.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/sheet-updates.gs) | Ganti seluruh Script `sheet-updates` |
| [code.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/code.gs) | Ganti seluruh Script `Kode.gs` / `code.gs` yang sudah ada; **jangan keduanya** |
| [auth.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/auth.gs) | Ganti seluruh Script `auth` |
| [transactions.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/transactions.gs) | Ganti seluruh Script `transactions` |
| [transaction-edits.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/transaction-edits.gs) | Ganti seluruh Script `transaction-edits` |
| [stock-pickups.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/stock-pickups.gs) | Ganti seluruh Script `stock-pickups` |
| [score.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/score.gs) | Ganti seluruh Script `score` |
| [incentive-sheets.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/incentive-sheets.gs) | Ganti seluruh Script `incentive-sheets` |
| [index.html](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/index.html) | Ganti seluruh HTML `index` |
| [js.html](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/js.html) | Ganti seluruh HTML `js` |

Paket ini melanjutkan fitur Pengambilan/Setoran dan Insentif yang sudah dibuat. Bila paket sebelumnya belum dipasang, lengkapi juga file dependensinya pada [panduan pengambilan](PANDUAN-PENGAMBILAN-BARANG.md) dan [panduan insentif](PANDUAN-SINKRON-INSENTIF.md). CSS, login, rumus tarif Insentif, manifest dan `setup.gs` tidak perlu diganti untuk revisi ini.

## Aktifkan sekali

1. Setelah **semua 12 file** dipasang, Simpan. Hentikan input dan edit manual selama pemasangan/pengarsipan pertama; tutup tab app lama.
2. Di dropdown fungsi Apps Script pilih **setupArsipBulanan**, klik **Jalankan** sebagai Gmail Admin. Izinkan akses Google bila diminta.
3. Fungsi ini memasang tab/trigger pembaruan bila belum ada, menjalankan Perbarui Seluruh Sheet, memasang satu trigger waktu, membuat salinan arsip lengkap, lalu memindahkan aktivitas bulan-bulan yang sudah selesai. Pada pemasangan November, data Oktober yang **masih ada di spreadsheet aktif** langsung diarsipkan. Baris November dan agenda masa depan tetap ada.
4. Buka tab **PEMBARUAN_SHEET**. Tunggu **B8: Berhasil**, periksa Rincian **B11** dan tautan salinan lengkap **B10**. Jika tidak ada aktivitas bulan lama, proses tidak perlu membuat arsip kosong.
5. Untuk `/dev`, refresh webapp. Untuk `/exec`, **Terapkan → Kelola deployment → Edit (pensil) → Versi baru → Terapkan** pada deployment UJI COBA yang sama. Buka ulang webapp.
6. Buka sidebar **Arsip Bulanan**, pilih bulan dan jenis data. Penjualan/absensi/input AA/branding, pengambilan, mutasi, setoran, agenda, meeting dan hasil Insentif tetap tersimpan. Tabel dipaginasi 100 baris. Foto bukti pengambilan/setoran tetap bisa dibuka, termasuk oleh Tamu melalui pemeriksaan ID catatan yang tersimpan.

Setelah itu, **Perbarui Seluruh Sheet (A3)** tetap melengkapi struktur fitur, menghitung ulang laporan aktif dan memastikan satu trigger arsip terpasang. Pemanggilan ulang tidak menggandakan trigger/arsip. Fungsi lama `siapkanAwalNovember` kini mengarah ke pemasangan arsip aman, **bukan mengosongkan histori**; centang reset lama A15 dinonaktifkan.

Jika reset versi sebelumnya sudah sempat dijalankan sebelum revisi ini, data yang sudah dibersihkan tidak otomatis muncul kembali hanya karena memasang arsip. Simpan tautan cadangan pada B10/A18/penanda launch untuk pemulihan histori; jangan memulihkan saldo stok dari cadangan sambil mempertahankan transaksi baru karena dapat menggandakan perubahan saldo. Arsip awal menggunakan data yang masih tersedia saat pemasangan.

## Jadwal akhir bulan pukul 23.59 WIB

- Batas periode adalah hari terakhir bulan **23:59:59 WIB**, termasuk seluruh transaksi pada menit 23.59.
- Finalisasi/pemindahan dilakukan pada pemeriksaan pertama **setelah masuk tanggal 1**. Trigger memeriksa setiap menit, tetapi Google Apps Script tidak menjamin eksekusi tepat detik tertentu. Ini sengaja tidak menghapus hari terakhir atau transaksi di menit terakhir.
- Contoh: Oktober ditutup sampai **31 Oktober 2026 23:59:59 WIB**; setelah masuk November aktivitas Oktober dipindahkan ke arsip, saldo stok menjadi saldo awal November tanpa dihitung ulang.
- Jika jadwal terlambat, pemeriksaan berikutnya menangani bulan yang tertinggal. Proses yang melewati tengah malam tidak menandai bulan berikutnya telah diperiksa secara keliru.
- Jika proses gagal, pengulangan otomatis bulan itu dijeda agar tidak membuat salinan Drive setiap menit. Baca status B8/B11. Setelah penyebab diperbaiki dan kiriman tertunda dipastikan, klik A3 atau jalankan `setupArsipBulanan` lagi untuk melanjutkan. Jangan menghapus jurnal PENDING.

## Data aktif, histori dan perhitungan

**Tidak dipindahkan/dikosongkan:** PRODUCTS, PRICE_MASTER, SALES, DISTRIBUTORS, ACCESS_USERS/Admin/Tamu, SETTINGS, kalender libur, INVENTORY, SALES_STOCK, KCH_NEWS dan FILES. Seluruh sheet ini tetap termasuk dalam **salinan spreadsheet lengkap**. Saldo gudang/pegangan beserta distributor asal diteruskan; tidak ada penjualan/pengambilan tambahan atau perubahan omzet akibat pengarsipan.

**Aktivitas yang dipindahkan menurut tanggalnya:** SALES_TRANSACTIONS, ATTENDANCE, VISIT_PHOTOS, INVENTORY_MOVEMENTS, SALES_STOCK_MOVEMENTS, STOCK_PICKUPS, SALES_CASH_DEPOSITS, SKOR_EVENTS, TODAY_PLAN, WEEKLY_MEETINGS, MONTHLY_TEAM_REPORT, ACTIVITY_LOGS, serta hasil INSENTIF periode selesai. Baris bulan berjalan/masa depan dipertahankan. Sheet/kolom tambahan yang tidak dikenali tidak dihapus; tetap tersimpan dalam salinan lengkap. Legacy SALES_TRANSACTION_ITEMS yang sudah tidak dipakai tidak diubah.

- Pencapaian **bulanan** baru mulai nol jika belum ada input. Target, kalender, stok dan data master tetap terisi. Riwayat default menampilkan bulan berjalan; memilih tanggal lama tetap dapat menampilkan faktur arsip dan detail sumber stoknya.
- Menu Skor/Insentif bulan lama serta laporan tim tetap membaca sumber historis yang diarsipkan. **Insentif triwulan tetap kumulatif**, tidak direset tiap bulan. Laporan native harian/bulanan diperbarui untuk bulan berjalan; native triwulan untuk triwulan berjalan, dengan data bulan-bulan lama tetap dihitung.
- Hasil Insentif bulan selesai dihitung ulang memakai kalkulator aplikasi lalu disimpan sebagai hasil final di arsip, bukan sekadar menyalin angka laporan aktif yang mungkin belum diperbarui.
- Periode lama menjadi **hanya baca**. Input/penjualan/edit baru tidak boleh memakai tanggal bulan yang sudah ditutup. Penanda arsip, receipt permintaan dan histori edit teknis tetap ada untuk mencegah pemotongan stok berulang oleh kiriman lama.
- File foto Drive tetap disimpan dengan izin sebelumnya; salinan spreadsheet berisi catatan/tautannya, bukan salinan berkas foto terpisah.

## Ketahanan data dan batas pengujian

Ada dua sheet internal tersembunyi: `_KCH_MONTHLY_ARCHIVES` untuk daftar periode/tautan salinan dan `_KCH_ARCHIVE_ROWS` untuk data historis yang dibaca aplikasi. Jangan menghapus atau mengedit keduanya secara manual. Tamu tidak dapat meminta tabel akun, jurnal internal, log aktivitas atau payload AA/branding mentah dari menu arsip; hasil Skor/Insentif tetap dapat dilihat melalui fitur yang ada.

Skrip memeriksa tanggal/header/ukuran sebelum pemindahan dan membuat salinan lengkap dahulu. Isi baris yang sudah diarsipkan dikosongkan tanpa menghapus baris fisik. Jumlah baris sheet, posisi/formula baris bulan baru atau masa depan, kolom tambahan dan format tetap. Cara ini juga mendukung sheet ringkas dengan header beku. Penambahan arsip, penghapusan baris aktif, daftar periode, hasil laporan aktif dan receipt terminal merupakan **satu batch atomik**. Jika respons hilang, skrip memeriksa receipt tanpa mengulang pemindahan. Hasil belum pasti menahan input yang dapat mengubah aktivitas terkait, termasuk transaksi dan AA, sampai diperiksa.

Batas satu proses: maksimal 15.000 baris arsip dan perkiraan payload 7,5 juta karakter; satu sel JSON dibatasi 45.000 karakter. Melebihi batas menghentikan proses sebelum pemindahan, untuk ditangani lewat migrasi bertahap. Script lock tidak mengunci editor manual spreadsheet: hentikan edit manual selama proses.

Pengujian lokal mencakup cutoff menit terakhir, Februari/tahun kabisat/pergantian tahun, proses menyeberang tengah malam, data baru/saldo tetap, histori dan triwulan, finalisasi Insentif, replay, penolakan/putus koneksi, foto arsip, Tamu dan tampilan desktop/HP. Layanan Google ditiru untuk pengujian; pemasangan trigger, izin Drive, salinan nyata serta deployment Google pengguna perlu diperiksa setelah menyalin kode.


## Jika sebelumnya muncul HTTP 400 saat mengarsipkan

Ganti seluruh isi **dua Script** dengan versi terbaru: [monthly-archives.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/monthly-archives.gs) dan [transactions.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/transactions.gs). Simpan, lalu jalankan **setupArsipBulanan** lagi sebagai Gmail Admin. Tidak perlu mengganti HTML untuk perbaikan ini. Proses native Sheet memakai kode yang disimpan, sehingga tidak perlu deployment baru hanya untuk menjalankan ulang arsip.

Revisi mengosongkan nilai baris lama setelah menyimpannya di arsip, tanpa menghapus baris fisik—menghindari penolakan pada grid ringkas/frozen. Jika masih gagal, B11 sekarang juga memuat **Rincian Google** (maksimal 600 karakter pesan penyebab, bukan dump request/token). Salin pesan tersebut untuk diagnosis; jangan menghapus jurnal PENDING atau data arsip secara manual. Penolakan HTTP yang pasti dibedakan dari hasil koneksi belum pasti.

## Privasi Admin dan Tamu

Paket penguatan privasi awal mengganti **3 file**: [auth.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/auth.gs), [monthly-archives.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/monthly-archives.gs), dan [archive-client.html](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/archive-client.html). Salin isi lengkap, Simpan, refresh `/dev`; untuk `/exec`, terapkan Versi baru pada deployment yang sama. Tidak perlu Perbarui Sheet atau menjalankan arsip lagi hanya untuk revisi privasi ini.

- Tamu tidak menerima properti URL salinan/snapshot sama sekali dari server. Link “Buka salinan spreadsheet lengkap” hanya dibuat bila peran UI **ADMIN** dan izin server **canOpenSnapshot** bernilai true. Mengubah tombol/peran tampilan dari browser tidak memberi URL dari server.
- Tamu tidak dapat meminta tabel akun/password, kontrol pembaruan, jurnal transaksi/edit, log aktivitas, tabel internal arsip atau payload AA/branding mentah. Pengelolaan akun, seluruh input/edit dan fungsi native Admin tetap ditolak server.
- Respons RPC Tamu disaring rekursif agar hash/password, token/secret, URL backup/snapshot, metadata pelaku pencatatan, revisi edit dan array sel mentah tidak ikut terkirim. Tabel arsip juga menyaring kolom privat sebelum dikirim. Log aktivitas dashboard tidak dikirim ke Tamu.
- Data laporan bisnis, nominal/kuantitas, saldo, pencapaian, Skor, Insentif dan foto bukti yang boleh dibaca tetap tersedia. Data sumber tidak ditulis ulang atau dihapus oleh penyaringan ini; Admin tetap memperoleh datanya.

Pengguna sudah mengonfirmasi **kontak sales dan dokumen internal khusus Admin**. Paket privasi lengkap sekarang **5 file**:

1. [auth.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/auth.gs)
2. [monthly-archives.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/monthly-archives.gs)
3. [archive-client.html](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/archive-client.html)
4. [auth-client.html](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/auth-client.html)
5. [js.html](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/js.html)

Ganti seluruh isi lewat Copy raw file, Simpan, refresh `/dev`; untuk `/exec`, terapkan Versi baru. Jika 3 file privasi awal sudah dipasang, perlu mengganti **auth.gs sekali lagi**, ditambah **auth-client.html dan js.html**. Tidak perlu Perbarui Sheet atau mengarsipkan ulang.

Field telepon/email sales dan alias kontak umum dihapus dari respons RPC Tamu, termasuk metadata profil, data stok mentah dan kolom tambahan arsip. Tamu tidak menerima daftar FILES maupun URL dokumen internal. Tombol WhatsApp/email tidak dibuat untuk Tamu; menu/view Arsip Dokumen disembunyikan dan navigasi langsung diblokir. Merender dokumen langsung dari browser juga membersihkan daftar, sehingga perubahan tampilan tidak memberi akses ke data server.

Admin tetap mendapat kontak, tombol dan dokumen seperti sebelumnya. Tamu tetap melihat nama/tim/profil kinerja serta laporan/arsip bisnis dan foto bukti yang diizinkan. Data asli tidak dihapus. Pembatasan ini berlaku pada akses webapp dan bukan perubahan izin berbagi file Google Drive secara langsung.
