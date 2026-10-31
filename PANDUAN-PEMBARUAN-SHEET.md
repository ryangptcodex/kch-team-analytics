> **Pembaruan terbaru:** tombol Perbarui kini juga membuat dan mengisi tiga sheet hasil Insentif. Pasang paket pada [PANDUAN-SINKRON-INSENTIF.md](PANDUAN-SINKRON-INSENTIF.md); penjelasan lama bahwa Insentif hanya membaca/tidak mempunyai sheet digantikan untuk fungsi pembaruan spreadsheet. Halaman webapp tetap hanya membaca.

# Tab Pembaruan Sheet — UJI COBA

Tab **PEMBARUAN_SHEET** dibuat di posisi paling kanan (setelah ACTIVITY_LOGS bila ACTIVITY_LOGS sebelumnya tab terakhir). Satu kontrol **checkbox A3 berlabel PERBARUI SELURUH SHEET** menjalankan pembaruan, kemudian kembali tidak dicentang. Ini checkbox yang dibuat otomatis, bukan Drawing yang harus diberi skrip secara manual.

## Pasang sekali

Di proyek Apps Script **UJI COBA** yang terikat ke spreadsheet, sebagai Gmail admin:

1. Buat file **Script** baru bernama `sheet-updates`, lalu salin seluruh [sheet-updates.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/sheet-updates.gs) lewat Raw / Copy raw file. Jangan membuatnya sebagai HTML.
2. Ganti seluruh isi Script `setup` dengan [setup.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/setup.gs).
3. Ganti seluruh isi Script `auth` dengan [auth.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/auth.gs). Tambahan ini melindungi tab kontrol/tautan cadangan dari pembacaan akun Tamu melalui webapp.
4. Simpan, muat ulang spreadsheet. Pilih menu **⚡ KCH Lhokseumawe → 🔄 Siapkan Tab Pembaruan Sheet (Aman)**. Berikan izin Google yang diminta untuk menjalankan skrip dan memasang trigger edit. Alternatif: jalankan `setupKchSheetUpdates` sekali dari editor Apps Script.
5. Tab baru terbuka. Klik checkbox **A3** untuk memperbarui seluruh struktur. Lihat Status, Terakhir diperiksa, Cadangan, dan Rincian.

Pemasang dapat dijalankan lagi: tidak menggandakan tab atau trigger dan mempertahankan status sebelumnya. Tab bernama sama yang bukan tab kontrol tidak ditimpa. Tidak perlu membuat Drawing, memasang trigger manual, atau menjalankan menu repair lama.

Untuk webapp `/exec`, terapkan **Versi baru** pada deployment UJI COBA yang sama agar auth terbaru dipakai. Untuk fungsi menu/checkbox spreadsheet, kode yang disimpan langsung digunakan tanpa deployment webapp baru.

## Pemakaian berikutnya

Setelah menerima revisi, pasang kode Apps Script terbaru dahulu, lalu klik checkbox A3. **Kode tidak diunduh/diperbarui otomatis dari GitHub.** Proses mengikuti deklarasi struktur dalam kode saat itu: TABLE_SCHEMAS, MONTHLY_TEAM_REPORT_HEADERS, TODAY_PLAN_HEADERS, WEEKLY_MEETING_HEADERS, serta header akses, Skor, receipt transaksi dan histori edit.

- Membuat sheet yang belum tersedia, tanpa data contoh. Sheet internal `_KCH_` baru disembunyikan.
- Menyisipkan kolom yang kurang pada posisi skema yang diperlukan; data/formula/format/validasi existing bergeser bersama kolom, bukan dibangun ulang dari nilainya.
- Mempertahankan kolom tambahan di bagian akhir. Tidak menghapus kolom atau sheet lama, tidak mengganti nama produk, harga, stok, akun, transaksi, AA, branding, atau hari libur.
- Menyamakan tampilan header: latar navy dan teks putih tebal. Format angka/tanggal/baris data tidak ditulis ulang.
- Mengambil script lock yang sama dengan transaksi dan menolak bila ada transaksi tertunda. Hindari mengedit struktur/data spreadsheet secara manual selama pembaruan; script lock tidak mengunci editor manual Google Sheets.
- Melakukan pemeriksaan seluruh header sebelum penulisan struktur. Header kosong/ganda/tidak kompatibel atau urutan lama yang ambigu menghentikan seluruh pembaruan; tidak menebak pemetaan data ke kolom lain. Perubahan nama/arti kolom yang kompleks perlu migrasi eksplisit di kode berikutnya.
- Membuat **salinan cadangan lengkap di Google Drive** sebelum satu batch perubahan struktur yang atomik melalui Sheets API. Jika backup gagal, struktur tidak diperbarui. Setiap klik yang lolos pemeriksaan membuat cadangan baru; kelola salinannya di Drive sesuai kebutuhan.
- Status berhasil berarti struktur sudah cocok dengan kode, bukan berarti harga/master/isi data bisnis telah divalidasi kebenarannya.

Target tetap salinan **UJI COBA** yang ID-nya dikonfigurasi. Hanya Gmail admin yang boleh memasang dan menekan kontrol. Trigger berjalan sebagai pemiliknya, tetapi identitas editor aktual juga diperiksa; akun Tamu/editor lain ditolak. Bila Google tidak menyediakan identitas editor, proses ditolak, bukan menganggapnya admin. Gunakan checkbox langsung di browser spreadsheet dengan Gmail admin. Edit sel oleh skrip tidak memicu trigger edit lagi.

Jika status gagal, baca Rincian. Bila cadangan sudah tersedia, URL ditampilkan. Pada gangguan koneksi saat batch dikirim, periksa struktur lalu klik ulang: penambahan bersifat idempoten sehingga tidak membuat kolom ganda. Jangan menjalankan repair/reset sebagai jalan pintas. Pemasangan ini tidak mengubah kalender otomatis atau harga/master mengikuti contoh kode.

## Validasi

**217 tes Node lulus** (209 regresi + 8 tes pembaruan): penyisipan kolom tengah dengan formula/data tambahan tetap, klik ulang tanpa duplikasi, seluruh registry skema, header ambigu berhenti sebelum mutasi, backup sebelum batch, kegagalan backup/transaksi/batch, pembatasan editor/target, proteksi Tamu, serta pemasangan ulang tab/trigger.

Pengujian menggunakan layanan Google tiruan. Agen belum memasang tab, membuat cadangan nyata, atau memverifikasi trigger/izin di Google pengguna. Setelah menyalin kode, uji satu klik di UJI COBA, pastikan Status Berhasil dan salinan cadangan tersedia di Drive; klik lagi untuk memastikan tidak ada sheet/kolom ganda.

Jika editor menampilkan **Tidak ada fungsi** pada file lama, ganti isi sheet-updates.gs dengan versi terbaru, Simpan dan reload editor. Fungsi pemasangan publik **setupKchSheetUpdates** tersedia di dropdown Jalankan; fungsi internal berakhiran underscore dipertahankan untuk kompatibilitas.

## Tambahan pengambilan barang

Paket pengambilan menambahkan modul `stock-pickups.gs` dan pembaruan `sheet-updates.gs`. Setelah seluruh paket dipasang, tombol yang sama menambahkan **SALES_STOCK**, **SALES_STOCK_MOVEMENTS**, **STOCK_PICKUPS**, serta kolom **stock_source/stock_distributor_id** pada SALES_TRANSACTIONS. Data lama dipertahankan; sumber kosong pada faktur lama tetap langsung distributor. Saldo pegangan tidak direset dan tidak diisi dari penjualan lama. Lihat [panduan pengambilan](PANDUAN-PENGAMBILAN-BARANG.md) untuk sembilan file dan uji transfer tanpa omzet.

Tambahan widget **Setoran Pegangan Sales** menggunakan registry modul pengambilan yang sama. Setelah `stock-pickups.gs` terbaru disimpan, Perbarui Seluruh Sheet juga menambah **SALES_CASH_DEPOSITS** dan mempertahankan memo lama. Nominal setoran adalah catatan uang, bukan input penjualan/pencapaian atau mutasi stok.
