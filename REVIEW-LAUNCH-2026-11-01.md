# Review kesiapan launch KCH — 1 November 2026

Keputusan saat review: **belum disarankan memakai deployment/database sekarang langsung sebagai produksi**. Fondasi cukup untuk rollout terbatas Admin input + Tamu membaca, setelah temuan sebelum launch dibereskan dan data awal produksi diverifikasi. Tidak memerlukan membangun ulang seluruh aplikasi.

Pengguna mengonfirmasi **seluruh isi spreadsheet saat ini masih data uji**. Menyimpan arsip Oktober tidak mengeluarkan angka uji dari perhitungan historis/triwulan. Jangan menghapus sebagian baris transaksi atau mengubah saldo tanpa rekonsiliasi.

**Pembaruan setelah review:** paket pemisahan Production dan pengamanan menu legacy sudah diimplementasikan serta diuji lokal. Lihat [panduan Production](PANDUAN-PRODUKSI-TERPISAH.md). Pemasangan/persiapan Google nyata belum dijalankan agen. Temuan lain di bawah tetap terbuka; bagian bukti berikut merekam keadaan saat audit awal.

**Perbaikan pertama, 2 November:** code.gs kini menolak tanggal absensi/foto kunjungan yang tidak valid dan tanggal masa depan berdasarkan hari WIB, sebelum upload/append. 374 tes Node lulus, termasuk kalender/tahun kabisat/batas tengah malam WIB dan periode tertutup. Status tepat waktu, ketahanan penyimpanan foto, ACL foto, rate-limit dan error export masih terbuka; belum ada pemasangan Google nyata yang dikonfirmasi untuk revisi ini.

## Cakupan dan bukti

- Source ditinjau pada commit `8f5e12b553a4d237dd825672acbe333795a0753e`, aplikasi terakhir berubah pada a96ae2d. Branch `uji-login`.
- **353 tes Node lulus** pada review ini.
- Enam pemeriksaan browser lulus: Admin/Tamu, stok/pengambilan/setoran, arsip/privasi, Skor, Insentif, serta responsivitas umum. Pemeriksaan terakhir mencakup **17 view pada 12 perpindahan ukuran**, empat grafik Chart.js nyata dan modal; Chart.js UMD resmi4.4.8 diunduh untuk pengujian. Bukan load test Google produksi.
- Pengguna sudah mengonfirmasi privasi Tamu, pengambilan qty5, penjualan pegangan qty2, faktur campuran pegangan/distributor, dan edit jumlah sumber campuran. Edit mengganti sumber baru diarahkan, belum dikonfirmasi. Uji nyata setoran/foto dan pemulihan backup penuh belum dikonfirmasi.
- Reproduksi tambahan yang menemukan bug: [tools/launch-review-repro.cjs](tools/launch-review-repro.cjs). Hasil aktual tiruan: [docs/launch-review-observations-2026-11-01.jsonl](docs/launch-review-observations-2026-11-01.jsonl). Ini **observasi bug**, bukan tambahan tes regresi yang dinyatakan lulus.
- Agen tidak memiliki koneksi terautentikasi ke Apps Script/Sheets pengguna. Percobaan akses anonim ke sheet tidak tersedia di lingkungan ini dan **tidak membuktikan status izin Drive**. Isi/master/saldo/ACL/trigger Google nyata dan versi deployment final belum diaudit langsung; bukti nyata berasal dari screenshot dan konfirmasi pengguna.
- Review ini menambah laporan dan reproduksi saja; **belum mengubah kode aplikasi atau membersihkan data Google**.

## Harus dibereskan sebelum launch operasional

### L1 — Data uji akan ikut menjadi angka bisnis

**Bukti:** konfirmasi pengguna bahwa semua data masih uji; `firebase-config.gs:17` mengarah ke spreadsheet UJI COBA. `score.gs:44` menggabungkan sumber aktif dan arsip; `monthly-archives.gs:40` memang menyediakan histori untuk perhitungan, termasuk triwulan.

**Dampak:** omzet, stok pegangan, AA/branding, Skor dan Insentif dapat membawa aktivitas percobaan. Merapikan nama sheet atau mengarsipkan ulang tidak menghilangkan dampaknya. Stok yang terpotong uji juga bukan otomatis stok fisik sebenarnya.

**Tindakan:** siapkan **database/deployment produksi terpisah**. Pertahankan UJI COBA sebagai tempat tes dan arsip percobaan. Bawa hanya master/harga/sales/distributor/libur/konfigurasi yang sudah diverifikasi; sumber aktivitas, arsip aktivitas, mutasi/receipt/edit percobaan tidak menjadi histori produksi. Tentukan saldo pembukaan gudang dan pegangan dari hitungan nyata, bukan asumsi500 atau hasil pengujian. Pengalihan ID spreadsheet/config/native guard harus konsisten; sekadar menyalin sheet lalu tetap memakai ID test tidak memisahkan lingkungan. Belum diimplementasikan sebagai initializer produksi otomatis.

### L2 — Menu spreadsheet lama masih bisa merusak struktur sumber stok

**Bukti:** `setup.gs:119` masih menampilkan menu legacy “Satukan Transaksi & Item”, “Format & Sinkronkan INVENTORY”, “Sinkronkan Produk ke INVENTORY”, serta purge. `setupSalesTransactionsUnifiedSheet_` di `setup.gs:316` membangun ulang data lalu `txSheet.clear()` di `setup.gs:524`, menggunakan skema18kolom lama. Sumber stok baru memerlukan20kolom. `setupInventorySheetStructure_` di `setup.gs:741` dan `syncProductsToInventory_` di `setup.gs:1534` masih menggunakan default stok500 jika saldo tidak ditemukan.

**Dampak:** salah klik Admin dapat menghilangkan pemisahan DIRECT/SALES dan asal distributor, atau menciptakan stok yang tidak berasal dari penerimaan barang. Ini jalur di luar updater additive yang sudah aman.

**Tindakan:** sebelum produksi, sembunyikan/nonaktifkan menu legacy yang mengubah/membangun ulang sumber; gunakan Perbarui Seluruh Sheet/arsip yang aman. Jangan menganggap karena fungsi berakhiranunderscore maka tidak dapat dijalankan dari menu native. Menu updater baru sendiri mempertahankan data; masalahnya menu legacy yang masih dipasang.

### L3 — Validasi dan ketahanan upload absensi/foto belum setara transaksi

**Bukti reproduksi:** `code.gs:1608` memeriksa pola tanggal saja. Upload absensi `2030-01-01` diterima; `2026-11-31` juga diterima lalu Date JavaScript menjadi1Desember. Status `Hadir Tepat Waktu` diisi statis, belum berdasarkan batas jam kerja. `code.gs:1664` appendRow lalu flush; bila flush gagal setelah append, respons gagal tetapi baris tetap ada, dan catch di `code.gs:1676` membuang file yang telah dirujuk oleh baris tersebut. Hasil tiruan mencatat1baris absensi tersimpan dengan foto dibuang.

**Dampak:** HK/absensi dapat salah tanggal dan bukti rusak pada gangguan koneksi; retry foto belum memakai idempotency request seperti transaksi.

**Tindakan:** validasi Gregorian dan larang tanggal masa depan pada server; beri aturan status waktu yang benar atau label netral bila belum ada aturan. Pisahkan kegagalan sebelum/sesudah persist, jangan hapus foto bila hasil penulisan belum pasti, dan tambahkan identitas kiriman agar retry tidak membuat baris ganda. Jangan mengubah Today's Plan yang memang boleh dijadwalkan di masa depan menjadi aturan absensi.

### L4 — Foto absensi/kunjungan masih dibuka lewat link publik Drive

**Bukti:** `code.gs:1583` memanggil `setSharing(ANYONE_WITH_LINK, VIEW)`. Ini berbeda dari bukti pengambilan/setoran yang privat dan dibaca lewat gateway. Reproduksi mengamati mode ANYONE_WITH_LINK.

**Dampak:** pembatasan login webapp tidak melindungi URL foto tersebut bila link disebar ke orang di luar aplikasi. Data akan menjadi foto staf nyata setelah launch.

**Tindakan:** gunakan berkas privat dan akses gambar terautentikasi berdasarkan catatan yang diizinkan, seperti pola bukti pengambilan. Periksa izin folder/sheet/cadangan secara nyata; jangan mengklaim ACL aman hanya karena tombol Tamu disembunyikan. Belum ada perubahan ACL Google pada review ini.

### L5 — Deployment dan data awal produksi harus benar-benar diuji

**Kondisi wajib sebelum dibagikan:** link `/exec` final, Versi baru berisi semua file yang konsisten, mode Admin input/Tamu baca, dan Tamu berhasil masuk dari perangkat/incognito **yang bukan editor Apps Script**. `/dev` hanya untuk pengujian editor dan tidak layak menjadi link tim.

Jalankan pemeriksaan transaksi tanpa missing sheet/unresolved PENDING, cek trigger arsip terpasang di proyek tujuan dan backup dapat dibuka oleh Admin. Verifikasi kalender November, master produk/harga, pasangan Senior/Junior, target, saldo pembukaan dan nol aktivitas uji di produksi. Lakukan satu alur transaksi produksi yang terkontrol dan rekonsiliasikan angkanya; jangan menyalin saldo hasil tes menjadi opening balance tanpa hitungan fisik.

## Masalah operasional yang perlu diprioritaskan

| Temuan | Bukti / dampak | Prioritas praktis |
|---|---|---|
| Login Tamu memakai limit bersama20percobaan/10menit, termasuk login berhasil | `guest-auth.gs:57`; reproduksi20login benar berhasil lalu login benar ke21ditolak. Bukan batas per perangkat. Sesi bersama maksimum50 dan refresh Tamu mengharuskan login lagi. | Sesuaikan/uji terhadap jumlah tim sebelum rollout serentak; ini perlindungan brute force yang perlu diseimbangkan, bukan dihapus tanpa pengganti. |
| Respons export menutupi kegagalan pembacaan | `code.gs:1792`, getAllTransactionsForExport_ mengembalikan success:true/data[] walau getTransactionsPaginated_ gagal; direproduksi. | Teruskan error sumber agar laporan kosong tidak dianggap nol penjualan. |
| PENDING yang tidak pernah selesai menahan kiriman baru | `transactions.gs:115`, `transactions.gs:313`; aman terhadap potong stok ganda, tetapi belum ada alur pemulihan Admin terpandu/monitor pusat. | Siapkan pemeriksaan dan prosedur pemulihan; **jangan** menghapus PENDING atau melakukan retry finansial tanpa kepastian. |
| Periode lama hanya baca dan belum ada pembukaan/koreksi periode | `monthly-archives.gs:20`; input ke bulan sebelum bulan berjalan ditolak. | Tetapkan prosedur invoice terlambat/koreksi akhir bulan. Tidak mengubah arsip diam-diam. |
| Hasil native Insentif diperbarui lewat A3/arsip, bukan setiap penjualan | `incentive-sheets.gs`, `sheet-updates.gs`; webapp menghitung dari sumber terbaru. | Jelaskan kepada Admin agar tidak menyamakan angka sheet hasil yang belum diperbarui dengan webapp real-time. |
| Akun Tamu bersama dan password memiliki salinan teks pada ACCESS_USERS | `guest-auth.gs:140`, fitur salinan password merupakan permintaan pengguna sebelumnya. | Sheet/cadangan harus Admin-only; jangan membagikan spreadsheet ke Tamu. Rotasi/revokasi sesi sudah ada. |
| Chart.js dari CDN belum dipin versinya | `index.html:14` memakai `/npm/chart.js` tanpa versi. | Pin versi yang sudah diuji untuk mencegah perubahan dependensi saat produksi. |

## Fitur yang memang belum tersedia

1. **Stok masuk gudang/penerimaan barang**, koreksi stock opname dengan alasan dan jurnal; stok saat ini dapat berkurang lewat pickup/penjualan dan kembali lewat edit, tetapi belum ada menu penerimaan barang operasional.
2. **Retur sisa pegangan sales ke distributor** sebagai transaksi tersendiri. Mengedit invoice bukan pengganti retur barang yang tidak terjual.
3. **Pembatalan/void faktur** dengan pengembalian stok yang diaudit. Edit invoice sudah ada; batal seluruh invoice bukan edit qty0.
4. **Edit/pembatalan pengambilan barang dan koreksi setoran uang**. Panduan pengambilan menyatakan belum tersedia. Setoran hanya memo, bukan bukti invoice lunas dan bukan pencapaian tambahan.
5. **Pemulihan backup/restore terpandu dan monitor kesehatan Admin**: antrian PENDING, arsip gagal, audit selisih, versi deployment, dan notifikasi kegagalan belum satu panel.
6. **Pengelolaan master produk/harga/sales di webapp** masih banyak bergantung pada sheet Admin; validasi perubahan master dan jejak koreksi perlu dikembangkan.
7. **Akun individual sales untuk input mandiri** belum mode peluncuran saat ini. Admin + satu akun Tamu sesuai keputusan awal; fitur ini bisa menyusul dan bukan syarat rollout terbatas.

AA tetap input angka manual sesuai permintaan pengguna; tidak mengusulkan kewajiban nama toko/CRM otomatis. Branding khusus tim yang memiliki target, bukan Motoris. Jangan mengubah definisi KPI/Insentif untuk mengejar kelengkapan fitur.

## Urutan kerja yang disarankan malam ini

1. Bekukan scope fitur; jangan tambah dashboard/dekorasi baru.
2. Siapkan baseline produksi terpisah dari seluruh data uji, dengan master dan opening stock diverifikasi.
3. Amankan menu native legacy; perbaiki validasi/hasil simpan foto dan kebijakan akses foto. Benahi propagasi error export yang kecil tetapi jelas.
4. Uji Tamu serentak sesuai jumlah pemakai dan pastikan `/exec` final dari perangkat non-editor.
5. Uji singkat pengambilan → penjualan sumber benar → edit sumber/retur sesuai fitur yang tersedia → memo setoran, serta Admin/Tamu dan backup. Data uji validasi akhir harus ditandai/direkonsiliasi agar bukan angka usaha palsu.
6. Setelah syarat tersebut lolos, rollout **terbatas Admin input + Tamu lihat**, dengan Admin memantau eksekusi/arsip. Stock-in/retur/void/koreksi dan pemulihan operasional diprioritaskan berikutnya sesuai aktivitas kantor nyata.

Review ini tidak menetapkan seluruh aplikasi bebas bug atau menjamin waktu selesai malam ini. Temuan yang tercantum sebagai belum diperbaiki tetap terbuka; data Google tidak dibersihkan/dihapus selama audit.
