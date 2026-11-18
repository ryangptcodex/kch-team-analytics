# Unduh Excel Kantor dari Riwayat Faktur Penjualan

Buka **Riwayat Transaksi → Unduh Excel Kantor**. Pilih format, sales, periode, dan distributor bila memakai RSSH. **Unduh CSV** dan **Cetak Laporan** tetap tersedia untuk ringkasan faktur.

- **Form Incentive** memakai layout Motoris/MMTW atau MPR/Canvasser dan hasil kalkulasi Insentif webapp sesuai periode. Admin dapat mengekspor form dari profil Senior dengan mencantumkan pasangan Asisten yang terdaftar dan alokasi dari hasil final. Kolom Call Plan, Call, EC Transtrack dan username DMS dapat dilengkapi di Excel. SKU yang tidak ada di kolom template tetap diperhitungkan dalam nilai transaksi dan kalkulasi webapp; kode SKU tersebut disebut di bawah formulir.
- **RSSH biasa** memakai Senin–Sabtu per sales dan distributor. Nilai faktur dan retur dipisah per baris produk, setoran berasal dari catatan setoran, dan stok berasal dari pergerakan stok pegangan. Harga unit kosong bila berbeda dalam periode; subtotal harga beli dan jual mengikuti data faktur. Saldo kosong bila riwayat tidak tersedia atau rantainya putus. Kolom Transtrack, tanggal proses dokumen dan pengesahan Finance tetap dapat diisi di Excel. Format tidak menjalankan DoF.
- Admin dapat mengekspor sales sesuai hak Admin. Akun Sales hanya dapat mengekspor datanya sendiri. Ekspor tidak menulis ke Sheet.

## Pemasangan

Tambahkan dua file Script baru **office-reports.gs** dan **office-report-templates.gs**, serta satu file HTML baru **office-report-client.html**. Ganti isi **auth.gs** dan **index.html** dengan versi pada commit yang sama. Simpan dan terapkan versi baru pada deployment UJI COBA untuk memeriksa file Excel dengan data salinan. Setelah uji, terapkan versi baru pada deployment Production yang sudah ada.
