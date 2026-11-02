# Perbaikan error export transaksi — 2 November 2026

Sebelumnya pembaca transaksi bisa mengembalikan success:false, tetapi pembungkus export tetap mengirim success:true dengan data kosong dan total0. Sekarang error sumber diteruskan sebagai kegagalan. CSV/laporan cetak tidak dibuat ketika pembacaan gagal.

## Pasang satu file

Ganti seluruh isi **[code.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/code.gs)** pada Apps Script **Production** melalui **Copy raw file**, lalu Simpan dan refresh webapp `/dev`. Untuk `/exec`, terapkan Versi baru pada deployment Production. Revisi hanya membutuhkan code.gs; js.html yang sudah dipasang telah menangani success:false pada export CSV dan laporan cetak.

Tidak perlu menjalankan fungsi persiapan, reset data, penerapan stok awal atau pembaruan struktur sheet. Seluruh perbaikan tanggal/foto/privasi sebelumnya tetap ada dalam file lengkap ini.

## Hasil yang diharapkan

- Jika pembacaan gagal, tampil pesan error dari sumber, bukan toast “CSV berhasil dibuat” atau laporan kosong yang dianggap benar.
- Jika hasil hilang/tidak berbentuk array, jumlah baris tidak lengkap, atau ringkasan tidak tersedia/berisi angka tidak valid, export ditolak dengan pesan data belum lengkap.
- Jika pembacaan berhasil dan memang tidak ada transaksi sesuai filter, export nol baris tetap sah.
- Filter pencarian/tim/distributor/tanggal, hak baca Admin/Tamu serta perhitungan modal, penjualan dan SHJ dipertahankan. Tidak ada penulisan transaksi atau pemotongan stok dari export.
- Bila hasil melebihi jumlah baris yang diambil pembaca export, aplikasi menolak laporan terpotong; paket ini tidak menambahkan export streaming untuk database berukuran besar.

406 tes Node lulus. Enam regresi baru mencakup kegagalan pembacaan nyata melalui gateway, respons rusak/terpotong, hasil kosong yang sah, filter dan total Admin/Tamu, serta handler CSV/cetak asli yang tidak mengunduh atau membuka laporan ketika error. Pengujian menggunakan layanan Google tiruan; pemasangan dan percobaan export Google nyata masih dilakukan pengguna.
