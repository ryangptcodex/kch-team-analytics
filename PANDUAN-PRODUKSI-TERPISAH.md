# Menyiapkan KCH Team Analytics Production

Paket ini memisahkan database Production dari UJI COBA. Kode dan pengujian sudah disiapkan di cabang `production`; pemasangan dan eksekusi di Google masih dilakukan Admin. Mengganti nama saja tidak memisahkan database.

## Tujuan yang sudah ditentukan

- [Spreadsheet Production](https://docs.google.com/spreadsheets/d/1ww5Zhw_2nFqUyEq9S-I85fpJO1J3tJ_1Mo5UPBqpz4M/edit).
- [Apps Script Production](https://script.google.com/u/0/home/projects/1uVrRq4sfvzLIjCIMAg6Qo5TlPG0XJxCnDTuYINSCrsf0WrOF2mvbk-5X/edit).
- Admin: `mhmdryyan7@gmail.com`.
- UJI COBA tetap menggunakan spreadsheet lama. Jangan menimpa deployment UJI COBA atau menghapus datanya.

Konfigurasi mengenali ID proyek Production di atas dan mengarahkannya ke spreadsheet Production. Fungsi persiapan menolak Gmail, proyek, atau spreadsheet aktif yang tidak sesuai. Proyek lain tetap menggunakan konfigurasi UJI COBA; jangan memakai paket ini untuk proyek Production lain tanpa memperbarui konfigurasi.

## 1. Salin tujuh file ke Apps Script Production

Buka tautan file berikut. Klik **Raw**, tekan **Ctrl+A → Ctrl+C**. Di editor Apps Script **Production**, buka file dengan nama yang sama, pilih seluruh isinya, lalu tempel. Buat satu file Script baru bernama `production-setup` untuk file baru; editor menambahkan `.gs` otomatis. Untuk HTML gunakan file HTML dengan nama yang sama. Simpan setelah seluruh tujuh file terpasang.

| File lengkap | Tindakan |
| --- | --- |
| [firebase-config.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/production/firebase-config.gs) | Ganti seluruh isi |
| [production-setup.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/production/production-setup.gs) | Buat Script baru |
| [sheet-updates.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/production/sheet-updates.gs) | Ganti seluruh isi |
| [setup.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/production/setup.gs) | Ganti seluruh isi |
| [auth.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/production/auth.gs) | Ganti seluruh isi |
| [index.html](https://github.com/ryangptcodex/kch-team-analytics/blob/production/index.html) | Ganti seluruh isi |
| [js.html](https://github.com/ryangptcodex/kch-team-analytics/blob/production/js.html) | Ganti seluruh isi |

File lain dari salinan UJI COBA terbaru tetap diperlukan. Ini paket perubahan untuk salinan lengkap, bukan aplikasi tujuh file yang berdiri sendiri. Bila proyek baru ternyata kosong, salin seluruh file aplikasi dari cabang `production` terlebih dahulu, termasuk manifest `appsscript.json`.

Menu spreadsheet lama yang membangun ulang data diganti dengan jalur pembaruan aman. Fungsi `repairAndOptimizeSpreadsheet` sekarang meneruskan ke updater yang mempertahankan data. Struktur fitur lama tetap dilayani tombol Perbarui Seluruh Sheet. Tampilan webapp tidak diubah.

## 2. Siapkan salinan Production sekali

1. Masuk Gmail Admin. Pastikan editor adalah **Apps Script Production** pada tautan di atas.
2. Pilih fungsi **`siapkanDatabaseProduksiBaru`** pada dropdown editor, lalu **Jalankan**. Ikuti izin Google jika muncul; izin tidak selalu diminta ulang bila sudah diberikan.
3. Buka spreadsheet Production → tab **PEMBARUAN_SHEET**. B8 harus berbunyi **Production disiapkan — isi stok awal**. B10 berisi cadangan lengkap sebelum pembersihan.

Fungsi membuat cadangan dahulu, lalu membersihkan aktivitas percobaan pada Production: transaksi, arsip, absensi/foto, AA/branding, pengambilan/setoran, mutasi, receipt, histori edit, dokumen/berita percobaan dan data nonmaster lainnya. Master produk, harga, sales, distributor, libur dan SETTINGS dipertahankan. Saldo percobaan dibuang; INVENTORY sementara nol. File Drive lama tidak dihapus.

Production memperoleh folder foto baru. Akun Admin disiapkan; akun Tamu baru **nonaktif**, tanpa username/password/sesi percobaan. Sesi/penanda arsip yang tersalin tidak digunakan. Production sekarang memakai Firebase Authentication tersendiri (`kch-team-analytics-production`); UJI COBA tetap memakai Firebase lama. Browser dan server memilih konfigurasi sesuai ID proyek Apps Script.

Menjalankan fungsi persiapan lagi hanya membaca penanda yang sudah tersimpan, **tidak mengosongkan ulang**. Bila muncul hasil belum pasti, berhenti dan kirim pesan error; jangan menghapus penanda atau memaksa reset.

## 3. Isi stok fisik yang benar

- Buka **STOK_AWAL_PRODUKSI**. Setiap produk sudah tercantum. Isi dua kolom distributor dengan stok fisik masing-masing; **isi angka 0 bila kosong**. Sel kosong sengaja ditolak agar saldo uji tidak diterima sebagai saldo awal. Jangan gunakan angka500 hasil tes.
- Bila barang sudah dipegang sales, isi **PEGANGAN_AWAL_PRODUKSI**: `sales_id`, `product_id`, `distributor_id`, `quantity`. Gunakan ID dari master SALES/PRODUCTS/DISTRIBUTORS. Satu kombinasi sales-produk-distributor hanya satu baris. Bila belum ada pegangan, biarkan sheet ini tanpa baris data.
- Jumlah gudang harus merupakan barang yang masih di gudang; barang yang sudah dibawa sales hanya dicatat sebagai pegangan agar tidak dihitung dua kali.
- Periksa master nama/tim sales, produk, harga jual/modal, distributor dan kalender libur. Persiapan tidak membuktikan semua harga/master sudah benar.

Setelah selesai, di editor jalankan **`terapkanStokAwalProduksi`**. Fungsi menolak saldo kosong, negatif, pecahan, produk hilang, ID salah dan baris ganda. Saldo/mutasi pembukaan ditulis sekali, tanpa transaksi penjualan, omzet, Skor atau Insentif. B8 kemudian berbunyi **Stok awal Production sudah diterapkan**. Input bisnis melalui webapp diblokir sampai tahap ini selesai. Menjalankan ulang fungsi tidak menerapkan saldo dua kali.

## 4. Pembaruan, akses dan deployment

1. Klik A3 pada **PEMBARUAN_SHEET** untuk memperbarui struktur/laporan. Tombol ini mempertahankan aktivitas berikutnya; bukan tombol reset bulanan. Jalankan **setupArsipBulanan** bila perlu memasang/memeriksa trigger arsip pada proyek baru. Trigger lama tidak otomatis dianggap trigger Production.
2. Gunakan Admin untuk mengatur username/password Tamu yang baru dan mengaktifkannya. Jangan membagikan spreadsheet sumber atau folder cadangan kepada Tamu. Link salinan lengkap tetap hanya untuk Admin di webapp.
3. Setelah temuan launch lain dibereskan, buat deployment **baru pada proyek Production**: **Terapkan → Deployment baru → Aplikasi web**, jalankan sebagai Admin/pemilik. Gunakan URL `/exec` milik proyek Production; jangan mengganti deployment UJI COBA. Akses mengikuti kebutuhan login Tamu melalui webapp.
4. Uji Admin serta Tamu dari perangkat/akun yang bukan editor. Pastikan tidak ada transaksi/arsip uji, stok sesuai hitungan fisik, dan login serta sumber stok per baris benar. Kiriman transaksi tertunda di browser Production mempunyai penyimpanan terpisah dari UJI COBA.

Status internal `READY` hanya berarti saldo awal sudah diterapkan, **bukan sertifikat siap launch**. Temuan absensi/foto, akses foto, rate-limit Tamu, dan propagasi error export pada [review launch](REVIEW-LAUNCH-2026-11-01.md) masih perlu diperbaiki. Pengujian lokal belum membuktikan izin, trigger, saldo, isi master atau deployment Google nyata.

## Verifikasi paket

368 tes Node lulus, termasuk simulasi tujuan salah, backup gagal, batch ditolak, respons hilang/terlambat, persiapan berulang dan saldo awal yang hanya diterapkan sekali. Pemeriksaan browser arsip, stok, Tamu, Skor, Insentif dan responsivitas dijalankan terpisah. Tidak ada eksekusi pembersihan terhadap file Google oleh agen.

## Pembaruan Firebase khusus Production — 2 November 2026

Pengguna membuat Firebase baru dan memberikan konfigurasi web. Untuk memakai Firebase baru pada Production yang sudah disiapkan, ganti seluruh isi **firebase-config.gs** dan **auth.gs** dari tautan tabel di atas, lalu simpan. Browser dan verifikasi server harus memakai proyek yang sama; jangan mengganti konfigurasi browser saja. Kode import npm yang ditampilkan Firebase tidak perlu ditempel ke Apps Script.

Pada Firebase **kch-team-analytics-production**, aktifkan Authentication → Sign-in method → Google, tentukan email dukungan, lalu tambahkan hostname persis dari pesan error Production ke Settings → Authorized domains. Refresh `/dev` dan login Google Admin. Untuk `/exec`, terapkan Versi baru pada deployment Production. Ini mengganti layanan login; tidak perlu menjalankan persiapan database maupun saldo awal lagi. Jangan mengosongkan stok/akun atau menghapus penanda. Jika UID Admin sebelumnya sudah terikat dari Firebase lama dan muncul penolakan akses, periksa pesan error untuk migrasi identitas yang terarah.

369 tes Node lulus setelah pemisahan Firebase, termasuk token proyek UJI ditolak Production dan token Production ditolak UJI, serta API key lookup sesuai lingkungan. Login Google nyata masih perlu dicoba pengguna.
