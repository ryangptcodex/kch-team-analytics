# Insentif MPR/Canvasser dan Junior/Asisten

Aturan ini ditambahkan ke menu Insentif yang sudah ada. **Nama tim dalam master dan tampilan tetap**: MPR, Canvasser, Junior Canvasser dan Asisten MPR. Aturan Motoris/MMTW dipertahankan.

## Pemasangan delapan file lengkap di UJI COBA

Raw / Copy raw file → salin seluruh isi file:

| File | Jenis/tindakan |
| --- | --- |
| [canvasser-incentives.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/production/canvasser-incentives.gs) | **BARU Script** `canvasser-incentives`, bukan HTML. Memuat loading, pasangan, dan alokasi Junior. |
| [incentives.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/production/incentives.gs) | Ganti Script `incentives`. |
| [incentive-sheets.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/production/incentive-sheets.gs) | Ganti Script `incentive-sheets`. |
| [score.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/production/score.gs) | Ganti Script `score`; koreksi Promag Herbal menjadi LPRGR. |
| [sheet-updates.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/production/sheet-updates.gs) | Ganti Script `sheet-updates`; dependency modul dan preservasi lebar kolom saat migrasi. |
| [incentive-client.html](https://github.com/ryangptcodex/kch-team-analytics/blob/production/incentive-client.html) | Ganti HTML `incentive-client`. |
| [index.html](https://github.com/ryangptcodex/kch-team-analytics/blob/production/index.html) | Ganti HTML `index`. |
| [js.html](https://github.com/ryangptcodex/kch-team-analytics/blob/production/js.html) | Ganti HTML `js`. |

Pasang bersama, **Simpan**, refresh `/dev` atau terapkan **Versi baru** untuk deployment `/exec` yang sama. Tidak perlu mengganti auth/login/CSS/score-client/transaksi/setup. Tidak perlu repair.

Buka spreadsheet sebagai admin → **PEMBARUAN_SHEET → PERBARUI**. Tiga sheet Insentif yang sudah ada akan ditambah kolom branding/Promag Tablet/pasangan/alokasi, lalu dihitung ulang untuk semua kelompok yang berlaku. Tidak perlu membuat tab manual atau memasang ulang trigger. Backup dan batch atomik yang sama dipertahankan; klik ulang tidak menggandakan baris.

## Produk yang dihitung

Semua produk tetap boleh diinput sebagai penjualan. **Hanya kode loading berikut yang masuk pencapaian dan insentif MPR/Canvasser**, baik harian, bulanan maupun triwulan:

| Kode | Produk |
| --- | --- |
| LPRGR | Promag Herbal |
| TMXTG | Mixgrip Tablet Box |
| TMXGF, TMXGE | Mixagrip |
| CKPXE | Kalpanax Salep |
| TXONE | Xonce Tablet |
| LETSB | Entrostop Herbal Anak |
| TNTPK | Entrostop Tablet |
| TFTGF | Fatigon Kaplet |
| TFTSG | Fatigon Spirit |
| LMHGA | Mixagrip Herbal Greges |
| LBMAV | Bejo Jahe Merah |
| LKXPA, LKXLA, LKXNA, LKXOD, LKXJA, LKXOB | Enam varian Komix Herbal Family |
| LEXUA | Extra Joss Ultimate |
| PEMAB, PEGAB | Extra Joss Laki |
| PBSJC | Slasi |

Produk di luar loading tidak menambah target/insentif kelompok ini. **LPRGN Promag Tablet** dihitung terpisah untuk salah satu syarat harian, tidak masuk TV loading bulanan/triwulan. Faktur campuran dipilah per baris.

Kode Promag Herbal yang benar adalah **LPRGR**, juga untuk Fokus B di Skor dan Motoris/MMTW. Histori memakai kode lama LPRGQ tetap dibaca sebagai alias LPRGR; tidak menulis ulang faktur atau stok historis. Jika kedua kode sekaligus menjadi dua master produk, perhitungan menolak duplikasi dan meminta pemeriksaan admin, bukan menghitung ganda. Loading yang belum ada di master memberi pesan kode yang perlu diperiksa. Nama produk/master SALES dan kode transaksi lama tidak diubah secara massal oleh pemasangan ini.

Pembatasan loading ini khusus Insentif MPR/Canvasser; perhitungan Skor yang sudah ada tetap, selain koreksi kode Promag Herbal.

## Harian Senior: sekali Rp70.000

Pada hari kerja yang sama, seluruh faktur Senior digabung. Dapat satu tarif Rp70.000 jika:

1. Loading **≥Rp2.500.000** DAN Promag Tablet **≥Rp1.000.000**, ATAU
2. Loading **≥Rp3.500.000**, tanpa wajib Promag Tablet.

Dua kondisi terpenuhi tetap Rp70.000 satu kali sehari. Contoh loading2jt+tablet1,5jt tidak lolos; tablet3,5jt saja tidak lolos. Produk lain di luar loading tidak bisa menutup kekurangan. Minggu/libur mengikuti HOLIDAYS seperti fitur sebelumnya; nilai penjualan loading pada hari tersebut tetap masuk bulanan/triwulan. Kalender yang tidak tersedia menandai nominal harian belum dapat dihitung.

## Bulanan Senior

| Parameter | Target | Tarif90% | Tarif100% | Tarif110% |
| --- | ---: | ---: | ---: | ---: |
| Fokus A Bejo | Rp6.400.000 | Rp400.000 | Rp600.000 | Rp800.000 |
| Fokus B Family + Promag Herbal | Rp8.200.000 | Rp250.000 | Rp375.000 | Rp500.000 |
| TV loading non Promag Tablet | Rp80.000.000 | Rp250.000 | Rp375.000 | Rp500.000 |
| AA | 400 outlet | Rp50.000 | Rp75.000 | Rp100.000 |
| Branding | 300 outlet | Rp50.000 | Rp75.000 | Rp100.000 |
| **Jika semua pada tingkat tersebut** | | **Rp1.000.000** | **Rp1.500.000** | **Rp2.000.000** |

Tangga per parameter: <90%=0; ≥90%–<100%=tarif90; ≥100%–<110%=tarif100; ≥110%=tarif maksimal. Nilai asli dipakai tanpa ROUND pencapaian.

**TV, Fokus A dan Fokus B semuanya harus ≥70%** agar gabungan harian+bulanan dibayar penuh:

- TV loading minimal **Rp56.000.000**.
- Fokus A minimal **Rp4.480.000**.
- Fokus B minimal **Rp5.740.000**.

Salah satu kurang → **(harian + bulanan) ×50%**; ketiganya memenuhi → ×100%. Tepat70% dianggap memenuhi. AA/branding tidak ditambahkan sebagai syarat70%, tetapi punya tangga tarif sendiri. Pembayaran triwulan tidak terkena potongan ini.

AA dan branding memakai input harian admin yang sudah ada di SKOR_EVENTS. Tidak ada input toko/POSM/form baru dan tidak dihitung otomatis dari faktur. Angka branding yang dimasukkan admin mengikuti mekanisme yang telah ada; pemenuhan syarat materi minimal2POSM tetap diperiksa di lapangan oleh admin.

## Triwulan Senior

Kalender tetap TW1 Jan–Mar, TW2 Apr–Jun, TW3 Jul–Sep, TW4 Okt–Des. Target akumulasi **Rp240.000.000**, hanya loading, tanpa prorata.

| Bulan yang masing-masing mencapai ≥100% target80jt | Akumulasi≥100%–<110% | ≥110%–<120% | ≥120% |
| --- | ---: | ---: | ---: |
| 3 bulan | Rp3.000.000 | Rp3.250.000 | Rp3.500.000 |
| 2 bulan | Rp2.000.000 | Rp2.125.000 | Rp2.250.000 |
| 1 bulan | Rp1.000.000 | Rp1.125.000 | Rp1.250.000 |

Akumulasi<100% tidak mendapat bonus. Bonus terpisah dari total bulanan agar tidak dibayar tiga kali. Periode berjalan tetap estimasi.

## Junior/Asisten: tanpa target sendiri

| Senior | Junior/Asisten | ID Senior → ID Junior |
| --- | --- | --- |
| Aziz Muradi | Muhammad Zulfan | CANVASSER-BAC-LHOKSEUMAWE-1 → JUNIOR CANVASSER-BAC-LHOKSEUMAWE-1 |
| Amul Husni | Muhammad Nuzar | MPR-LSE-BIREUN → ASS. MPR-LSE-BIREUN |
| Fitriatuddin | Edy | MPR-LSE-IDI → ASS. MPR-LSE-IDI |
| Khairul Rizal | Adriansyah Putra | MPR-LSE-LHOKSEUMAWE → ASS. MPR-LSE-LHOKSEUMAWE |

ID mengikuti screenshot master yang dikonfirmasi pengguna. Nama/tim tampilan tetap berasal dari master aktual. Pasangan yang hilang/ganda atau Senior bukan MPR/Canvasser ditolak, tidak ditebak berdasarkan nama mirip. Junior baru tanpa pasangan ditandai belum ditetapkan.

- Junior menerima **70% dari hasil harian+bulanan Senior setelah faktor pencapaian**, tidak dipotong50% lagi.
- Junior juga menerima **70% bonus triwulan Senior**, sesuai konfirmasi pengguna.
- Target/aktual pencapaian Junior sendiri tidak dibuat. Tabel parameter menampilkan — untuk target/aktual Junior, dengan tarif/alokasi yang diterimanya. Angka penjualan harian/triwulan sebagai referensi jelas diberi keterangan acuan Senior.
- Penjualan atas ID Junior tidak otomatis ditambahkan ke Senior. Perhitungan alokasi memakai transaksi/AA/branding Senior pasangan.
- Sheet menambah senior_sales_id/senior_sales_name/allocation_percent dan referensi sumber. Kolom target/aktual Junior kosong, alokasi/pembayaran terisi. Riwayat periode Junior mengikuti Senior, termasuk bila Junior tidak mempunyai transaksi sendiri.

Contoh Senior memperolehharian70.000+bulanan1.500.000 dengan gate100% →1.570.000; Junior1.099.000. Jika gate50% →Senior785.000; Junior549.500. Bonus Senior3.000.000 →Junior2.100.000, tidak terkena gatebulanan.

## Verifikasi

**288 tes Node lulus**. Tambahan mencakup22loading codes, legacyPromagalias, dailycompositionexactboundaries, sekali perhari, keduaSeniorgroup/allmonthlytiers, tigagate70%raw, sembilanpayoutquarter, semuaempatpasangan70%tanpatarget/doublepotong, missing/wrong/duplicatepair, kalender/loadingmissing, readonlyGuest, eksporbranding/Junior/referencetargetblank, migrasiskemalamasambilmempertahankankolomcustomkosong dan klikulangidempoten, serta renderJunior.

Browser Chromium halamanInsentif: Motoris/MMTW tetap, Senior5parameter/loadingexcludeprodukdi luar daftar, Juniornominal/pasangan/tanpatarget, triwulan, desktop/effective75%/HP. BrowserGuestlogin/read/refresh dan Skor juga diperiksa. Semua menggunakan layanan Google tiruan; belum dipasang pada Google pengguna oleh agen.
