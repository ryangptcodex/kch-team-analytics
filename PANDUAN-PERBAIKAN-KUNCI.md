# Antrean kunci saat memuat absensi — 2 November 2026

Screenshot Production menampilkan “Batas waktu penguncian habis: proses lain menahan kunci terlalu lama.” Artinya permintaan habis waktu menunggu kunci bersama. Pesan ini sendiri tidak membuktikan data absensi terhapus. Proses yang benar-benar sedang berjalan di Google belum dapat diperiksa langsung oleh agen.

Source sebelumnya mengambil ScriptLock selama setiap pengecekan akun Admin, termasuk pembacaan biasa yang tidak mengubah akun, lalu memanggil SpreadsheetApp.flush. Kunci itu juga dipakai penyimpanan transaksi, arsip dan pemeliharaan. Beberapa RPC bersamaan dapat ikut menunggu kunci sebelum membaca data.

## Pasang satu file

Ganti seluruh isi **[auth.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/production/auth.gs)** pada Apps Script **Production**, melalui **Copy raw file**, lalu Simpan.

Karena screenshot memakai `/exec`, perbarui deployment yang sama: **Terapkan → Kelola deployment → ikon pensil → Versi baru → Terapkan**. Refresh webapp dan buka Absensi lagi. Untuk `/dev`, cukup refresh setelah kode disimpan. Tidak perlu menghapus UID, mengubah password, reset sheet, memasang stok awal lagi atau menjalankan Perbarui Seluruh Sheet.

## Perubahan

Akun Admin yang UID-nya sudah terhubung diperiksa dengan pembacaan ACCESS_USERS terbaru pada setiap RPC, tanpa mengambil kunci penulisan dan tanpa flush pada langkah autentikasi. Pemeriksaan token Google, status ACTIVE, role ADMIN, UID, duplikat email dan header tetap berlaku. Hak akses tidak dicache.

Pembuatan akun pertama dan pengaitan UID kosong masih mengambil kunci, membaca ulang keadaan akun sebelum menulis, lalu memeriksa hasil. Proses ini tidak boleh menduplikasi akun, mengaktifkan kembali akun nonaktif atau menimpa UID lain. Penulisan profil, kredensial, transaksi/stok dan arsip tetap memakai perlindungan kunci yang ada.

419 tes Node lulus, termasuk simulasi kunci sedang sibuk ketika membaca absensi/metadata, revokasi akses tanpa cache, bootstrap sekali, perubahan status/UID saat menunggu kunci, serta mutasi yang tetap ditolak bila kunci sibuk. Browser login Tamu dan foto juga diperiksa. Ini menghilangkan antrean autentikasi yang tidak diperlukan; bukan jaminan semua timeout layanan Google hilang. Bila error tetap muncul setelah Versi baru diterapkan, periksa waktu/status proses di halaman Eksekusi Apps Script untuk menemukan proses yang masih berjalan.
