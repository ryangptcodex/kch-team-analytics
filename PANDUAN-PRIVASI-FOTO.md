# Foto absensi dan kunjungan privat — 2 November 2026

Foto baru tidak lagi dibagikan sebagai ANYONE_WITH_LINK. Gambar kartu dan modal diambil melalui gateway login, berdasarkan referensi catatan absensi/kunjungan yang terdaftar. Admin dan Tamu tetap dapat melihat bukti bisnis sesuai akses yang ada; Tamu tetap tidak dapat menginput. Endpoint tidak menerima ID file Drive sembarang.

## Pasang tiga file lengkap

Buka tautan → **Copy raw file** → ganti seluruh isi file dengan nama yang sama di Apps Script **Production**:

- [code.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/code.gs)
- [auth.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/auth.gs)
- [js.html](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/js.html)

Simpan semuanya lalu refresh `/dev`. Untuk `/exec`, terapkan Versi baru pada deployment Production. File transactions.gs dan index.html tahap sebelumnya tetap dipakai. Tidak perlu menjalankan persiapan database, saldo awal atau reset sheet.

Foto kartu/modal dimuat setelah autentikasi, maksimal empat permintaan bersamaan, dengan cache sementara dalam memori sesi. Dua kartu dengan foto yang sama tidak mengirim permintaan ganda. Cache tidak disimpan di localStorage/sessionStorage dan dibuang bersama UI saat logout. Respons terlambat dari sesi lama tidak boleh memasang gambar pada sesi berikutnya. Foto lama yang berasal dari URL eksternal selain Drive tidak otomatis dipublikasikan atau diunduh dari server lain.

## Amankan file foto yang sudah ada

Perubahan kode tidak otomatis mengubah izin file lama. Setelah ketiga file terpasang:

1. Di editor Apps Script **Production**, memakai Gmail Admin, pilih **amankanFotoLama → Jalankan**.
2. Buka **Log eksekusi**. Laporan berisi `success`, `complete`, `checked`, `total`, `secured`, `failedCount`, `failed` dan `unsupported`.
3. Jika `complete:false`, jalankan fungsi yang sama lagi. Setiap eksekusi memeriksa maksimal30 file, lalu melanjutkan dari penanda berikutnya. `failedCount` tetap mengingat kegagalan dari eksekusi sebelumnya.
4. Hasil yang diharapkan adalah `success:true`, `complete:true`, `failedCount:0`, `unsupported:0`. Bila tidak, kirim laporan error tersebut; jangan menghapus jurnal atau reset data.

Fungsi hanya menyentuh gambar yang direferensikan pada ATTENDANCE/VISIT_PHOTOS dan arsipnya, termasuk arsip ketika trigger bulanan sedang nonaktif. File lain tidak dipindai atau diubah. File harus dimiliki Gmail Admin. Fungsi menjadikan akses link PRIVATE dan menghapus viewer/editor eksplisit selain Admin. Tidak ada gambar, baris absensi, transaksi, atau stok yang dihapus.

Izin warisan dari folder tidak dicabut sembarangan. Bila folder atau folder induknya masih dibagikan, fungsi melaporkan kegagalan dan upload baru ditolak sampai folder privat. Ini menghindari perubahan izin folder yang mungkin dipakai dokumen lain. File bukan milik Admin, file tidak ditemukan, gambar berformat tidak didukung, atau URL eksternal dilaporkan untuk diperiksa. Jangan menyatakan semua foto aman bila laporan masih gagal. Jalankan ulang setelah penyebabnya diperbaiki; fungsi dapat dijalankan berulang tanpa menggandakan data.

## Pemeriksaan Google nyata

- Admin dan Tamu masih dapat melihat foto kartu absensi, modal foto dan kunjungan di webapp setelah login.
- Setelah migrasi sukses, link Drive foto yang sama harus meminta akses ketika dibuka lewat jendela samaran yang tidak login. Uji ini memeriksa izin Google nyata, bukan hanya tombol yang disembunyikan aplikasi.
- Beralih Admin → logout → Tamu tidak meninggalkan gambar atau data sesi sebelumnya.

394 tes Node lulus. Pemeriksaan browser foto mencakup kompresi/recovery tahap sebelumnya, penayangan privat kartu/modal, penggabungan permintaan cache, Tamu melihat bukti, dan respons gambar sesi lama yang diabaikan. Browser stok, login Tamu dan arsip juga lulus. Google Drive, folder aktual dan deployment pengguna belum diubah atau diverifikasi langsung oleh agen.

Batas berikut masih terbuka: aturan jam terlambat/tepat waktu, pembatasan login Tamu dan propagasi error export. Akses sah melalui webapp tetap memungkinkan pengguna melihat atau menyimpan gambar yang memang diizinkan untuknya; privasi di sini mencabut publikasi file Drive dan membatasi pengambilan ke sesi/catatan yang sah.
