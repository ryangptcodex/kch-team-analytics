# Tiga kategori absensi — revisi 2 November 2026

Kategori dihitung dari **jam hadir yang tercatat dalam WIB**, dengan ketelitian menit:

| Jam hadir | Kategori | Warna |
| --- | --- | --- |
| Sampai08.00 | HADIR TEPAT WAKTU | Hijau |
| 08.01–09.00 | HADIR | Biru |
| Mulai09.01, termasuk lewat12.00 | HADIR TELAT | Oranye |

Jam08.00 dimasukkan ke kategori tepat waktu agar tidak ada celah antar kategori. Detik mengikuti menit:08:00:59 masih tepat waktu,08:01:00 menjadi HADIR;09:00:59 masih HADIR,09:01:00 menjadi HADIR TELAT. Pengguna secara eksplisit memilih bahwa jam lewat12.00 tetap HADIR TELAT dan tidak ditolak.

## Pasang empat file di Apps Script Production

Buka tautan dari cabang **production**, pilih **Copy raw file**, lalu ganti seluruh isi file dengan nama yang sama:

- [code.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/production/code.gs)
- [index.html](https://github.com/ryangptcodex/kch-team-analytics/blob/production/index.html)
- [js.html](https://github.com/ryangptcodex/kch-team-analytics/blob/production/js.html)
- [css.html](https://github.com/ryangptcodex/kch-team-analytics/blob/production/css.html)

Simpan semuanya, lalu untuk `/exec` terapkan **Versi baru** pada deployment Production dan refresh webapp. Untuk `/dev`, refresh setelah menyimpan. transactions.gs dari paket sebelumnya tetap dipakai, demikian juga auth.gs perbaikan antrean kunci. Tidak perlu reset data, pembaruan struktur sheet, menginput ulang foto atau menerapkan saldo awal lagi.

## Absensi yang sudah tampil

Daftar Absensi dan kartu Dashboard menghitung ulang kategori dari jam tersimpan, termasuk catatan lama yang dahulu semuanya diberi “Hadir Tepat Waktu”. Contoh07:46 menjadi HADIR TEPAT WAKTU, sedangkan08:13 menjadi HADIR. Data mentah pada sheet dan arsip tidak ditulis ulang saat dibaca. Absensi baru menyimpan kategori terbaru pada kolom status.

Status izin, sakit, tidak hadir dan status eksplisit lain di luar kategori hadir dipertahankan. Catatan hadir tanpa jam yang dapat dibaca memakai label netral HADIR. Perhitungan HK, omzet, stok dan insentif tidak diubah oleh revisi kategori ini.

## Cara mencatat jam

Pada formulir **Input Foto Absensi**, Admin dapat mengisi **Jam absensi (WIB)**:

- Untuk hari ini, kosongkan jika ingin memakai waktu server saat catatan diproses. Jika mencatat kehadiran tim yang telah terjadi, isi jam hadir sebenarnya.
- Untuk tanggal sebelumnya yang masih terbuka, wajib mengisi jam hadir sebenarnya. Jam upload hari ini tidak dipakai sebagai pengganti jam hadir pada tanggal lampau.
- Jam manual hanya diberikan Admin, dalam formatHH:mm atauHH:mm:ss. Jam hari ini yang melebihi waktu server ditolak.
- Sumber jam (`ADMIN_INPUT`/`SERVER`) dan batas kategori dicatat pada audit. Waktu upload tetap tersedia di audit.

Foto kunjungan dan hak Tamu tetap seperti sebelumnya. Jam manual termasuk identitas kiriman: mengganti jam pada ID foto yang sudah tersimpan ditolak, sedangkan pemeriksaan/replay memakai hasil kiriman yang sama.

## Verifikasi

421 tes Node lulus, mencakup semua batas menit, WIB, jam manual/historis/future, audit/replay, pengelompokan ulang kartu lama tanpa menulis ulang sheet, dan pelestarian status izin/sakit/tidak hadir. Browser foto memeriksa ketiga label, formulir jam, foto privat, pemulihan kiriman dan ukuran1440/390/320; browser login Tamu juga lulus. Layanan Google pada tes adalah tiruan; pemasangan Production nyata tetap dilakukan pengguna.
