# Akun Sales dan Admin cabang

| Akun | Cara masuk | Akses |
| --- | --- | --- |
| Admin utama | Google | Operasional Admin dan menu **Kelola akun**. |
| Supervisor atau Admin cabang | Google, memakai email yang didaftarkan Admin utama | Operasional Admin. |
| Sales | Username dan password yang dibuat Admin utama | Data miliknya sendiri, termasuk transaksi, absensi, foto kunjungan, rencana kunjungan, stok pegangan, riwayat pengambilan dan setoran, laporan, skor, dan insentif yang berlaku. Produk, distributor, dan stok umum tetap tersedia sebagai referensi input. |
| Tamu | Username dan password Tamu yang sudah ada | Akses baca sesuai aturan Tamu. |

Sales dapat menginput transaksi, absensi dengan foto, foto kunjungan, dan rencana miliknya. Edit transaksi dan pengarsipan rencana tetap mengikuti aturan periode dan validasi yang sudah berlaku. Penginputan stok pengambilan, setoran, jam manual dan status absensi khusus tetap dilakukan Admin. Sales Junior melihat alokasi insentifnya sendiri; perhitungan pasangan tetap menggunakan rumus yang sama.

## Pemasangan Apps Script

1. Gunakan satu revisi yang sama untuk seluruh file Script `.gs` dan HTML `.html` dari root paket. Jika proyek sudah persis di `dc29eb7`, cukup ganti file aplikasi yang berubah sesuai daftar perubahan GitHub. Di editor, ganti isi backend `Code` atau `Kode` yang sudah ada. Folder `tests`, `tools`, `docs`, dan `config` tidak perlu disalin ke editor.
2. Simpan dan buat versi baru pada deployment **UJI COBA** yang sudah digunakan. Ikuti konfigurasi Firebase dan prosedur deployment uji yang ada. Pengujian akun Sales dan Admin cabang dapat dilakukan di profil browser terpisah melalui URL uji `/exec`.
3. Setelah uji penerimaan, pasang revisi yang sama pada deployment Production yang sudah digunakan. Gunakan proyek dan spreadsheet Production yang benar. Sebarkan URL deployment yang sudah diperbarui.
4. Pembaruan kode ini tidak memerlukan menjalankan inisialisasi database, saldo awal stok, repair, atau pembaruan sheet. Panel akun memakai `ACCESS_USERS` dan mempertahankan baris lama. Saat kredensial Sales baru disimpan, aplikasi menyimpan hash PBKDF2 dan salt. Password Sales tidak dapat ditampilkan kembali.

## Mengelola akun

- Masuk dengan Google sebagai Admin utama. Buka **menu akun → Kelola akun**.
- Pada **Akun Sales**, pilih profil aktif dari master `SALES`, isi username unik dan password 12–128 karakter, lalu simpan. Untuk memperbarui akun, pilih profil yang sama. Kosongkan password untuk mempertahankannya. Status **Nonaktif** atau perubahan akun mengakhiri akses sesi sebelumnya pada permintaan berikutnya.
- Pada **Admin cabang**, isi email akun Google supervisor atau pilih **Ubah** pada akun yang terdaftar. Pilih **Aktif** atau **Nonaktif** dan simpan. Login pertama mengikat UID Google terverifikasi ke akun tersebut. Menonaktifkan akun tidak menghapus catatan operasionalnya.
- Pertahankan hak akses spreadsheet dan editor Apps Script sesuai kebutuhan pengelola file. Akun webapp tidak membutuhkan hak edit spreadsheet.
- Berikan password Sales secara privat. Sales masuk dengan **Masuk sebagai Sales** dan memilih **Keluar akun** pada perangkat bersama.

## Uji penerimaan

- Masuk sebagai dua Sales yang berbeda. Bandingkan dashboard, transaksi, absensi, foto, arsip, stok pegangan dan laporan. Buat satu transaksi atau rencana uji per akun dan pastikan hanya muncul pada akun pemiliknya.
- Coba ganti password atau nonaktifkan satu akun, lalu muat data dari sesi akun tersebut dan pastikan diminta masuk kembali.
- Masuk sebagai Admin cabang. Pastikan fitur operasional Admin tersedia dan menu **Kelola akun** tidak muncul. Masuk sebagai Admin utama dan pastikan ketiga formulir akun tetap tersedia.
- Ulangi alur login Tamu. Cek halaman pada desktop dan HP.
