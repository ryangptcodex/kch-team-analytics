# Revisi kategori Skor mulai November 2026

Aturan disetujui pengguna pada8November2026. Identitas aturan: **KCH_EVAL_2026_11_V1**. Kode dan pengujian selesai di workspace; agen belum menerapkan perubahan ini ke Google.

## Aturan yang berlaku

| Poin asli | Kategori dasar |
|---|---|
| ≤70, termasuk0 | **EVALUASI** |
| >70 sampai dengan80 | **DISPENSASI LANJUT** |
| >80 | **AMAN** |

Batas memakai angka asli, bukan angka yang dibulatkan untuk tampilan.70,5termasukDISPENSASI. **Tepat80masihDISPENSASI**, tetapi memenuhi minimum80untuk tindak lanjut bulan sebelumnya. Mulai November aturan ini berlaku pada layar Skor yang sudah tersedia untuk Motoris, MMTW, MPR dan Canvasser. Oktober dan sebelumnya memakai kategori historisnya.

Jika kategori akhir suatu bulan **DISPENSASI LANJUT**, bulan berikutnya wajib minimal80poin. Bila bulan berikutnya **sudah selesai** dengan poin<80, kategori akhirnya otomatis menjadi **EVALUASI**, termasuk bila rentang poin dasarnya masihDISPENSASI.

Contoh:

| November | Desember | Hasil |
|---|---|---|
|75, DISPENSASI |75dan Desember masih berjalan |Estimasi; dalam pemantauan, wajib minimal80sampai akhir Desember |
|75, DISPENSASI |75dan Desember sudah selesai |EVALUASI karena minimum tindak lanjut tidak terpenuhi |
|75, DISPENSASI |80pada akhir Desember |Minimum terpenuhi, kategori tetapDISPENSASI; target berikutnya minimal80pada Januari |
|75, DISPENSASI |85pada akhir Desember |AMAN |

Tindak lanjut memakai **kategori akhir bulan sebelumnya**, bukan hanya rentang skor mentahnya. Periode yang masih berjalan ditandai **Estimasi**, periode mendatang **Belum berjalan**. Keputusan lanjut kerja/pecat tetap manual oleh Admin. Tidak ada penonaktifan akun/profil atau penghapusan sales otomatis.

Rumus poin, bobot, target, tarif dan nominal juklak insentif tetap. KategoriEVALUASI tidak menambah penalti uang baru.

## Pasang empat file lengkap

Buka tiap nama berikut dan salin seluruh isinya ke file dengan nama yang sama pada **proyek Apps Script Production yang sudah dipakai**. Semua file sudah ada; tidak perlu membuat file baru atau mencari baris kode.

| File | Jenis di editor |
|---|---|
|[score.gs](score.gs)|Script|
|[period-masters.gs](period-masters.gs)|Script|
|[index.html](index.html)|HTML|
|[score-client.html](score-client.html)|HTML|

1. Ganti seluruh isi keempat file lalu **Simpan semuanya**. Jangan menguji saat baru sebagian file terpasang.
2. Jalankan **PEMBARUAN_SHEET → A3 PERBARUI SELURUH SHEET** untuk merekam identitas aturan evaluasi pada snapshot bulan berjalan. Tunggu status sukses. Periode tutup yang valid tetap tidak ditimpa. Tidak perlu reset, inisialisasi, mengisi saldo awal ulang, membuat transaksi fiktif atau mengganti nominal master harga.
3. **Terapkan → Kelola deployment → Edit → Versi baru → Terapkan** pada deployment Production yang sama. Muat ulang URL`/exec`.
4. Buka **Skor**, pilihNovember2026. Penjelasan aturan≤70/>70–80/>80harus terlihat. Kategori November saat ini masih estimasi karena bulan belum selesai. Buka Oktober untuk memastikan masih kategori historis. Tidak perlu mengubah data transaksi nyata demi membuat contoh75/80poin; batas dan tindak lanjut telah diuji pada data simulasi.

## Pembacaan laporan dan data lama

Tampilan individu dan rekap seluruh tim memakai keputusan backend yang sama. Penjelasan menunjukkan masa pemantauan, minimum tindak lanjut, hasil setelah bulan berakhir dan sebab kategoriEVALUASI. Angka tampilan mulaiNovembermemakai hingga2desimal; bila pembulatan menyentuh batas70atau80tetapi angka asli berbeda, ditampilkan `<80`, `>80`, `<70` atau `>70`agar kategori tidak terlihat bertentangan dengan poin.

Versi evaluasi disimpan terpisah dari versi kebijakan finansial. Snapshot November yang dibuat sebelum perubahan dan belum mempunyai penanda evaluasi mengikuti aturan November yang secara eksplisit disetujui pengguna. Metadata versi evaluasi yang tidak dikenali tidak ditebak; kategori ditandai belum dapat dipastikan. Identitas aturan evaluasi tidak masuk perbandingan kebijakan uang sehingga perubahan kategori tidak membatalkan bonus triwulan.

Bila laporan periode atau riwayat bulan sebelumnya belum terverifikasi, sistem tidak mengarang status dispensasi sebelumnya. Untuk skor70<x<80pada bulan tutup, bila keputusan akhirnya bergantung pada riwayat yang belum diketahui, kategori akhir ditahan sampai sumbernya diperiksa. Angka poin tetap dapat terbaca bila sumber bulan itu valid, dan uang tetap mengikuti juklaknya. Kondisi seperti≤70, tepat80atau>80yang kategorinya tidak berubah akibat riwayat tetap dapat ditampilkan disertai keterangan riwayat.

Pemeriksaan bulan sebelumnya memakai snapshot tim/produk/kalender masing-masing periode, termasuk ketika master sekarang berubah. Pembacaan ledger dan transaksi dibagi di dalam satu permintaan rekap, tanpa RPC baru per sales. Rantai dispensasi dibatasi120bulan untuk menjaga waktu proses; bila tidak dapat dipastikan dalam batas itu, keputusan yang bergantung pada riwayat ditandai belum terverifikasi, bukan pemecatan otomatis.

## Validasi

- `node --test tests/*.test.cjs`: **529lulus,0gagal**.19regresi baru mencakup batas70/80dan pecahan, kategori Oktober, estimasi/final, tepat80, pergantian tahun, riwayat tidak tersedia, snapshot versi tidak dikenal, konsistensi rekap, akun/data tetap utuh, pembacaan bersama dan uang insentif tidak berubah.
-9suite browser lulus: photo, guest, stock, archive, score, incentive, responsive, audit dan evaluation. SuiteSkor lama disesuaikan tampilannya agar kategori sebelumNovembertetap seperti sebelumnya; sudah lulus ulang. Suite evaluasi khusus memeriksa November, >80tanpa pembulatan kategori, tepat80, pemantauan Januari, keputusan final Februari, rekap dan tampilan1440/390/320.
- FileAppsScript diperiksa sintaks dan whitespace. Hash empat source lengkap: `docs/score-evaluation-source-sha256.txt`.

Seluruh pengujian memakai simulasi Google. Screenshot pengguna sebelumnya sudah mengonfirmasi R2Production`/exec`, backup harianCOMPLETE dan monitor tanpa masalah; konfirmasi itu tidak membuktikan revisi evaluasi ini sudah terpasang. Langkah terakhir tetap pemasangan oleh pengguna lalu pemeriksaan layar Skor di`/exec`.
