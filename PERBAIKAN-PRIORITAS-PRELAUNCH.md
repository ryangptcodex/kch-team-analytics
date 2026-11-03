# Perbaikan prioritas sebelum launch — R2

Release **KCH-PRELAUNCH-2026-11-03-R2**. Keenam temuan pada audit source5c69964 telah diperbaiki dalam kode dan pengujian lokal. Belum diterapkan agen ke Google. Tidak ada perubahan nominal juklak, keputusan HK atau saldo awal.

## Pasang 13 file lengkap

Paket sebelumnya sudah harus terpasang. Untuk pembaruan R2, ganti **seluruh isi**13file berikut pada proyek Apps Script Production yang sama. Semua file sudah ada; tidak ada nama file baru. Klik masing-masing nama untuk membuka kode lengkap.

| File | Jenis di editor | Penanda awal isi |
|---|---|---|
| [auth.gs](auth.gs) | Script | Komentar backend (`//` atau `/**`) |
| [canvasser-incentives.gs](canvasser-incentives.gs) | Script | Komentar backend (`//` atau `/**`) |
| [code.gs](code.gs) | Script | Komentar backend (`//` atau `/**`) |
| [health.gs](health.gs) | Script | Komentar backend (`//` atau `/**`) |
| [incentive-client.html](incentive-client.html) | HTML | `<script>` |
| [incentives.gs](incentives.gs) | Script | Komentar backend (`//` atau `/**`) |
| [index.html](index.html) | HTML | `<!DOCTYPE html>` |
| [operations-client.html](operations-client.html) | HTML | `<script>` |
| [operations-ui.html](operations-ui.html) | HTML | `<section` |
| [operations.gs](operations.gs) | Script | Komentar backend (`//` atau `/**`) |
| [period-masters.gs](period-masters.gs) | Script | Komentar backend (`//` atau `/**`) |
| [score-client.html](score-client.html) | HTML | `<script>` |
| [score.gs](score.gs) | Script | Komentar backend (`//` atau `/**`) |

Jika backend lama tampil sebagai **Kode.gs**, ganti seluruh isi file backend tersebut memakai `code.gs` di atas. Cukup satu salinan fungsi backend; jangan membuat file kedua berisi fungsi yang sama. Isi `.gs` disalin ke Script, isi `.html` ke HTML. Tautan membuka file lengkap agar tidak perlu mencari baris kode.

1. Selesaikan/periksa input yang masih berjalan. Simpan salinan kode yang sedang digunakan. Jangan memasang sebagian file lalu menguji halaman di tengah pemasangan.
2. Ganti semua13file sesuai nama dan jenisnya, lalu **Simpan semuanya**.
3. Di spreadsheet Production, jalankan **PEMBARUAN_SHEET → A3 PERBARUI SELURUH SHEET**. Tunggu status sukses. Ini memperbarui snapshot aturan/kalender bulan berjalan dan laporan turunan secara aman. Jangan menjalankan reset, inisialisasi atau saldo pembukaan lagi.
4. **Terapkan → Kelola deployment → Edit → Versi baru → Terapkan**, pada deployment Production yang sama. Buka kembali `/exec`, muat ulang dan login Admin.
5. Buka **Monitor Admin** (judul halaman **Monitor & Pemulihan**). Pastikan release R2 sesuai, baca peringatan periode/struktur/saldo/pending dan waktu backup/laporan terakhir. Bila meminta bantuan, cukup kirim screenshot halaman itu; tidak perlu menyalin kode.

## Yang berubah

| Prioritas | Temuan | Perbaikan dan bukti |
|---|---|---|
| 1 | L06 opname basi | Form menampilkan saldo sistem, hasil hitung dan selisih dari pratinjau server. Commit wajib membawa revisi; perubahan saldo/mutasi/target/akun menolak hitungan lama. Saldo berubah lalu kembali ke angka sama juga tidak menghidupkan pratinjau lama. Replay tetap sekali. Unit + browser menguji penjualan intervening, penolakan, hitung ulang dan commit. |
| 1 | L03 master merusak kalkulator | Perubahan nama produk terikat Skor ditolak sebelum commit jika memutus pemetaan; kode alias kanonik ganda dan kode lain yang memakai nama produk terikat ditolak. Ekstensi nama valid tetap diterima. Stok dan master tidak berubah pada penolakan. |
| 2 | L01 aturan histori | Kalkulator membaca pemetaan produk, loading, pasangan Senior/Junior dan kebijakan nominal dari snapshot per bulan. Implementasi rumus V1/tarif/target/bobot/rate/faktor/bonus memiliki identitas versi tetap. Versi tidak didukung tidak diberi nominal final. Target dashboard/laporan lama memakai nilai tangkapan, bukan helper target sekarang. Bonus kuartal yang melintasi kebijakan berbeda tidak diberi nominal tebakan. |
| 2 | L02 kalender hilang | Snapshot menyimpan bukti keberadaan sumber, jumlah dan digest tanggal kalender. Kalender kosong yang ditangkap secara eksplisit sah; kalender hilang atau kosong legacy tanpa bukti tetap belum terverifikasi, dengan nominal harian/bulanan ditampilkan kosong. |
| 3 | L04 monitor saldo | Rekonsiliasi menelusuri union ledger+saldo dua arah sehingga saldo positif yang barisnya hilang tetap terdeteksi. Sheet saldo hilang dan referensi master yatim menjadi masalah. Gudang dibandingkan per distributor jika receipt mempunyai saldo rincian; cakupan legacy yang perlu bukti fisik dinyatakan jelas. |
| 3 | L05 sales historis | Setup Skor/Insentif menerima bulan; perubahan bulan memuat ulang dropdown dari roster periode itu. Sales yang sekarangSPR tetap dapat dipilih pada bulan ketika ia masihMotoris. Hak menulis dan pengaman periode tetap diperiksa server. |

Tambahan pemasangan: kegagalan include HTML menyebut nama file yang perlu diperiksa. Halaman gagal render tidak lagi menampilkan isi backend mentah. Jenis file Script/HTML tetap harus cocok.

## Perlakuan data lama

Snapshot lama yang kosong dan tidak mencatat bukti kalender bisa berubah menjadi **belum terverifikasi**. Ini bukan data transaksi hilang. A3 memperbarui bulan berjalan; bulan tutup yang sudah valid tidak ditimpa otomatis.

Untuk melengkapi snapshot lama yang belum dapat disahkan, gunakan **Kelola Master → Pengaturan tambahan: laporan bulan lama**. Pilih arsip/cadangan terdaftar, periksa master dan kalender bulan yang dimaksud, isi alasan serta konfirmasi ketik. Sumber tanpa kalender atau versi aturan yang tidak didukung ditolak. Periode yang valid dan sudah disahkan tetap tidak dapat ditimpa. Salinan formula/rules sumber dipertahankan saat tersedia; fallback legacy hanya memakai implementasi V1 yang diketahui, bukan konstanta baru secara diam-diam.

Label `SELESAI` pada hasil arsip legacy tidak menjadi bukti bahwa sumber kalender lengkap. Monitor memperingatkan periode yang sumbernya belum dapat disahkan. Angka final arsip lama tidak ditulis ulang otomatis; bandingkan sumber sebelum digunakan untuk pembayaran. Kebijakan bisnis periode tutup dan transaksi asli tetap dipertahankan.

Untuk opname, masukkan jumlah fisik secara eksplisit (termasuk0bila kosong), tekan **Periksa saldo & selisih opname**, cocokkan angka lalu simpan. Jika ada transaksi baru, periksa/hitung ulang. Pengaman bersifat konservatif: mutasi lain pada tabel saldo/mutasi juga bisa meminta pratinjau ulang.

## Validasi

- `node --test tests/*.test.cjs`: **510lulus,0gagal**, termasuk21regresi baru pada `tests/prelaunch-fixes.test.cjs`.
-8suite browser lulus: photo, guest, stock, archive, score, incentive, responsive, audit. HTML/JS asli dengan backend Google simulasi. Audit UI mencakup penolakan opname basi → hitung ulang → commit, dan pergantian bulan yang mengembalikan sales historis di dropdown Skor/Insentif. Audit UI diulang setelah perubahan akhir.
- Responsive:20view,12transisi viewport,4grafik Chart.js nyata. Login/isolasi sesi, input/bukti/foto privat, retur/koreksi dan pemulihan tetap lulus.
- Semua19file Apps Script lolos parse; manifest JSON valid; pemeriksaan whitespace bersih. Hash13file source ada di `docs/prelaunch-r2-source-sha256.txt`.

Tes lokal tidak mengukur latensi/kuota Google nyata. Pemasangan, izin, jadwal trigger, versi `/exec`, isi sheet dan backup Production masih harus dibuktikan lewat monitor serta transaksi usaha nyata berikutnya. Tidak perlu transaksi fiktif atau restore Production untuk uji. Agen tidak mengubah data Google dalam pekerjaan ini.
