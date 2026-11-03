# Status absensi tambahan — 3 November 2026

Admin dapat memilih status pada Input Absensi:

| Pilihan | Kartu | HK kehadiran |
| --- | --- | --- |
| HADIR (dengan foto) | Foto dan kategori jam WIB yang sudah ada | 1 per sales per hari |
| IZIN | Biru | 0 |
| TIDAK HADIR | Merah | 0 |
| SAKIT | Oranye | 0 |
| HADIR TAPI TIDAK ABSEN | Ungu | 1 per sales per hari |

Pengguna mengonfirmasi HADIR TAPI TIDAK ABSEN dihitung1HK. HK pada profil/laporan mengikuti keputusan ini. Rumus nominal insentif yang sudah ada tidak diganti; status tidak membuat penjualan, omzet atau pemotongan stok baru.

## Pemasangan

Ganti seluruh isi lima file berikut di Apps Script Production melalui Copy raw file:

- [code.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/production/code.gs)
- [transactions.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/production/transactions.gs)
- [index.html](https://github.com/ryangptcodex/kch-team-analytics/blob/production/index.html)
- [js.html](https://github.com/ryangptcodex/kch-team-analytics/blob/production/js.html)
- [css.html](https://github.com/ryangptcodex/kch-team-analytics/blob/production/css.html)

Simpan kelimanya. Untuk /exec: Terapkan → Kelola deployment → pensil → Versi baru → Terapkan, lalu refresh. Untuk /dev, refresh setelah menyimpan. auth.gs perbaikan kunci tetap dipakai. Tidak perlu mengganti struktur sheet, reset, persiapan Production, penerapan saldo awal atau menginput ulang foto. Nilai status memakai kolom ATTENDANCE yang sudah dikenali Perbarui Seluruh Sheet.

## Pemakaian

1. Masuk sebagai Admin → Absensi → Input Absensi.
2. Pilih sales, tanggal dan Status absensi.
3. HADIR dengan foto tetap memakai foto/jam menurut aturan sebelumnya.
4. Empat pilihan lain menyembunyikan foto dan jam; cukup simpan status. Keterangan tetap opsional.

Kartu muncul menggantikan BELUM ABSEN. Klik kartu untuk melihat status, tanggal, tim, area dan keterangan. Tamu hanya dapat melihat. BELUM ABSEN berwarna abu-abu (#64748b) dan berarti belum ada catatan, sedangkan TIDAK HADIR berwarna merah dan berarti sudah ditetapkan Admin. Badge jumlah hadir menghitung orang hadir unik, termasuk HADIR TAPI TIDAK ABSEN, serta mengecualikan izin/sakit/tidak hadir.

## Perubahan status dan riwayat

Untuk tanggal yang memiliki penetapan status eksplisit, catatan terakhir per sales/tanggal menjadi keadaan pada kartu dan HK. Contoh hadir → SAKIT menghasilkanHK0; kemudian dikonfirmasi HADIR TAPI TIDAK ABSEN menghasilkanHK1.

Rawrows dan foto sebelumnya tetap disimpan. Perubahan ditambahkan sebagai event dengan audit status lama, baru, tanggal dan pelaku. Hari yang hanya mempunyai foto lama tetap mengikuti tampilan sebelumnya. Aturan keadaan harian juga berlaku pada pembacaan arsip; penulisan periode tertutup tetap ditolak.

Status, audit dan receipt disimpan satu batch atomik. Jika respons terputus, gunakan Periksa hasil. Replay ID yang sama tidak menambah baris; perubahan status pada ID yang sudah committed ditolak sebagai konflik.

## Verifikasi

438 tes Node lulus: status tanpa foto/jam, HK1/0, pembatasan Admin/Tamu, foto normal tetap wajib, replay/konflik, perubahan status dengan riwayat tetap utuh, timeout/penolakan batch, periode tertutup dan arsip. Browser foto menyimpan empat status melalui formulir asli, memeriksa warna kartu/modal dan HK serta ukuran1440/390/320. Browser login Tamu, stok dan arsip juga lulus. Layanan Google pada tes adalah tiruan; pemasangan Production nyata dilakukan pengguna.

## Pembaruan pemuatan foto — 3 November 2026

Untuk perbaikan pemuatan foto, cukup ganti seluruh js.html dan css.html dari link Production di atas, simpan lalu deploy Versi baru pada deployment yang sama. CSS ini juga mencakup BELUM ABSEN abu-abu. Kode Google yang sedang berjalan belum diperiksa langsung oleh agen.

Foto privat kini menampilkan indikator Memuat foto dan Menyiapkan foto sampai gambar benar-benar dapat dibuka browser. Kegagalan jaringan dicoba ulang otomatis satu kali; setelah gagal tersedia tombol Coba lagi pada kartu/detail tanpa refresh seluruh halaman. Gambar yang tidak dapat didekode juga ditandai gagal, tidak disimpan dalam cache. Respons yang melewati batas20detik diabaikan dan slot antreannya dilepas, sehingga satu permintaan macet tidak menahan antrean selamanya.

Maksimum empat permintaan logis berjalan bersamaan, dengan foto terlihat didahulukan dari salinan dashboard tersembunyi. Antrean untuk elemen yang sudah dibuang dilewati. Cache memori sesi memakai LRU maksimum48foto dan12MiB (perkiraan dua byte per karakter data URL); tidak ditulis ke localStorage/sessionStorage. Penggantian sesi tetap membuang cache. Respons detail lama tidak dapat menimpa foto catatan yang baru dibuka.

438 tes Node tetap lulus. Browser foto menguji21foto tanpa RPC ulang saat daftar dirender kembali, prioritas foto terlihat, indikator loading/decode, retry otomatis/manual, byte gambar rusak, timeout dan respons terlambat, pergantian modal serta aturan status/HK. Browser login Tamu juga lulus. Ini simulasi; penyebab spesifik foto Amul Husni di Production (akses file, isi file, atau kegagalan sementara) belum terkonfirmasi dan waktu Google nyata belum diukur. Perbaikan tidak mengubah foto Drive, data kehadiran, atau hak akses.
