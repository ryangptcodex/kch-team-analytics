# Paket Skor — Motoris dan MMTW

Dikembangkan di cabang **uji-login**, 27 Oktober 2026. Paket ini menambah menu **Skor** tanpa mengganti fitur transaksi, edit transaksi, stok, login, atau absensi yang sudah ada. Pemasangan dilakukan pada proyek Apps Script yang terikat ke spreadsheet **KCH Analytics - UJI COBA**.

## File lengkap yang dipasang

Buka tiap tautan → **Raw / Copy raw file** → salin **seluruh isi**, bukan hanya potongan perubahan.

| File di GitHub | Tindakan di editor Apps Script UJI COBA |
| --- | --- |
| [score.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/score.gs) | **Baru**: tombol **+ → Script**, beri nama `score`, tempel seluruh isi. Editor menambahkan `.gs`. |
| [score-client.html](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/score-client.html) | **Baru**: tombol **+ → HTML**, beri nama `score-client`, tempel seluruh isi. |
| [auth.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/auth.gs) | Ganti seluruh isi file Script `auth` yang sudah ada. |
| [index.html](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/index.html) | Ganti seluruh isi file HTML `index`. |
| [js.html](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/js.html) | Ganti seluruh isi file HTML `js`. |

Pasang **kelima file bersama-sama** sebelum membuka aplikasi. Biarkan `code.gs` (atau `Kode.gs`), `setup.gs`, `transactions.gs`, `transaction-edits.gs`, `firebase-config.gs`, `auth-client.html`, `auth-ui.html`, `css.html`, dan `appsscript.json` versi terbaru yang sudah terpasang tetap ada. Paket Skor memakai helper Google Sheets API dari `transactions.gs`; paket transaksi dan edit sebelumnya harus sudah terpasang lengkap.

Jangan menyalin folder tests/tools/docs atau panduan ke editor Apps Script. Tidak perlu mengaktifkan API baru, mengubah manifest, menekan **Perbarui Sheet**, menjalankan repair, atau menghapus data Oktober.

## Simpan dan buka aplikasi

1. Pastikan editor yang dibuka milik salinan **UJI COBA**.
2. Setelah memasang lima file, klik **Simpan**.
3. Untuk `/dev`: muat ulang tab aplikasi.
4. Untuk `/exec`: **Terapkan → Kelola deployment → pilih deployment UJI COBA yang sudah ada → ikon pensil → Versi baru → Terapkan**, lalu muat ulang URL `/exec` yang sama. Tidak perlu membuat URL deployment lain.
5. Masuk sebagai admin, lalu buka menu sidebar **Skor**. Pilih sales Motoris/MMTW dan bulan penilaian.

Agen tidak memasang atau melakukan deployment ke Google dari workspace ini. Keberhasilan pengujian lokal bukan bukti bahwa versi terbaru sudah terpasang di Google.

## Pemetaan master yang dipakai

Kode dan nama berikut dikonfirmasi pengguna dari sheet `PRODUCTS`. Klasifikasi memakai **kode produk**, bukan nama lama yang tersimpan pada faktur.

| Kode | Nama master | Kelompok |
| --- | --- | --- |
| LBMAV | Bejo Jahe Merah | Fokus A |
| LKXOD | Komix Herbal Sachet Original | Fokus B |
| LKXJA | Komix Herbal Sachet Jahe | Fokus B |
| LKXPA | Komix Herbal Sachet Peppermint | Fokus B |
| LKXNA | Komix Herbal Sachet Jeruk Nipis | Fokus B |
| LKXOB | Komix Herbal Tube Original | Fokus B |
| LKXLA | Komix Herbal Tube Lemon | Fokus B |
| LKXKA | Komix Herbal Kids | Total Value saja, bukan Fokus B (revisi 28 Oktober 2026) |
| LPRGQ | Promag Herbal | Fokus B |
| LPRGN | Promag Tablet | Dikecualikan dari omzet KPI |

Fokus A dan Fokus B **tetap masuk omzet KPI keseluruhan**. Produk lain masuk omzet saja, termasuk varian Promag lain yang tidak ada dalam daftar fokus/pengecualian di atas. Pada faktur campuran, hanya subtotal baris `LPRGN` yang dibuang; nilai baris produk lain tetap dihitung.

Bagian **Pemetaan kode produk · khusus admin** memperlihatkan kode, nama master aktual, dan kelompoknya. Tidak ada langkah konfirmasi tambahan. Aplikasi memeriksa master saat memuat laporan. Kode wajib yang hilang, kode ganda, nama yang tidak sesuai, nama produk yang sama memakai kode lain, atau produk transaksi yang hilang dari master menghasilkan pesan pemeriksaan; angka skor tidak ditampilkan sebagai hasil sah. Perubahan nama yang hanya berbeda kapitalisasi/tanda baca atau tambahan keterangan kemasan di belakang nama tetap didukung.

## Perhitungan

| Parameter | Target bulanan | Bobot | Skor maksimal |
| --- | ---: | ---: | ---: |
| Fokus A | Rp5.000.000 | 40% | 40 |
| Fokus B | Rp5.000.000 | 25% | 25 |
| Total Value (non Promag Tablet) | Rp27.000.000 | 25% | 25 |
| AA | 400 | 10% | 10 |

- Pencapaian = aktual / target.
- Jumlah poin = bobot desimal × pencapaian × 100.
- Skor parameter = MIN(jumlah poin, skor maksimal parameter).
- Total = jumlah skor asli, **tanpa ROUND**. Angka tampilan boleh dibulatkan.
- Total asli <40: **EVALUASI**; ≥40 dan <60: **DISPENSASI LANJUT**; ≥60: **LANJUT BULAN BERIKUTNYA**.
- Nama bulan berikutnya mengikuti bulan yang dipilih, termasuk Desember → Januari tahun berikutnya. Angka tampilan 40 masih bisa berkategori EVALUASI bila nilai aslinya di bawah 40.

Target selalu **sebulan penuh**, tidak diprorata berdasarkan tanggal pembukaan. Penjualan dibaca dari baris transaksi pada bulan dan sales terpilih, tanpa harga master terbaru menggantikan nilai faktur. Transaksi masa depan diabaikan. Setelah transaksi diedit, tekan **Muat ulang** pada Skor untuk membaca nilai/periode terbaru; tidak ada salinan skor lama yang disimpan.

Kalender menghitung Senin–Sabtu, mengurangi tanggal pada sheet `HOLIDAYS` (atau alias lama `HARI_LIBUR`/`LIBUR`). Minggu/libur yang sama tidak dikurangi dua kali. Kalender memakai bulan penilaian; batas hari berjalan memakai zona **Asia/Jakarta**. Pastikan daftar tanggal merah nasional/Aceh dalam sheet lengkap untuk periode tersebut. Isi tanggal dan nama libur saja (`date`, `holiday_name`); tidak perlu menjalankan repair. Jika sheet belum tersedia, halaman menyatakannya dan kalender hanya mengurangi Minggu. Kalender ini informasi hari kerja, bukan pengurang target dan bukan pembatas AA aktual yang sah pada hari libur.

## Input AA harian

1. Masuk sebagai admin (**ADMIN** di ACCESS_USERS, label tampilan TEAM LEADER).
2. Buka **Skor**, pilih sales dan bulan, lalu pilih tanggal di bagian AA.
3. Masukkan total AA yang sudah diperiksa untuk sales/tanggal itu. Isi **0** bila memang tidak ada AA; tanda **—** berarti belum diinput.
4. Klik **Simpan AA**. Menyimpan ulang tanggal/sales yang sama **mengganti angka harian**, bukan menambah angka lama.

AA tidak dihitung dari faktur, absensi, atau foto. Admin menentukan satu toko satu kali per hari; transaksi lagi besok dihitung lagi. Kunjungan tanpa transaksi dan transaksi hanya Promag Tablet tidak dihitung. Jika edit transaksi mengubah kelayakan AA suatu hari, admin perlu memeriksa dan mengoreksi angka AA hari itu secara manual. Aplikasi tidak menyimpan nama/kode toko untuk fitur ini.

Angka harus bilangan bulat nonnegatif; tanggal masa depan, sales bukan Motoris/MMTW, dan input untuk sales nonaktif ditolak server. Sales dapat melihat skor dan AA miliknya, tetapi tidak dapat menulis AA atau membuka skor sales lain, termasuk lewat pemanggilan API langsung.

Sheet baru **SKOR_EVENTS** dibuat otomatis **saat AA pertama disimpan**, melalui batch Google Sheets API yang menulis header dan histori bersama-sama. Tidak perlu membuat sheet ini manual. Histori menyimpan angka AA, sales, tanggal, revisi sebelumnya, serta identitas admin dan waktu. Jangan menghapus/mengurutkan/mengedit baris histori secara manual. Tidak ada penulisan ke stok, faktur, atau data Google lain saat input AA.

Bila koneksi putus dan hasil belum pasti, formulir dikunci dan tombol menjadi **Periksa / ulangi simpan**. Klik tombol itu: kode kiriman dan angka asli tetap dipakai, sehingga kiriman yang sudah tersimpan tidak dihitung dua kali. Bila data sudah diubah admin lain, aplikasi meminta **Muat ulang** sebelum input lagi. Histori yang bercabang atau rusak ditolak untuk diperiksa admin; aplikasi tidak memilih salah satu hasil secara diam-diam. Penulis manual/proyek Apps Script lain tidak mengikuti ScriptLock aplikasi ini.

## Pemeriksaan pada UJI COBA

- Buka akun admin: sidebar Skor tersedia; pilihan hanya Motoris/MMTW; kode dan nama master cocok dengan daftar di atas.
- Pilih bulan tanpa transaksi/input: aktual 0 dan AA harian —. Target tetap 5 juta / 5 juta / 27 juta / 400.
- Rekonsiliasi subtotal faktur campuran: Promag Tablet saja dikeluarkan; Promag Herbal dan Fokus A/B tetap masuk omzet.
- Input AA 10 untuk satu tanggal, lalu koreksi menjadi 12: total bulan bertambah 12, bukan 22. Hari berikutnya 7 menghasilkan total 19. Input ini dilakukan pada **salinan UJI COBA**, bukan spreadsheet asli.
- Pilih bulan lain: tidak membawa transaksi atau AA bulan sebelumnya. Desember menyebut Januari tahun berikutnya.
- Masuk sebagai sales Motoris/MMTW: hanya datanya sendiri; formulir admin tidak tampil. Sales tim lain mendapat penjelasan bahwa Skor hanya untuk Motoris/MMTW.
- Setelah mengedit transaksi percobaan melalui fitur edit yang sudah ada, muat ulang Skor dan cocokkan perubahan aktual. Periksa juga bahwa stok serta riwayat transaksi tetap benar.

Insentif dan branding tidak termasuk paket ini.

## Hasil pengujian pengembangan

`node --test tests/*.test.cjs` → **167 lulus, 0 gagal, 0 dilewati** (139 tes lama + 28 tes Skor). Memeriksa pemetaan kode, seluruh produk Fokus B, faktur campuran, batas skor/kategori tanpa pembulatan, kalender libur, bulan/tahun, input/koreksi/replay AA, konflik revisi, akses sales, race permintaan halaman, dan perhitungan ulang setelah create/edit transaksi.

Chromium dengan HTML/JS aplikasi dan layanan Google tiruan lulus pada lebar **1440, 390, 320px**, tanpa overflow halaman. Pemeriksaan mencakup input/koreksi AA, respons hilang + kirim ulang dengan ID sama, pergantian periode, reset sesi, dan tampilan akun sales. Pratinjau memakai **data simulasi**, bukan data Google pengguna: [desktop](docs/skor-1440.png), [HP](docs/skor-390.png).

Pemeriksaan browser opsional dapat diulang melalui `node tools/score-ui-check.cjs` jika Playwright dan Chromium tersedia. Jalur Chromium default `/usr/bin/chromium`, dapat diatur dengan `CHROMIUM_PATH`. Suite Node utama tidak memerlukan paket npm tambahan. Seluruh pemeriksaan ini belum menggantikan uji deployment Google nyata di atas.
