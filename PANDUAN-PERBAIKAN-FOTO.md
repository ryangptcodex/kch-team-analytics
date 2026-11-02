# Perbaikan penyimpanan bukti foto — 2 November 2026

Absensi dan foto kunjungan sekarang memakai kode kiriman serta receipt yang sama mekanismenya dengan transaksi. Baris foto, log pelaku dan receipt COMMITTED ditulis bersama dalam satu batch Sheets. File Drive tetap dibuat terpisah; jika hasil batch belum pasti, file dipertahankan dan kiriman tidak diulang sampai statusnya dapat dipastikan. Ini memperbaiki kasus baris sudah masuk tetapi bukti dibuang setelah kegagalan flush.

## Pemasangan di Production

Ganti seluruh isi **kelima file** berikut melalui **Copy raw file**, lalu simpan semuanya sebelum mencoba upload. Jangan hanya memasang server atau browser saja.

- [code.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/code.gs)
- [transactions.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/transactions.gs)
- [auth.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/auth.gs)
- [js.html](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/js.html)
- [index.html](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/index.html)

Refresh webapp `/dev`. Untuk `/exec`, terapkan Versi baru pada deployment Production. Tidak perlu menjalankan persiapan database, penerapan stok awal, atau pembersihan sheet. File ini mempertahankan konfigurasi Firebase terpisah, nama profil, sumber stok, perhitungan dan tampilan lain yang sudah ada. Kode lama yang mengirim foto tanpa requestId akan ditolak; browser harus direfresh setelah seluruh file dipasang.

## Ketika koneksi terputus

- Form foto menampilkan status beserta tombol **Periksa hasil**. Tekan tombol tersebut untuk membaca receipt kiriman yang sama, termasuk sesudah refresh halaman.
- Jika sudah tersimpan, aplikasi menyelesaikan formulir dan memuat data terbaru tanpa mengunggah atau menambahkan baris kedua. Angka HK dimuat ulang setelah absensi sukses.
- **Coba simpan lagi** hanya muncul setelah pemeriksaan memastikan kode belum tercatat. Tombol mengirim ulang draft dan ID yang sama, bukan membuat kiriman baru.
- Selama hasil PENDING, input baru ditahan. Jangan menghapus jurnal atau mencoba memaksa reset. Admin dapat menjalankan checkKchTransactionSetup untuk rincian kiriman tertunda.
- Browser hanya menyimpan requestId pemulihan dalam sessionStorage; foto, catatan dan token tidak disimpan di sana. Draft gambar hanya berada dalam memori selama halaman terbuka. Jika browser tidak dapat menyimpan requestId, upload tidak dikirim.

File hanya dibuang setelah Google menolak batch secara definitif dan penolakan tercatat. Timeout atau gagal membaca receipt mempertahankan file karena batch dapat selesai belakangan. Kegagalan Drive sebelum penyimpanan dapat menyisakan file yang belum terpakai; paket ini tidak menghapus file secara agresif atau menjamin transaksi atomik lintas Drive dan Sheets.

## Verifikasi dan batas tahap ini

385 tes Node lulus, termasuk kalender WIB sebelumnya, replay tanpa duplikat, receipt/foto yang tetap utuh pada respons hilang/terlambat, penolakan batch, konflik payload, perlindungan guest, dan penyimpanan ID browser. Uji browser baru `tools/photo-ui-check.cjs` menjalankan formulir asli, kompresi, respons RPC hilang, recovery, refresh HK, dan layar1440/390/320 dengan layanan Google tiruan. Browser stok dan login Tamu juga lulus.

Status terlambat/tepat waktu belum diberi aturan jam masuk kantor. Privasi foto absensi/kunjungan, pembatasan login Tamu dan error export masih pekerjaan berikutnya. Pemasangan dan uji layanan Google nyata perlu dikonfirmasi pengguna; jangan menyatakan launch siap berdasarkan tes lokal ini saja.
