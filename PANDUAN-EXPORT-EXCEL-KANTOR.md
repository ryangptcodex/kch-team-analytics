# Unduh Excel Kantor dari Riwayat Faktur Penjualan

Buka **Riwayat Transaksi → Unduh Excel Kantor**. Pilih format, sales, periode, dan distributor bila memakai RSSH. **Unduh CSV** dan **Cetak Laporan** tetap tersedia untuk ringkasan faktur.

- **Form Incentive** memakai layout kantor terbaru Motoris/MMTW atau MPR/Canvasser dan hasil kalkulasi Insentif webapp sesuai periode. Admin dapat mengekspor form dari profil Senior dengan mencantumkan pasangan Asisten yang terdaftar dan alokasi dari hasil final. Baris harga unit memuat acuan dari template kantor. Kolom Call Plan, Call, EC Transtrack dan username DMS dapat dilengkapi di Excel. SKU yang tidak ada di kolom template tetap diperhitungkan dalam nilai transaksi dan kalkulasi webapp; kode SKU tersebut disebut di bawah formulir.
- **RSSH biasa** memakai Senin–Sabtu per sales dan distributor. Nilai faktur dan retur dipisah per baris produk, setoran berasal dari catatan setoran, dan stok berasal dari pergerakan stok pegangan. Kedua tim memakai Form 6. Kolom acuan harga Subdist memakai daftar kantor bila SKU cocok; Panel menampilkan harga faktur jika seragam. Subtotal harga beli dan jual tetap mengikuti data faktur. Harga acuan tidak mengubah PRICE_MASTER. Saldo kosong bila riwayat tidak tersedia atau rantainya putus. Kolom Transtrack, tanggal proses dokumen dan pengesahan Finance tetap dapat diisi di Excel. Format tidak menjalankan DoF.
- Admin dapat mengekspor sales sesuai hak Admin. Akun Sales hanya dapat mengekspor datanya sendiri. Ekspor tidak menulis ke Sheet.

## Pemasangan

Tambahkan dua file Script baru **office-reports.gs** dan **office-report-templates.gs**, serta satu file HTML baru **office-report-client.html**. Ganti isi **auth.gs** dan **index.html** dengan versi pada commit yang sama. Simpan dan terapkan versi baru pada deployment UJI COBA untuk memeriksa file Excel dengan data salinan. Setelah uji, terapkan versi baru pada deployment Production yang sudah ada.
