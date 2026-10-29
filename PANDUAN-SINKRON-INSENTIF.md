# Perbarui seluruh sheet termasuk hasil Insentif

Tombol **PERBARUI SELURUH SHEET** di tab PEMBARUAN_SHEET sekarang menjalankan modul pembaruan fitur, tidak hanya penambahan struktur. Insentif Motoris/MMTW dibuat dan diisi ke tiga tab:

- **INSENTIF_HARIAN**: tanggal, sales, kalender HK, Total Value non Promag Tablet, tarif harian sebelum penyesuaian, faktor50%/100%, dan nilai diterima.
- **INSENTIF_BULANAN**: aktual/target/tingkat/tarif/nilai diterima per FokusA, FokusB, TotalValue dan AA; rincian harian/bulanan sebelum dan sesudah faktor; subtotal gabungan; faktor pembayaran; total diterima.
- **INSENTIF_TRIWULAN**: rincian tiga bulan, target dan akumulasi, jumlah bulan mencapai100%, tingkat100/110/120 dan bonus. Satu baris per sales per triwulan, bukan diulang setiap bulan.

## Pasang tiga Script lengkap

Di proyek Apps Script **UJI COBA**, gunakan Raw / Copy raw file:

| File | Tindakan |
| --- | --- |
| [incentive-sheets.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/incentive-sheets.gs) | **BARU Script `incentive-sheets`**, bukan HTML. |
| [incentives.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/incentives.gs) | Ganti seluruh isi Script `incentives`. Perhitungan webapp tetap sama; helper bersama kini dipakai pembaruan sheet. |
| [sheet-updates.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/sheet-updates.gs) | Ganti seluruh isi Script `sheet-updates`. Mendaftarkan modul, struktur, dan penulisan hasil Insentif. |

**Simpan**, lalu buka spreadsheet sebagai admin → tab **PEMBARUAN_SHEET → klik checkbox A3**. Tunggu **Berhasil**. Rincian menunjukkan jumlah baris yang diperbarui pada setiap tab. Tab kontrol kembali ditempatkan paling kanan.

Tidak perlu memasang ulang trigger, membuat tab manual, menjalankan repair lama, atau menginput ulang transaksi/AA. Fungsi checkbox menggunakan kode Script yang tersimpan; pembuatan/pengisian tab ini tidak membutuhkan deployment webapp baru. Pembaruan `/exec` tetap dilakukan bila mengganti kode yang perlu digunakan webapp; ini berbeda dari menjalankan fungsi spreadsheet.

## Periode dan sumber

Untuk masing-masing profil Motoris/MMTW yang ada, termasuk nonaktif untuk histori, laporan dihitung dari bulan transaksi/inputAA paling awal sampai bulan berjalan. Bulan kosong di antaranya tetap diperlihatkan. Bila belum ada aktivitas, bulan berjalan tetap dibuat. Bulan mendatang tidak dimasukkan; tanggal mendatang di bulan berjalan memiliki nilai insentif kosong dan keterangan Belum berjalan. Triwulan mengikuti kalender tetap.

Semua nilai dihitung memakai **helper yang sama dengan webapp**, satu snapshot data sumber untuk seluruh laporan. Aturan terbaru tetap: **(tarif harian + tarif bulanan) × 50% jika TV bulanan<70%, atau ×100% jika >=70%**. Detail masing-masing nilai diterima direkonsiliasi ke total gabungan. Bonus triwulan tidak dipotong. Target Motoris/MMTW5jt/5jt/27jt/AA400, enam varian Family+Promag, pengecualian tablet per baris faktur, tarif harian tanpa plafon25HK, dan AA manual tetap.

Status `ESTIMASI` berarti bulan/triwulan belum selesai. `SELESAI` berarti periode kalender telah lewat, **bukan persetujuan atau bukti pencairan**. Kolom `as_of` menunjukkan tanggal sumber perhitungan. Sheet kalender HOLIDAYS perlu lengkap; jika kalender tidak tersedia, nilai harian dan total gabungan kosong/diberi keterangan, bukan dibuat nol. Data AA yang belum diinput belum menambah aktual seperti di Skor.

## Klik ulang dan perlindungan data

- Hasil laporan **diganti dengan hasil hitung terbaru**, tidak ditambahkan ulang. Koreksi transaksi/AA terlihat setelah klik Perbarui. Baris hasil lama yang sudah tidak sesuai sumber dibersihkan agar tidak meninggalkan angka ganda atau usang.
- Tiga tab ini merupakan **hasil perhitungan**, bukan tempat input manual. Edit sumber melalui fitur yang sesuai. Nilai manual dalam kolom laporan akan terganti oleh hitungan; bila ada data di kolom tambahan di luar skema, proses berhenti untuk mencegah catatan samping kehilangan pasangan barisnya.
- Master SALES/PRODUCTS, transaksi, stok, AA/branding dan activity logs tidak ditulis ulang oleh modul Insentif. Perbaikan struktur dan pembersihan akun sales lama yang sudah disetujui tetap bagian dari updater.
- Sebelum perubahan dilakukan, sistem menghitung/memeriksa seluruh rencana. Kesalahan master/histori atau modul yang belum terpasang membuat status gagal dengan penjelasan, bukan mengklaim selesai.
- Cadangan lengkap dibuat sebelum perubahan. Penambahan kolom/sheet, pembersihan akun login lama, dan pengisian seluruh hasil laporan dikirim dalam **satu batch Sheets API atomik**. Jika batch ditolak, seluruh hasil lama tetap. Jika backup gagal, tidak ada batch penulisan.
- Script lock yang sama dengan transaksi dan pemeriksaan transaksi tertunda dipertahankan. Jangan mengedit sel secara manual bersamaan; script lock tidak mengunci editor manual Google Sheets.
- Ada batas ukuran150.000baris hasil/8MBpermintaan laporan dan waktu perhitungan150detik. Bila melewati batas, proses berhenti sebelum penulisan; tidak menyimpan laporan sebagian.

## Revisi berikutnya

Sistem sekarang memiliki **registry modul** `kchSheetUpdateModules_` untuk mendaftarkan skema dan fungsi penyegaran laporan. Pada pengembangan berikutnya, setiap fitur yang memerlukan sheet atau hasil perhitungan tersimpan harus ditambahkan ke registry ini bersama tes pembaruannya. Dengan demikian tombol yang sama menerapkan seluruh modul yang terdaftar.

Kode terbaru tetap perlu **disalin dan disimpan ke Apps Script terlebih dahulu**; tombol tidak mengunduh kode dari GitHub. Revisi tampilan/login/perilaku webapp tidak otomatis menjadi tab data baru: pembuatannya mengikuti kebutuhan data fitur. Contohnya, sesi admin persisten tetap bekerja di browser, sedangkan username/password Tamu tetap di ACCESS_USERS yang sudah dikenali updater.

## Pengujian

**275 tes Node lulus**. Tes baru memeriksa tiga skema/isi dan kecocokan panjang kolom, rumus gabungan50% vs bonustriwulan, satu barisquarter, histori dariAA, pengecualian MPR/future, pengisian nyata melalui mock API batch, klikulang idempoten, koreksi nilai/pembersihan barisusang, kalenderhilang, masterinvalid, catatanmanual, stringmiripformula literal, kegagalanbatch atomic, urutan hitung→backup→commit, dan modulmissing tidak memberi sukses palsu. Seluruh regresi akun/transaksi/Skor tetap dijalankan.

Browser halaman Insentif juga lulus setelah ekstraksi helper bersama. Pengujian memakai layanan Google tiruan; agen belum membuat tab/menulis spreadsheet Google pengguna. Tiga tab muncul dan terisi setelah kode dipasang dan admin menekan Perbarui.
