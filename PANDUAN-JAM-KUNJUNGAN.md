# Jam aktual foto kunjungan — 2 November 2026

Formulir **Input Foto Kunjungan** sekarang menampilkan **Jam kunjungan (WIB)** untuk Admin. Isi sesuai jam yang tercantum pada foto. Nilai tersebut disimpan ke `VISIT_PHOTOS.visit_time` dan ditampilkan pada kartu kunjungan, sehingga unggahan malam dapat memakai jam kejadian siang hari.

## Pasang empat file di Apps Script Production

Buka file dari cabang **production**, pilih **Copy raw file**, lalu ganti seluruh isi file dengan nama yang sama:

- [code.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/production/code.gs)
- [transactions.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/production/transactions.gs)
- [index.html](https://github.com/ryangptcodex/kch-team-analytics/blob/production/index.html)
- [js.html](https://github.com/ryangptcodex/kch-team-analytics/blob/production/js.html)

Simpan semuanya. Untuk `/exec`, gunakan **Terapkan → Kelola deployment → pensil → Versi baru → Terapkan**, lalu refresh. Untuk `/dev`, refresh setelah menyimpan. Tidak perlu Perbarui Sheet, reset, persiapan Production, penerapan saldo awal atau penggantian CSS/auth.

## Pemakaian

Contoh: foto menunjukkan15.40, tetapi baru diunggah21.30. Isi **Jam kunjungan15:40**; kartu menampilkan15:40 dan audit tetap mencatat waktu upload21.30 beserta sumber jam ADMIN_INPUT.

- Hari ini: kolom boleh kosong untuk memakai waktu server saat disimpan.
- Tanggal sebelumnya yang masih terbuka: isi jam kunjungan sebenarnya agar waktu upload hari ini tidak dipakai untuk tanggal lampau.
- Jam manual hanya boleh dicatat Admin. Format server HH:mm atauHH:mm:ss; input formulir memakai pilihan jam/menit.
- Jam yang melebihi waktu server pada tanggal hari ini ditolak. Validasi tanggal masa depan dan periode tertutup tetap berlaku.
- Foto kunjungan tetap berstatus ACTIVE, tanpa kategori kehadiran, pemotongan stok atau penambahan omzet.

Jam ditangkap sebelum kompresi, termasuk dalam fingerprint kiriman, dan dikunci selama hasil simpan belum pasti. Percobaan ulang dengan ID/jam sama tidak menambah foto/baris; mengubah jam pada ID yang sudah tersimpan menjadi konflik. Kiriman lama tanpa jam manual tetap dapat dipulihkan memakai receipt lama.

Nilai di foto diisi sendiri oleh Admin. Foto yang telah tersimpan sebelumnya tetap memakai jam lama; paket ini tidak membaca tulisan jam pada gambar atau menulis ulang catatan lama secara otomatis. File foto dan seluruh data yang sudah ada dipertahankan.

## Verifikasi

428 tes Node lulus. Tujuh regresi baru mencakup jam15:40 dibanding upload21:30, audit/kartu, jam historis dan detik, penolakan input invalid/future/nonadmin, replay/fingerprint lama, batas hari WIB dan perlindungan draft selama kompresi. Browser formulir foto asli juga lulus: label jam kunjungan, penyimpanan15:40, penayangan pada kartu, kategori absensi yang tetap benar, privasi gambar, recovery, pembatasan Tamu dan layar1440/390/320. Layanan Google pada pengujian adalah tiruan; pemasangan dan verifikasi Production dilakukan pengguna.

## Keterangan opsional — 3 November 2026

Keterangan pada **Input Foto Absensi** dan **Input Foto Kunjungan** boleh dikosongkan. Kolom tetap tersedia dengan label **Keterangan (opsional)**. Jika diisi, isinya tetap tersimpan; batas2000 karakter tidak berubah. Keterangan kosong pada daftar/modal tetap kosong atau ditampilkan sebagai tanda “—”, tanpa teks keterangan buatan.

Bila paket jam sudah terpasang, revisi keterangan ini hanya membutuhkan penggantian **code.gs**, **index.html** dan **js.html** dari cabang production, lalu Simpan dan terapkan Versi baru pada deployment `/exec` yang sama. Tidak perlu mengganti transactions.gs/CSS/auth, menjalankan setup atau reset data. Validasi foto, tanggal dan jam yang sudah ada tetap berlaku.

428 tes Node serta pemeriksaan browser formulir asli lulus. Browser mengirim absensi dan kunjungan dengan textarea kosong melalui klik tombol biasa, memastikan HTML tidak lagi mewajibkan keterangan dan server menyimpan notes kosong. Alur jam, kategori absensi, foto privat dan recovery tetap diperiksa.
