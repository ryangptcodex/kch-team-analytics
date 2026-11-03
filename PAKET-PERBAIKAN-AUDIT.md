# Paket perbaikan audit Production — 3 November 2026

Release: **KCH-AUDIT-2026-11-03**. Paket berisi file lengkap, bukan potongan kode. Source dan pengujian lokal telah diperbarui; file di Google Apps Script tidak berubah otomatis melalui GitHub.

## Pasang sekali pada proyek Production yang sudah dipakai

1. Unduh dan ekstrak `KCH-Production-Audit-2026-11-03.zip`. Simpan salinan proyek Apps Script dan spreadsheet Production sebelum pemasangan. Jangan mengisi transaksi percobaan ke data usaha.
2. Buka proyek **KCH Team Analytics Production** yang terikat spreadsheet Production. Salin **seluruh isi setiap file `.gs` dan `.html` dalam ZIP** ke file bernama sama pada editor. Ganti isi file lama seluruhnya; jangan menambahkan kode baru di bawah kode lama. Lima file baru tercantum di bawah. Tidak perlu membuat proyek atau deployment lain.
3. Periksa `appsscript.json`: zona `Asia/Jakarta`, runtime V8 dan layanan lanjutan Sheets v4. Jika file manifest disembunyikan, tampilkan lewat Setelan proyek. Pertahankan konfigurasi akun/Firebase Production yang sudah digunakan; paket memakai binding Production yang sama. Simpan semua file.
4. Jalankan `setupKchSheetUpdates` dari editor dengan akun pemilik/deployer Production bila menu pembaruan belum siap, lalu setujui izin Google yang diminta. Buka spreadsheet → **PEMBARUAN_SHEET → centang A3 PERBARUI SELURUH SHEET**. Tunggu status sukses dan baca rincian. Updater menambah struktur, snapshot periode berjalan, laporan turunan dan trigger pemeliharaan; data sumber dipertahankan. Jika muncul error/pending, periksa hasilnya dahulu; jangan reset atau menghapus receipt.
5. Apps Script → **Terapkan → Kelola deployment → Edit → Versi baru → Terapkan** pada deployment Production yang sama. Buka kembali URL `/exec` yang selama ini dipakai, lalu muat ulang dan login Admin.
6. Buka **Monitor Admin**: cocokkan release `KCH-AUDIT-2026-11-03`, baca masalah schema/stok/master/trigger/arsip/pending. Buat satu cadangan privat dari monitor dan pastikan tercatat. Pemeriksaan berbasis simulasi tidak menggantikan hasil monitor di Google nyata.
7. Periksa dashboard, absensi, kunjungan dan akses Tamu. Pada transaksi usaha berikutnya, cocokkan jumlah, sumber stok dan hasil laporan dengan bukti nyata. Tidak perlu menjalankan ulang saldo pembukaan yang sudah cocok.

**Jangan jalankan reset, inisialisasi ulang Production, atau saldo awal/persiapan November untuk memasang paket ini.** Gunakan updater A3 yang aman. Instalasi kode cukup sekali; trigger arsip dan pembaruan yang sudah ada dipertahankan secara idempoten.

## File baru

- `operations.gs` — stok masuk/opname, retur, void, koreksi pickup/setoran dan jurnal.
- `period-masters.gs` — master Admin dan snapshot/verifikasi periode.
- `health.gs` — monitor, cadangan privat dan pemulihan terpandu.
- `operations-ui.html` — tampilan tiga menu baru.
- `operations-client.html` — interaksi menu baru.

Untuk `.gs`, pilih **Skrip**; untuk `.html`, pilih **HTML**. Nama pada editor dapat tampil tanpa ekstensi. File `code.gs` pada proyek lama mungkin tampil sebagai `Kode.gs`: ganti isi file backend tersebut, jangan membuat dua salinan fungsi backend yang sama.

## Isi lengkap yang dipasang

- `archive-client.html`
- `auth-client.html`
- `auth-ui.html`
- `auth.gs`
- `canvasser-incentives.gs`
- `code.gs`
- `css.html`
- `firebase-config.gs`
- `guest-auth.gs`
- `guest-crypto.gs`
- `health.gs`
- `incentive-client.html`
- `incentive-sheets.gs`
- `incentives.gs`
- `index.html`
- `js.html`
- `monthly-archives.gs`
- `operations-client.html`
- `operations-ui.html`
- `operations.gs`
- `period-masters.gs`
- `production-setup.gs`
- `score-client.html`
- `score.gs`
- `setup.gs`
- `sheet-updates.gs`
- `stock-client.html`
- `stock-pickups.gs`
- `transaction-edits.gs`
- `transactions.gs`

Sertakan `appsscript.json`. `SHA256SUMS.txt` dalam ZIP mencatat hash setiap file yang dikemas; jangan menyalin panduan atau manifest hash sebagai file skrip.

## Cara memakai tambahan utama

- **Operasional**: pilih stok masuk/opname, retur pegangan, retur penjualan, void, koreksi pickup atau setoran. Koreksi membutuhkan alasan; faktur asli tetap tersimpan. Retur memakai harga dan sumber stok faktur asli. Barang rusak dipisahkan dari stok layak jual. Setoran tetap memo penerimaan uang.
- **Master Admin**: sales, produk, harga, distributor, hari libur dan dokumen. Produk baru mulai dengan stok nol; tambah stok lewat Operasional. Gunakan status nonaktif untuk menghentikan pemakaian master lama tanpa menghapus sejarahnya.
- **Master periode lama**: angka target/Skor/insentif yang belum memiliki master terpercaya ditandai belum terverifikasi. Pilih arsip/cadangan terdaftar, buka tautan sumber dan cocokkan tim, target, harga, produk serta kalender bulan tersebut sebelum mengetik `VERIFIKASI YYYY-MM` dan alasan. Jangan mengesahkan master sekarang sebagai master lama tanpa bukti. Snapshot yang telah disahkan dikunci.
- **Monitor Admin**: cek kesalahan, versi, trigger dan permintaan tertunda. Reservasi yang terbukti belum dikirim dapat dibatalkan secara aman. Permintaan yang mungkin sudah dikirim tetap ditahan hingga hasilnya terbukti; jangan menghapus baris pending untuk membuka blokir.
- **Cadangan/pemulihan**: cadangan harian sekitar pukul02 WIB, laporan turunan tiap15 menit; waktu aktual mengikuti penjadwalan Google. Restore meminta pratinjau, cadangan rollback, alasan dan konfirmasi ketik. Restore tidak mengganti akun login. Data yang berbeda pada periode tertutup ditolak; tersedia salinan pemulihan terpisah untuk diperiksa.

## Aturan yang dipertahankan

Retur mengurangi omzet bersih pada tanggal koreksi, periode tertutup tidak ditulis ulang. Juklak nominal insentif tetap; HADIR TAPI TIDAK ABSEN1HK, IZIN/SAKIT/TIDAK HADIR0HK. Tidak ada penalti uang absensi baru. Sales nonaktif tidak menambah target berjalan, penjualan historis tetap dihitung. Kasus bonus kuartal dengan perubahan tim/kebijakan yang belum memiliki aturan tidak menghasilkan nominal tebakan.

Sinkronisasi memeriksa versi sekitar60 detik pada halaman aktif dan menunda saat pengisian/pending. Label menampilkan waktu pembaruan. Foto tetap privat dan dimuat bertahap; kecepatannya tetap dipengaruhi jaringan, Drive dan kuota Google.

## Bukti dan batas verifikasi

Lihat `IMPLEMENTASI-AUDIT-2026-11-03.md` untuk matriks temuan dan pengujian. Pengujian server/browser menggunakan layanan Google simulasi. Agen belum membaca isi, izin, deployment atau kuota Production secara langsung dan belum menerapkan paket ke Google.
