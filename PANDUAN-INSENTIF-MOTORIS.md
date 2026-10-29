> **Pembaruan terbaru:** tombol Perbarui kini juga membuat dan mengisi tiga sheet hasil Insentif. Pasang paket pada [PANDUAN-SINKRON-INSENTIF.md](PANDUAN-SINKRON-INSENTIF.md); penjelasan lama bahwa Insentif hanya membaca/tidak mempunyai sheet digantikan untuk fungsi pembaruan spreadsheet. Halaman webapp tetap hanya membaca.

# Insentif Motoris/MMTW

Menu sidebar **Insentif**, tepat setelah Skor, menampilkan insentif harian, parameter bulanan, dan bonus triwulan per sales. Motoris dan MMTW memakai aturan sama. MPR/Canvasser dan tim lain belum dimasukkan karena juklaknya belum diberikan. Admin dan Tamu dapat melihat seluruh sales yang memenuhi kelompok tim; halaman ini tidak memiliki operasi input/pencairan/penulisan data.

## Pasang lima file lengkap ke UJI COBA

Gunakan **Raw / Copy raw file**, lalu salin seluruh isi:

| File | Jenis/tindakan di Apps Script |
| --- | --- |
| [incentives.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/incentives.gs) | **BARU Script `incentives`**, bukan HTML. |
| [incentive-client.html](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/incentive-client.html) | **BARU HTML `incentive-client`**. |
| [auth.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/auth.gs) | Ganti Script `auth` seluruhnya; menambah dua endpoint baca pada whitelist Admin/Tamu. |
| [index.html](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/index.html) | Ganti HTML `index` seluruhnya; menu, widget dan include baru. |
| [js.html](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/js.html) | Ganti HTML `js` seluruhnya; state/reset sesi, navigasi dan subtitle. |

Pasang bersama lalu **Simpan**. Tetap pertahankan semua file Skor/login/transaksi/edit/CSS/setup yang sudah ada; modul insentif menggunakan helper Skor yang ada, tanpa mengubah perhitungan Skor.

- `/dev`: refresh halaman sebagai admin/editor.
- `/exec`: **Terapkan → Kelola deployment → ikon pensil → Versi baru → Terapkan**, kemudian refresh URL yang sama. Gunakan `/exec` untuk Tamu tanpa Gmail.
- Tidak perlu sheet baru, repair, klik Perbarui Sheet, menyalin data, atau menginput ulang AA. Halaman hanya membaca data yang ada.

## Aturan yang disepakati

Total Value berasal dari transaksi, menggabungkan seluruh faktur/baris produk per sales per tanggal. Produk fokus tetap masuk Total Value; **hanya baris LPRGN Promag Tablet yang dikecualikan**, termasuk pada faktur campuran. Fokus A/B memakai pemetaan Skor terbaru: LBMAV Bejo; enam varian Komix Herbal Family + LPRGR Promag Herbal. Kids tetap Total Value biasa, bukan Fokus B.

### Harian

| Total Value per hari | Satu tarif yang diterima |
| --- | ---: |
| <Rp800.000 | Rp0 |
| ≥Rp800.000 dan <Rp1.000.000 | Rp10.000 |
| ≥Rp1.000.000 dan <Rp1.200.000 | Rp20.000 |
| ≥Rp1.200.000 dan ≤Rp1.500.000 | Rp30.000 |
| >Rp1.500.000 | Rp50.000 |

**Rp1.500.000 tepat = Rp30.000; Rp1.500.001 = Rp50.000.** Tarif tidak ditumpuk antar tingkat. Sepuluh faktur pada hari yang sama tetap menghasilkan satu tarif berdasarkan jumlah Total Value hari tersebut.

Insentif dijumlah sesuai hari kerja yang menghasilkan penjualan memenuhi ambang, tanpa plafon tetap 25 hari/Rp1,25 juta. Contoh 26 HK yang masing-masing di atas Rp1,5 juta menghasilkan **Rp1.300.000**. Hari kerja Senin–Sabtu dikurangi tanggal libur pada HOLIDAYS (atau alias yang juga dikenali Skor). Tidak ada insentif harian untuk Minggu/tanggal libur; nilai transaksinya tetap masuk Total Value bulanan/triwulan agar konsisten dengan Skor. Tidak mengambil jumlah hadir/kunjungan sebagai penjualan atau menambahkan syarat absensi baru.

Kalender libur harus diisi sesuai nasional/lokal. Jika sheet kalender sama sekali belum ada, harian ditandai **Belum dapat dihitung**, bukan menganggap tidak ada tanggal merah. Target bulanan tetap sebulan penuh. Tanggal masa depan tidak menghasilkan insentif; barisnya ditandai Belum berjalan.

### Bulanan

| Parameter | Target | Tarif 90% | Tarif 100% | Tarif 110% |
| --- | ---: | ---: | ---: | ---: |
| Fokus A Bejo | Rp5.000.000 | Rp200.000 | Rp400.000 | Rp500.000 |
| Fokus B Komix Herbal Family + Promag Herbal | Rp5.000.000 | Rp125.000 | Rp250.000 | Rp312.500 |
| Total Value non Promag Tablet | Rp27.000.000 | Rp125.000 | Rp250.000 | Rp312.500 |
| AA | 400 outlet | Rp50.000 | Rp100.000 | Rp125.000 |
| **Jika semua mencapai tingkat tersebut** | | **Rp500.000** | **Rp1.000.000** | **Rp1.250.000** |

Setiap parameter memakai pencapaiannya sendiri, tanpa interpolasi atau pembulatan pencapaian untuk memilih tingkat:

- <90%: Rp0.
- ≥90% dan <100%: tarif 90%.
- ≥100% dan <110%: tarif 100%.
- ≥110%: tarif maksimal 110%, tidak bertambah lagi di atasnya.

**Revisi pengguna: Total Value bulanan di bawah 70% target (Rp18.900.000) membayar 50% dari hasil tarif harian dan parameter bulanan A–D, bukan nol. Tepat 70% atau lebih membayar 100% tarif harian dan bulanan.** Pilih dahulu tangga tiap parameter, lalu kalikan hasilnya dengan faktor 0,5 atau 1. Tabel menampilkan tarif sebelum penyesuaian dan nilai yang dapat diklaim sesudahnya. Parameter di bawah 90% tetap nol. Penyesuaian berlaku untuk harian dan bulanan; hanya bonus triwulan tidak dipotong. Contoh hasil tarif bulanan Rp625.000 dan TV kurang dari 70% menghasilkan Rp312.500.

AA dijumlah dari input harian admin di SKOR_EVENTS yang sama dengan Skor, bukan faktur/absensi. Hari AA yang belum diinput belum menambah aktual; jumlah hari input ditampilkan agar kekurangan data terlihat. Tidak ada branding untuk Motoris/MMTW berdasarkan juklak ini.

### Triwulan kalender tetap

TW1 Januari–Maret; TW2 April–Juni; TW3 Juli–September; TW4 Oktober–Desember. Bulan yang dipilih menentukan triwulan tersebut. Target akumulasi tiga bulan **Rp81.000.000**, penuh, tidak dipotong mengikuti tanggal laporan.

| Bulan yang masing-masing mencapai ≥100% target Rp27 juta | Akumulasi ≥100%–<110% | ≥110%–<120% | ≥120% |
| --- | ---: | ---: | ---: |
| 3 bulan | Rp2.000.000 | Rp2.100.000 | Rp2.200.000 |
| 2 bulan | Rp1.000.000 | Rp1.050.000 | Rp1.100.000 |
| 1 bulan | Rp500.000 | Rp525.000 | Rp550.000 |

Akumulasi <100% tidak mendapat bonus. Nilai tepat batas diterima pada tingkat tersebut; pencapaian tidak dibulatkan sebelum dibandingkan. Tabel menampilkan aktual/target tiap bulan, jumlah bulan yang mencapai target, akumulasi dan tingkat triwulan. Insentif triwulan ditampilkan **terpisah**, tidak ditambahkan ke total setiap bulan agar satu bonus tidak dihitung tiga kali.

## Pembacaan dan batas hasil

- Kartu **Total harian + bulanan** hanya menjumlah harian dan parameter bulanan pada bulan dipilih. Bonus triwulan adalah kartu terpisah.
- Periode berjalan/belum selesai diberi label **Estimasi**. Periode dianggap selesai setelah hari terakhir bulan/triwulan berlalu; pembaruan transaksi atau koreksi AA historis masih bisa mengubah hasil saat Muat ulang. Ini perhitungan, bukan persetujuan atau bukti pencairan.
- Memilih sales/bulan atau menekan Muat ulang mengambil data terbaru; respons periode/akun lama tidak boleh menimpa hasil terbaru. Logout membersihkan state dan tabel.
- Seluruh data report diambil dari satu snapshot metadata + batch read, memakai perhitungan aktual yang sama dengan Skor. Tidak menulis sheet rekap/keuangan, mengubah harga, membuat transaksi atau mengganti stok.
- Master produk/histori yang tidak valid menampilkan error dan membersihkan angka lama; tidak mengarang insentif nol. Profil nonaktif tetap dapat dibaca untuk histori dengan tanda nonaktif; akun login sales lama tetap tidak diizinkan.

## Pengujian

**259 tes Node lulus**, termasuk 20 tes baru Insentif: semua batas harian; penggabungan faktur/mixed invoice; 26 HK tanpa cap; Minggu/libur; seluruh tangga bulanan kedua tim; syarat 70% tepat/bawah; AA manual; kalender triwulan/year transition; sembilan kombinasi payout triwulan dan batas tanpa ROUND; future exclusion; akses read-only; kecocokan Skor/edit transaksi; loading/error/stale responses/escaping.

Chromium memakai produksi HTML/JS/engine dengan layanan Google tiruan: payout harian/bulanan/triwulan, pemisahan total, pilihan sales/bulan, tahun baru, mapping invalid, tanpa mutasi bisnis, reset sesi, dan viewport2560/1920/1440/1024/768/390/320. Lebar efektif2560 mewakili ruang layout layar1920 pada zoom75%, bukan kendali menu zoom native Chrome. Browser login Tamu tanpa Gmail, all-team Skor/Insentif, hak baca dan perpindahan Admin/Tamu juga lulus.

Belum dipasang atau diperiksa pada spreadsheet/deployment Google nyata oleh agen. Setelah memasang, cocokkan satu hari Rp1.500.000 vs Rp1.500.001, satu parameter bulanan, input AA, kalender HOLIDAYS dan tiga bulan dalam triwulan dengan transaksi asli.

## Paket revisi faktor 50% bulanan

Jika menu Insentif sudah terpasang, cukup ganti seluruh isi **incentives.gs, incentive-client.html, dan index.html**. Simpan/refresh dev atau update versi exec sama. Tidak perlu auth/js baru, repair, pembaruan sheet, atau input ulang. Aturan sebelumnya TV<70% membayar nol telah digantikan aturan50% ini.

## Koreksi terakhir: 50% juga berlaku untuk harian

Pengguna memperluas aturan pada 29 Oktober 2026: pencapaian Total Value **bulanan** <70% menghasilkan pembayaran **50% insentif harian dan bulanan**; >=70% menghasilkan 100%. Bonus **triwulan tetap penuh sesuai skemanya**, tanpa faktor potongan ini. Aturan ini menggantikan catatan versi sebelumnya yang hanya memotong bulanan. Tarif dasar harian/tangga bulanan tidak berubah. Rincian harian sekarang memperlihatkan tarif sebelum faktor dan insentif dibayar sesudah faktor. Contoh tarif harian terkumpul Rp110.000 dan TV bulanan di bawah70% → dibayar Rp55.000. Pemotongan sekali, tidak dipotong kembali pada kartu total harian+bulanan atau saat Muat ulang.

Paket tetap tiga file: incentives.gs, incentive-client.html, index.html. Simpan/refresh dev atau perbarui Versi baru pada exec yang sama. **259 tes lulus**, termasuk daily mixed tiers, batas tepat70%, reload tanpa potongan ganda, dan triwulan tetap.

## Penyajian gabungan yang disepakati terakhir

Rumus utama adalah **(insentif harian sebelum penyesuaian + insentif bulanan sebelum penyesuaian) × faktor pembayaran**. Faktor50% untuk TV bulanan<70%, faktor100% untuk TV bulanan>=70%. Server menghitung total diterima langsung dari subtotal gabungan ini; rincian harian/bulanan diterima adalah pembagian proporsionalnya, bukan potongan kedua. Bonus triwulan tetap terpisah.

Halaman menampilkan rumus lengkap sebelum/sesudah serta rincian diterima. Contoh harian50.000 + bulanan625.000 = subtotal675.000; dibawah70% mendapat675.000×50%=337.500. Rincian diterima harian25.000 + bulanan312.500 =337.500. Kartu harian/bulanan kini diberi judul **diterima** agar tidak tertukar dengan nilai sebelum penyesuaian. Tepat70% dibayar penuh seperti kesepakatan sebelumnya.

Paket pengganti tetap **incentives.gs, incentive-client.html, index.html**; Simpan/refresh dev atau update versi exec yang sama. **261 tes lulus** termasuk rekonsiliasi total gabungan dan rincian diterima serta batas tepat70%.
