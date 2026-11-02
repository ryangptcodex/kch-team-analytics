> **Digantikan untuk pergantian bulan:** gunakan [PANDUAN-ARSIP-BULANAN.md](PANDUAN-ARSIP-BULANAN.md). Histori kini diarsipkan; fungsi reset launch lama tidak lagi menghapus data pada kode terbaru.

# Persiapan launch November 2026 — UJI COBA

Ini pembersihan **data percobaan sekali sebelum launch**, sesuai persetujuan pengguna. Bukan reset rutin setiap awal bulan. Setelah selesai, data November yang baru dimasukkan tetap dipertahankan pada pembaruan berikutnya. Untuk pergantian bulan operasional nanti, gunakan filter bulan; jangan menghapus histori penjualan karena laporan triwulan membutuhkannya.

## Pasang dan jalankan

1. Buka [sheet-updates.gs lengkap](https://github.com/ryangptcodex/kch-team-analytics/blob/production/sheet-updates.gs). Klik **Copy raw file** (ikon salin di kanan atas kode; atau Raw lalu Ctrl+A, Ctrl+C).
2. Buka Apps Script **UJI COBA**, pilih Script **sheet-updates.gs**, ganti seluruh isinya dengan kode tersebut, lalu Simpan. Jangan membuat file dengan nama sama kedua kali. Revisi ini hanya mengganti satu file aplikasi.
3. Pastikan paket fitur sebelumnya sudah dipasang, termasuk `stock-pickups.gs` versi setoran, `incentive-sheets.gs`, `incentives.gs`, `canvasser-incentives.gs` dan paket [Pengambilan Barang](PANDUAN-PENGAMBILAN-BARANG.md). Updater membaca modul yang dipasang di Apps Script; tidak mengunduh kode otomatis. Modul wajib yang belum dipasang akan menghentikan pembaruan dengan pesan pemasangan.
4. Tutup tab webapp lain dan hentikan input/manual edit spreadsheet selama persiapan. Di dropdown fungsi editor Apps Script pilih **siapkanAwalNovember**, klik **Jalankan** sebagai Gmail admin. Ini memasang tab/trigger jika perlu dan menyiapkan mode pembersihan; belum menghapus aktivitas.
5. Buka spreadsheet → tab paling kanan **PEMBARUAN_SHEET**. Baris 14–18 menjelaskan mode persiapan. **A15 dicentang**. Klik **A3 — PERBARUI SELURUH SHEET** sekali.
6. Tunggu **B8: Berhasil**. Cadangan lengkap sebelum pembersihan berada di **B10**, dan tautannya tetap disimpan di **A18** serta jurnal internal. Periksa cadangannya bisa dibuka. Data aktivitas aktif kini kosong, sheet/kolom fitur lengkap, saldo stok tetap. Header dan format dipertahankan. Muat ulang webapp sebelum input November.

Untuk tombol spreadsheet, kode yang sudah disimpan langsung digunakan; tidak perlu deployment webapp baru untuk revisi satu file ini. Jika paket fitur webapp sebelumnya belum diterapkan, ikuti juga langkah deployment pada panduan paket tersebut.

Menyalin kode saja / menjalankan `setupKchSheetUpdates` / mengklik A3 tanpa menyiapkan `siapkanAwalNovember` tetap memperbarui biasa dan **tidak mengosongkan data**. Mode persiapan yang belum dijalankan dapat dibatalkan dengan melepas centang A15 sebelum A3.

## Data yang dipertahankan

- PRODUCTS, PRICE_MASTER, SALES, DISTRIBUTORS, SETTINGS dan HOLIDAYS (beserta alias kalender lama).
- Akun Admin dan Tamu beserta kredensialnya. Pembersihan akun sales lama yang sudah menjadi perilaku updater tetap berlaku; profil master SALES dipertahankan.
- **INVENTORY dan SALES_STOCK**: saldo gudang dan pegangan beserta asal distributor tetap persis; menjadi saldo awal operasional. Tidak membalikkan penjualan/pengambilan percobaan untuk menghitung saldo baru.
- KCH_NEWS dan FILES, karena merupakan konten berita/dokumen yang masih dapat digunakan.
- Jurnal teknis `_KCH_TX_REQUESTS`, `_KCH_TX_EDITS` dan penanda `_KCH_LAUNCH_STATE`. Ini tidak menambah omzet/skor/insentif. Receipt lama tetap ada agar kiriman uji lama tidak terpotong stok lagi saat dicoba ulang.
- File foto di Google Drive tidak dihapus. Cadangan menyimpan catatan/tautan yang lama, bukan salinan berkas foto terpisah. Izin berkas tetap seperti sebelumnya.

## Data uji yang dikosongkan

Isi di bawah header pada SALES_TRANSACTIONS, SALES_TRANSACTION_ITEMS (jika masih ada), ATTENDANCE, INVENTORY_MOVEMENTS, SALES_STOCK_MOVEMENTS, STOCK_PICKUPS, SALES_CASH_DEPOSITS, SKOR_EVENTS (AA/branding), VISIT_PHOTOS, TODAY_PLAN, WEEKLY_MEETINGS, MONTHLY_TEAM_REPORT, ACTIVITY_LOGS dan tiga hasil INSENTIF_HARIAN/BULANAN/TRIWULAN. Catatan manual di kolom tambahan **sheet aktivitas ini** ikut dibersihkan dan tersedia di cadangan lengkap.

Hasil Insentif dikosongkan pada proses persiapan agar tidak membawa angka uji. Klik A3 berikutnya menghitung ulang hasil dari sumber yang baru, sehingga baris kalender/target bisa tampil dengan pencapaian nol. Target master tidak direset. Skor webapp membaca transaksi/AA/branding baru, bukan hasil uji di cadangan. Histori Oktober yang dibersihkan hanya ada di cadangan dan tidak ikut laporan triwulan aktif—itulah sebabnya mode ini khusus data percobaan sebelum launch.

## Pencegahan pembersihan berulang dan hasil belum pasti

Pembersihan, penanda **COMPLETED**, dan receipt terminal disimpan dalam satu batch atomik. Setelah selesai, memanggil fungsi persiapan lagi atau mencentang A15 lagi tidak dapat membersihkan kedua kali. Jangan menghapus sheet penanda/jurnal internal.

Cadangan dibuat sebelum reservasi dan batch pembersihan. Jika cadangan atau pemeriksaan struktur gagal, data aktivitas tidak dibersihkan. Permintaan pembersihan memakai jurnal PENDING yang sama dengan transaksi sehingga penyimpanan transaksi/pengambilan/setoran baru dan pembaruan berikutnya ditahan bila hasil pembersihan belum pasti. Jika respons hilang setelah commit, skrip membaca receipt terminal, bukan mengulang pembersihan. Penolakan HTTP yang pasti menandai reservasi gagal dan dapat dicoba ulang dengan aman.

Jika Status menunjukkan gagal/hasil belum pasti, **tetap hentikan seluruh input termasuk AA, absensi dan edit manual**, baca Rincian dan jalankan pemeriksaan `checkKchTransactionSetup`. Jangan menghapus baris PENDING atau mengulang reset memakai skrip lain; bawa pesan/kode kiriman untuk diperiksa. Script lock tidak mengunci editor manual Google Sheets.

Pengujian lokal memakai layanan Google tiruan. Pemasangan, izin trigger, cadangan Drive nyata dan hasil di spreadsheet pengguna masih perlu diperiksa setelah penyalinan.
