# Jam absensi kantor — 2 November 2026

Aturan yang diberikan Admin: masuk **08.00 WIB**, toleransi sampai **09.00 WIB**. Absensi sampai09:00:00 berstatus **Hadir Tepat Waktu**, setelah09:00:00 berstatus **Hadir Terlambat**. Waktu memakai Asia/Jakarta dari server.

## Pasang lima file di Apps Script Production

Buka tautan berikut dari cabang **production**, pilih **Copy raw file**, lalu ganti seluruh isi file dengan nama yang sama:

- [code.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/production/code.gs)
- [transactions.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/production/transactions.gs)
- [index.html](https://github.com/ryangptcodex/kch-team-analytics/blob/production/index.html)
- [js.html](https://github.com/ryangptcodex/kch-team-analytics/blob/production/js.html)
- [css.html](https://github.com/ryangptcodex/kch-team-analytics/blob/production/css.html)

Simpan semuanya dan refresh `/dev`. Untuk `/exec`, terapkan **Versi baru** pada deployment Production lalu refresh. Tidak perlu reset sheet, persiapan Production, penerapan saldo awal, atau menjalankan pembaruan struktur sheet. Kolom ATTENDANCE yang dipakai tetap `time` dan `status`.

## Cara mencatat

Pada formulir **Input Foto Absensi**, Admin memperoleh kolom **Jam absensi (WIB)**:

- Untuk hari ini, kosongkan jika ingin memakai waktu server saat catatan diproses. Bila Admin menginput kehadiran tim yang sudah terjadi sebelumnya pada hari yang sama, isi jam hadir yang sebenarnya.
- Untuk tanggal sebelumnya yang masih terbuka, isi jam absensi sebenarnya. Kolom kosong ditolak agar jam upload hari ini tidak dianggap jam hadir pada tanggal lampau.
- Jam manual hanya dapat diberikan Admin, memakai formatHH:mm atauHH:mm:ss. Jam hari ini yang melebihi waktu server ditolak.
- Sumber jam (`ADMIN_INPUT`/`SERVER`), jam masuk dan batas toleransi dicatat pada audit. Waktu upload tetap tersimpan pada audit meskipun jam hadir dicatat manual.
- Foto kunjungan tetap menggunakan alur waktunya sendiri. Akun Tamu hanya membaca; tidak dapat mencatat absensi atau jam.

Contoh: jam08:45 tepat waktu;09:00:00 tepat waktu;09:00:01 dan09:15 terlambat. Label terlambat ditampilkan dengan warna oranye.

Aturan ini dipakai saat menyimpan absensi baru. Catatan lama tidak ditulis ulang. Bila catatan lama memiliki status kosong, pembaca menampilkan status netral **Hadir**, bukan menganggap tepat waktu tanpa bukti jam. Perhitungan HK tetap memakai aturan hadir unik yang sudah ada; paket ini tidak mengubah omzet, stok atau rumus insentif.

Jam hadir termasuk dalam identitas kiriman foto. Percobaan ulang memakai jam yang sama; mengganti jam pada ID yang sudah tersimpan ditolak sebagai konflik. Kiriman lama yang tidak mempunyai jam manual tetap dapat dipulihkan menggunakan receipt sebelumnya.

## Verifikasi

413 tes Node lulus: batas jam menurut WIB, toleransi, jam manual/historis, penolakan input waktu tidak valid/future/nonadmin, audit, replay, kompatibilitas fingerprint lama dan perlindungan draft selama kompresi foto. Browser foto menguji formulir nyata, waktu08:45 yang tersimpan, label terlambat, pembatasan Tamu, pemulihan foto dan ukuran1440/390/320. Browser login Tamu dan stok juga lulus. Pengujian memakai layanan Google tiruan; pemasangan dan percobaan Production nyata masih dilakukan pengguna.
