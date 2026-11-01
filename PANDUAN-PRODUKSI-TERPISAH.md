# Menyiapkan file produksi yang terpisah dari UJI COBA

**Mengganti nama saja tidak cukup.** Nama adalah label. Kode yang ada masih memakai ID spreadsheet UJI COBA pada `firebase-config.gs`, dan pemeriksaan pemeliharaan juga masih mencocokkan ID tersebut. Mengganti judul spreadsheet/proyek tanpa mengganti konfigurasi bukan pemisahan lingkungan.

## Langkah pertama yang dapat dilakukan sekarang

1. Dengan Gmail Admin, buka spreadsheet **KCH Team Analytics — Uji Coba** yang sekarang.
2. Pilih **File → Buat salinan**. Beri nama **KCH Team Analytics — Produksi** dan simpan di Drive Admin. Jangan centang opsi membagikan ke orang yang sama jika ada; Tamu nanti memakai webapp, bukan spreadsheet sumber.
3. Pastikan URL spreadsheet salinan mempunyai **ID berbeda** dari UJI COBA. Jangan menghapus atau menimpa file UJI COBA.
4. Dari **spreadsheet salinan**, pilih **Ekstensi → Apps Script**. Salinan container membawa bound script; periksa file kode dan pastikan URL editor mempunyai **ID proyek berbeda** dari proyek UJI COBA. Ganti judul proyek menjadi **KCH Team Analytics — Produksi**.
5. Jangan menjalankan setup/pembaruan/arsip dari salinan dan jangan membuat deployment produksi dahulu. Kode yang tersalin masih menunjuk ID UJI COBA sampai konfigurasi diubah dan diverifikasi.
6. Kirim tautan **spreadsheet Produksi** dan tautan **editor Apps Script Produksi** ke percakapan. Tidak perlu mengubah izin file menjadi publik, memberikan password, atau memberikan token Google.

Agen saat ini tidak memiliki konektor Google yang dapat membuat salinan/proyek secara langsung. Langkah di atas membuat resource nyata dan memberi ID tujuan yang diperlukan; panduan ini belum membuat file Google atau mengubah konfigurasi/data pengguna.

## Setelah ID kedua resource tersedia

Pekerjaan berikut telah diminta pengguna, tetapi **belum diterapkan** pada tahap panduan ini:

- Kunci konfigurasi dan pengecekan Admin ke spreadsheet/proyek produksi yang benar, sehingga menjalankan kode produksi tidak membaca atau menulis database UJI COBA. Native menu/trigger dan runtime webapp harus memakai tujuan yang sama.
- Buat cadangan sebelum persiapan salinan. Bersihkan aktivitas percobaan **hanya pada salinan produksi**, termasuk histori arsip, AA/branding, mutasi, receipt dan histori edit uji; mengosongkan transaksi aktif saja tidak cukup karena sumber arsip ikut Insentif triwulan.
- Pertahankan hanya master produk/harga/sales/distributor/libur/konfigurasi yang sudah diperiksa kebenarannya. Dokumen/berita percobaan jangan diasumsikan konten produksi.
- Saldo gudang dan pegangan dimulai dari hitungan nyata. Angka500 atau saldo setelah pengujian bukan bukti stok sebenarnya. Kalau jumlah fisik belum tersedia, jangan menyatakan saldo sudah siap atau mengarang jumlah; baseline harus diisi/verifikasi sebelum penjualan produksi.
- Siapkan akses Admin/Tamu dan trigger pada proyek baru; jangan menganggap deployment, sesi, atau trigger proyek lama sudah menjadi deployment produksi.
- Gunakan deployment baru `/exec` milik proyek produksi. Link `/dev` dan `/exec` UJI COBA tetap untuk pengujian. Uji Tamu dari perangkat yang bukan editor sebelum membagikan link operasional.

Pemisahan database/proyek tidak dengan sendirinya memperbaiki temuan lain pada [review launch](REVIEW-LAUNCH-2026-11-01.md): menu legacy, validasi dan ketahanan upload absensi/foto, kebijakan akses foto, rate-limit Tamu, serta propagasi error export masih terbuka. Jangan mengklaim launch siap hanya karena file baru sudah dibuat.
