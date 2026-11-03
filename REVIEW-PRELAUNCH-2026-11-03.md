# Audit kesiapan launch ulang — 3 November 2026

Source diperiksa: **production5c69964**, release `KCH-AUDIT-2026-11-03`. Ini audit lanjutan setelah paket sebelumnya, bukan klaim seluruh kondisi Google telah diperiksa.

**Keputusan: belum merekomendasikan launch penuh semua fitur.** Alur utama lulus pengujian yang tersedia, tetapi enam celah berikut berhasil direproduksi. Prioritaskan pengaman stock opname, validasi master yang menjaga kalkulator, dan keutuhan laporan periode sebelum menganggap seluruh fitur final.

Pengguna mengonfirmasi webapp sudah terbuka normal setelah error HTML. Penyebab file yang sebenarnya tertukar/tidak sesuai belum diperiksa langsung. Kondisi itu tidak lagi dianggap error aktif menurut konfirmasi pengguna. Isi Monitor Admin belum diterima saat laporan ditulis.

## Cakupan dan bukti

- Telaah webapp: template/include, metadata, form operasional/master, pemilihan sales/periode, pengaturan akses, sinkronisasi dan pemulihan.
- Telaah Apps Script: transaksi/stockbook, koreksi/retur, snapshot/report, autentikasi, arsip, backup/restore dan job terjadwal.
- Telaah sheet dari kode: schema, binding Production, arus saldo/mutasi, pembentukan laporan, monitor dan arsip. **Isi sel, izin, trigger dan deployment Google nyata belum dibaca langsung.** Tidak ada konektor Google/Apps Script terautentikasi tersedia pada sesi ini.
- `node --test tests/*.test.cjs`:489lulus,0gagal pada audit ulang.
- `node tools/audit-ui-check.cjs`: lulus ulang alur Admin/Tamu, operasi/koreksi/master/backup/restore, responsive dan respons usang pada HTML/JS asli dengan backend simulasi.
- `node tools/prelaunch-audit-2026-11-03.cjs`:6observasi berikut direproduksi. Script ini menyatakan perilaku salah yang diamati, bukan regresi perilaku benar. Hasil: [docs/prelaunch-audit-observations-2026-11-03.jsonl](docs/prelaunch-audit-observations-2026-11-03.jsonl).

Kelulusan489tes sebelumnya benar, tetapi belum mencakup keenam skenario ini. Klaim bahwa seluruh perbaikan histori/monitor sudah tuntas perlu dibatasi oleh hasil audit ulang ini.

## Temuan yang masih terbukti

### L06 — P1: stock opname belum menolak hitungan yang sudah basi

**Trigger:** hitungan fisik10dibuat sebelum penjualan2, lalu angka10disimpan setelah penjualan berhasil. Saldo server sudah8, tetapi opname tetap diterima dan menjadi10. Lock menjaga urutan commit, tetapi tidak membuktikan hitungan itu masih sesuai versi saldo terbaru.

**Dampak:** form/tab yang tertunda dapat mengembalikan unit yang telah dijual ke saldo tanpa peringatan konflik. Ini bukan bukti stok Production sekarang salah.

**Sumber:** [operations.gs:80](https://github.com/ryangptcodex/kch-team-analytics/blob/5c69964/operations.gs#L80), [operations-client.html:46](https://github.com/ryangptcodex/kch-team-analytics/blob/5c69964/operations-client.html#L46).

**Perbaikan yang dibutuhkan:** ambil saldo/revisi per akun saat mulai opname, tampilkan saldo sistem vs hasil hitung dan delta, lalu tolak simpan bila ada mutasi intervening; minta hitung/konfirmasi ulang. Gunakan shared lock dan batch yang sudah ada. Tambah regresi dua tab/penjualan intervening; jangan menimpa data nyata untuk uji.

### L03 — P1: editor master dapat menyimpan perubahan yang merusak kalkulator aktif

**Trigger:** edit produk berkodeLBMAV dari `Bejo Jahe Merah` menjadi `Bejo JM`, dengan satuan valid. Simpan berhasil, tetapi `getScoreSetup` langsung menghasilkan `mappingReady:false` dan laporan insentif gagal dengan pesan nama master tidak cocok.

**Dampak:** editor baru dapat memutus tampilan/perhitungan insentif yang sebelumnya berjalan. Validasi saat membaca gagal dengan aman, tetapi editor tidak mencegah konfigurasi yang tidak konsisten.

**Sumber:** [period-masters.gs:65](https://github.com/ryangptcodex/kch-team-analytics/blob/5c69964/period-masters.gs#L65), [score.gs:94](https://github.com/ryangptcodex/kch-team-analytics/blob/5c69964/score.gs#L94).

**Perbaikan yang dibutuhkan:** jalankan validasi pemetaan terhadap kandidat master sebelum commit; untuk nama/kode terikat juklak, tolak perubahan yang membuat laporan tidak valid atau sediakan alias/migrasi eksplisit. Jangan diam-diam mengganti juklak bisnis.

### L01 — P1 untuk histori final: snapshot menyimpan aturan, kalkulator belum memakai salinannya

**Trigger:** snapshot Oktober disahkan denganLBMAVsebagaiFOCUS_A dan aktual200. Setelah konstanta kalkulator sekarang mengubah produk itu menjadiOTHER, buka Oktober kembali: Fokus A berubah200→0, total penjualan tetap200 dan `masterVerified:true`.

**Dampak:** perubahan aturan kode di rilis berikutnya dapat mengubah laporan lama meskipun snapshot tampak terkunci. Perubahan master tim/produk sudah ditangani sebagian, tetapi pembekuan aturan belum lengkap. Ini skenario perubahan aturan berikutnya, bukan bukti angka lama sudah berubah di Production saat ini.

**Sumber:** [period-masters.gs:25](https://github.com/ryangptcodex/kch-team-analytics/blob/5c69964/period-masters.gs#L25), [score.gs:97](https://github.com/ryangptcodex/kch-team-analytics/blob/5c69964/score.gs#L97), [canvasser-incentives.gs:13](https://github.com/ryangptcodex/kch-team-analytics/blob/5c69964/canvasser-incentives.gs#L13).

**Perbaikan yang dibutuhkan:** kalkulator periode tutup memakai policy snapshot yang lengkap—pemetaan produk, loading, pasangan Senior/Junior serta versi rumus/tarif—atau hasil final yang immutable. Aturan tidak dikenali harus ditandai belum terverifikasi, bukan memakai konstanta terbaru. Tambah uji perubahan rules setelah penutupan bulan.

### L02 — P1 untuk pengesahan insentif: kalender hilang dapat dianggap kalender kosong yang sah

**Trigger:** tanpa sheetHOLIDAYS, insentif saat ini memberi `holidaySource:''` dan `dailyTotal:null`. Ambil snapshot lalu buka periode itu setelah bulan berganti: snapshot dinyatakan terverifikasi, kalender berubah menjadi `Snapshot periode`, dan dailyTotal menjadi0pada fixture tanpa penjualan. Ketidakpastian kalender hilang tanpa bukti kalender.

**Dampak:** sumber kalender yang hilang bisa dianggap bulan tanpa hari libur. Hari kerja dan insentif harian dapat disahkan dari asumsi yang tidak didokumentasikan.

**Sumber:** [period-masters.gs:19](https://github.com/ryangptcodex/kch-team-analytics/blob/5c69964/period-masters.gs#L19), [period-masters.gs:25](https://github.com/ryangptcodex/kch-team-analytics/blob/5c69964/period-masters.gs#L25), [score.gs:185](https://github.com/ryangptcodex/kch-team-analytics/blob/5c69964/score.gs#L185).

**Perbaikan yang dibutuhkan:** manifest snapshot membedakan sumber tidak ada dari sumber tersedia dan kosong. Kalender kosong boleh sah jika memang ada/deklarasi eksplisit; sumber hilang harus mempertahankan status belum terverifikasi. Validasi sumber/periode sebelum pengesahan.

### L04 — P2: monitor rekonsiliasi belum mendeteksi akun saldo yang hilang

**Trigger:** pickup2unit menghasilkan saldo pegangan2dan mutasi terakhir2. Hapus hanya baris saldo pada fixture; `getOperationalHealth` menghasilkan nol masalah untukSALES_STOCK walaupun ledger masih menunjukkan2.

**Dampak:** tidak adanya peringatan monitor belum membuktikan semua saldo lengkap. Pemeriksaan saat ini hanya menelusuri baris saldo yang masih ada. Pemeriksaan gudang juga terutama membandingkan total produk, belum rekonsiliasi lengkap per distributor.

**Sumber:** [health.gs:119](https://github.com/ryangptcodex/kch-team-analytics/blob/5c69964/health.gs#L119), [health.gs:121](https://github.com/ryangptcodex/kch-team-analytics/blob/5c69964/health.gs#L121).

**Perbaikan yang dibutuhkan:** bandingkan union akun ledger+saldo dua arah, validasi referensi sales/produk/distributor dan cakupan mutasi. Laporkan akun tanpa saldo/saldo tanpa dasar yang dapat diverifikasi. Untuk gudang per distributor, gunakan dasar dan jurnal sumber yang mencukupi; jangan menyimpulkan rekonsiliasi lengkap hanya dari total agregat.

### L05 — P2: pemilih sales belum mengikuti periode historis

**Trigger:** salesS1Motoris memiliki snapshot Oktober, lalu menjadiSPR pada November. API laporan Oktober masih berhasil sebagaiMotoris, tetapi `getScoreSetup` dan `getIncentiveSetup` hanya mengembalikanS2. S1hilang dari dropdown layar.

**Dampak:** laporan lama masih ada pada backend, tetapi tidak bisa dipilih lewat alur UI normal saat sales beralih ke tim yang tidak eligible sekarang.

**Sumber:** [score.gs:113](https://github.com/ryangptcodex/kch-team-analytics/blob/5c69964/score.gs#L113), [incentives.gs:7](https://github.com/ryangptcodex/kch-team-analytics/blob/5c69964/incentives.gs#L7), [score-client.html:33](https://github.com/ryangptcodex/kch-team-analytics/blob/5c69964/score-client.html#L33).

**Perbaikan yang dibutuhkan:** setup/pilihan sales berdasarkan bulan atau union roster historis terotorisasi dengan keterangan masa berlaku. Pergantian bulan memuat ulang pilihan; input tetap mengikuti hak dan periode terbuka.

## Hal yang sudah terbukti berjalan dan tidak perlu direset

Suite yang tersedia masih lulus untuk penjualan, sumber gudang/pegangan/campuran, idempotensi/respons hilang, retur harga asli, baik/rusak terpisah, void sisa faktur, koreksi pickup/setoran, status absensi/HK, jam kunjungan, keterangan opsional, akses Tamu, pemuatan foto privat, arsip dan alur backup/restore pada fixture. Ini bukan sertifikasi seluruh kombinasi/performa Google nyata.

Pengguna sebelumnya mengonfirmasi stok fisik cocok, Tamu sesuai dan foto tampil. Tidak ada alasan untuk menerapkan ulang saldo pembukaan atau reset. Juklak nominal dan keputusan HK tidak perlu ditanyakan ulang.

## Kurang pas sebelum rilis luas

1. **Pemeriksaan pemasangan file:** error HTML sebelumnya tidak menunjukkan nama file include dengan jelas; tambahkan diagnostik pemasangan/release yang menyebut file bermasalah, tanpa menampilkan isi source di layar. Pisahkan daftar Script vs HTML dengan penanda awal file. Tidak perlu ZIP sesuai preferensi pengguna.
2. **Performa data nyata belum diukur:** pagination dan batch foto sudah ada, tetapi beberapa pembaca masih memindai histori/arsip penuh. Backup, updater, arsip dan laporan terjadwal memakai lock bersama dengan input. Perlu waktu nyata metadata/dashboard/absensi serta durasi job pada volume Production sebelum menjanjikan loading cepat atau tanpa timeout. Tidak ada bukti baru bahwa lock timeout sedang terjadi saat ini.
3. **Sheet hasil vs webapp:** laporan turunan diperbarui berkala; waktu terakhir harus dipakai saat membandingkan angka. Jangan menganggap beda waktu refresh otomatis berarti rumus salah.
4. **Batas produk saat ini:** Admin menginput, Tamu membaca; setoran adalah memo, bukan pelunasan faktur/piutang. Ini aturan yang telah disetujui, bukan fitur hilang yang harus diam-diam ditambahkan.

## Pemeriksaan Google nyata yang masih dibutuhkan

Buka **Monitor Admin** di sidebar (scroll ke bawah bila diperlukan) lalu kirim screenshot. Yang dilihat: release/lingkungan, masalah schema/master/stok/pending, cadangan terverifikasi dan waktu sinkron laporan/error terakhir. Pengguna tidak perlu menyalin kode atau hash.

Di Google nyata perlu dipastikan deployment `/exec` Production menggunakan versi yang sama, updater A3 sukses, izin dan trigger benar, satu cadangan dapat dibuat/diverifikasi, dan transaksi usaha berikutnya konsisten dengan bukti/stok/laporan. Jangan membuat penjualan atau mutasi fiktif dalam Production. Restore penuh tidak perlu dipicu di Production hanya untuk membuktikan tombol bekerja; gunakan lingkungan/salinan terpisah.

Rekomendasi urutan: **L06/L03 → L01/L02 → L04/L05 → pemasangan dan pemeriksaan Google nyata/performa → launch penuh**. Selama paket perbaikan berikutnya belum dibuat, jangan menganggap keenam celah ini telah diperbaiki hanya karena auditnya selesai.
