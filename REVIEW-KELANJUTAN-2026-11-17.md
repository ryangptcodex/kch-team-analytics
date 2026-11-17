# Pemeriksaan kelanjutan Production — 17 November 2026 WIB

Source diperiksa: cabang `production`, commit `3accd16b221e793abe0ff6184f629639334c9024`. Checkout awal lingkungan masih checkpoint `uji-login` (`3670a51`); source Production diambil dari remote sebelum pemeriksaan. Tidak ada perubahan kode aplikasi pada pemeriksaan ini.

## Bukti yang dipertahankan

- Pengguna menyebut deployment terakhir V17, 8 November 2026, dan `checkKchTransactionSetup` pernah lolos tanpa missing sheet/PENDING. Ini laporan pengguna, bukan inspeksi langsung deployment oleh agen.
- CATATAN-LANJUT mencatat stok fisik INVENTORY/SALES_STOCK dan akses Tamu Production sudah dikonfirmasi sesuai pada 3 November. Bukti 8 November mencatat `/exec` R2, monitor bersih, tanpa kiriman tertunda, dan backup COMPLETE. Tidak perlu mengulang persiapan atau menganggap bukti tersebut belum ada.
- Tidak ada akses Google langsung dalam pemeriksaan ini. Tidak ada reset, penerapan saldo awal, transaksi fiktif, restore, perubahan data spreadsheet, atau deployment.

## Prioritas yang sudah tersedia dan diperiksa

1. Absensi: kebijakan yang disepakati sudah diterapkan berdasarkan menit WIB: sampai 08:00:59 HADIR TEPAT WAKTU; 08:01–09:00:59 HADIR; mulai 09:01 HADIR TELAT, termasuk lewat 12.00. Admin dapat mengisi jam aktual. IZIN/SAKIT/TIDAK HADIR HK0; HADIR TAPI TIDAK ABSEN HK1. Status eksplisit terakhir menentukan keadaan harian tanpa menghapus foto/riwayat. Validasi tanggal, receipt atomik, replay, foto privat, retry, dan isolasi sesi sudah tersedia.
2. Stok: Monitor memeriksa saldo versus mutasi aktif/arsip dan receipt per distributor yang mempunyai rincian. Saldo hilang, selisih distributor, serta referensi yatim memiliki regresi. Akun legacy tanpa rincian receipt tetap mempunyai batas pembuktian; monitor tidak menggantikan hitungan fisik. Opname memakai pratinjau revisi dan menolak hitungan basi. Tidak ada saldo yang disesuaikan otomatis dalam pemeriksaan ini.
3. Admin/Tamu: gateway server membatasi Tamu ke pembacaan; input, master, monitor, backup/restore, dan operasi stok dibatasi Admin. Dokumen privat dan tautan backup tidak dibuka kepada Tamu. Browser menguji login, pembacaan foto/bukti privat, penolakan penulisan, logout, dan pencabutan sesi.

## Hasil eksekusi saat ini

- `node --test tests/*.test.cjs`: 529 lulus, 0 gagal, 0 dilewati.
- `node tools/photo-ui-check.cjs`: lulus, termasuk status/HK, jam aktual, foto privat, retry/timeout, pemulihan dan tampilan mobile.
- `node tools/guest-ui-check.cjs`: lulus, termasuk login Admin/Tamu, akses baca saja, pencabutan sesi dan tiga ukuran layar.
- `node tools/audit-ui-check.cjs`: lulus, termasuk opname basi → periksa ulang, operasi stok, pemulihan simulasi dan isolasi Tamu.
- `node tools/stock-ui-check.cjs`: lulus, termasuk pengambilan, penjualan sumber campuran, edit sumber yang mengembalikan saldo lama, setoran dengan bukti, dan Tamu baca saja.
- `node tools/evaluation-ui-check.cjs`: lulus untuk revisi November, batas 80, tindak lanjut dan histori Oktober.
- Seluruh 19 file `.gs` lolos parse; manifest JSON valid; `git diff --check` bersih sebelum penambahan laporan.

Seluruh layanan Google pada tes merupakan simulasi. Hasil ini membuktikan regresi lokal, bukan isi spreadsheet, kuota/latensi Google, atau kesamaan file V17 dengan source GitHub saat ini.

## File pemasangan dan langkah berikut

Tidak ada file Apps Script baru yang perlu dipasang akibat pemeriksaan ini. Jangan mengulang paket absensi/stok/login yang sudah terpasang tanpa gejala baru.

Checkpoint terakhir menyisakan konfirmasi pemasangan revisi evaluasi November: `score.gs`, `period-masters.gs`, `index.html`, `score-client.html`. Bila V17 sudah mencakup keempat file tersebut, tidak perlu memasang ulang. Nomor versi/tanggal saja tidak membuktikan isinya. Jika revisi belum dipasang, ikuti PANDUAN-SKOR-NOVEMBER.md: ganti empat file lengkap, Simpan, A3 pembaruan aman untuk snapshot aturan, lalu Versi baru pada deployment Production yang sama. Ini bukan reset atau penerapan saldo awal.

Lanjutkan pemantauan pada aktivitas usaha nyata: cocokkan sumber stok dan hasil edit yang memang dilakukan, lihat status absensi sesuai jam aktual, dan tangani pesan error baru dengan bukti spesifik. Konfirmasi Google untuk seluruh skenario koreksi/setoran dengan bukti/restore belum lengkap; jangan membuat transaksi atau menjalankan restore Production semata-mata untuk menutup daftar uji.
