> **Kategori mulai November2026 diperbarui:** lihat [PANDUAN-SKOR-NOVEMBER.md](PANDUAN-SKOR-NOVEMBER.md) untuk batas70/80, tindak lanjut dispensasi dan empat file lengkap terbaru. Penjelasan kategori pada paket awal di bawah berlaku untuk periode historis sebelumNovember. Rumus poin tetap.

# Rekap Skor Seluruh Tim dan catatan mengejar target

Widget baru ditempatkan **di bawah tabel parameter Skor dan di atas widget Active Account (AA)**. Perhitungan Skor individual, target tiap tim, transaksi/edit/stok, AA, branding serta hak Admin/Tamu tetap dipertahankan.

## Isi rekap

- Semua profil Motoris, MMTW, MPR, dan Canvasser yang tersedia pada master SALES, termasuk profil nonaktif yang diberi tanda **(nonaktif)** untuk pembacaan historis. Tim lain tidak otomatis dimasukkan.
- Nama sales dan catatan di bawah namanya, tim, skor Fokus A/B, Total Value, AA, Branding bila berlaku, total skor dan kategori.
- Urutan total skor tertinggi menggunakan nilai asli. Skor tampilan maksimal dua desimal; kategori tetap berdasarkan nilai asli tanpa ROUND.
- Mengikuti **bulan penilaian yang dipilih**, bukan filter Hari Ini/Minggu Ini pada header dashboard. Mengganti pilihan sales individual tidak menyaring rekap seluruh tim.
- Dapat dibaca **Admin maupun Tamu**. Rekap tidak memiliki operasi tulis, tidak membuat sheet rekap atau mengubah harga/stok/data transaksi.

## Cara membaca catatan produk

Misalnya sisa target Fokus A Rp3.000.000 dan harga master Bejo Rp100.000 per Box untuk tim sales tersebut, catatan menunjukkan **30 box Bejo Jahe Merah lagi untuk skor maksimal**.

Estimasi = **sisa rupiah target ÷ harga jual aktif PRICE_MASTER sesuai tim**, dibulatkan ke atas. Aktual penjualan tetap berasal dari nilai transaksi historis; harga master terkini hanya menjadi acuan jumlah produk yang perlu dijual berikutnya.

Untuk Fokus B, catatan menampilkan **Komix Herbal Sachet, Komix Tube, atau Promag Herbal**, pada baris terpisah. Masing-masing alternatif menutup satu sisa target gabungan; penjualan boleh dikombinasikan. Harga tetap dari PRICE_MASTER aktif sesuai tim, bukan angka contoh tetap.

Komix Herbal Family mencakup Sachet Original (LKXOD), Jahe (LKXJA), Jeruk Nipis (LKXNA), Peppermint (LKXPA), Tube Original (LKXOB), dan Tube Lemon (LKXLA), ditambah Promag Herbal (LPRGR) untuk Fokus B. **Komix Herbal Kids (LKXKA) bukan Fokus B dan tetap masuk Total Value.**

Acuan sachet/tube memprioritaskan Original lalu varian valid dalam jenis yang sama. Jika harga/satuan varian valid berbeda, nama varian acuan dicantumkan agar tidak mengesankan semua varian berharga sama.

Contoh format (angka ilustrasi, harga aktual mengikuti master):

Fokus B: Masih kurang Rp 4.934.800.

380 Box Komix Herbal Sachet (acuan Rp 13.000/box), atau<br>
494 Box Komix Tube (acuan Rp 10.000/box), atau<br>
294 Box Promag Herbal (acuan Rp 16.800/box) untuk skor maksimal.

Harga tidak dipinjam dari tim lain. Harga kosong/nol/tidak valid/ganda atau produk nonaktif tidak dipakai untuk membuat jumlah perkiraan. Satuan memakai PRICE_MASTER, atau PRODUCTS jika satuan harga tidak tercantum. Jika satuan keduanya bertentangan atau sama-sama tidak ada, tampilkan penjelasan dan sisa rupiah tanpa menebak jumlah box. Jika master menyatakan sachet/tube/dus, catatan memakai satuan itu, bukan mengubahnya otomatis menjadi box.

Catatan lainnya:

- **Total Value:** sisa rupiah untuk mencapai skor maksimal; tetap mengecualikan hanya Promag Tablet, sementara produk fokus masuk omzet.
- **AA:** sisa dari target400 outlet berdasarkan input harian admin yang tersedia.
- **Branding:** sisa dari target300 outlet, hanya MPR/Canvasser.
- Parameter yang sudah mencapai/melampaui target diberi catatan **Target tercapai — skor maksimal**, tanpa jumlah negatif atau kebutuhan tambahan.

Hari AA/branding yang belum diinput belum menambah aktual. Catatan memakai data yang tersedia, bukan menghitung jumlah toko/faktur otomatis. Estimasi ini tidak membuat transaksi, menjanjikan ketersediaan stok atau mengganti harga faktur.

## Pemasangan empat file lengkap di UJI COBA

Buka masing-masing tautan → **Raw / Copy raw file** → ganti seluruh isi file yang sudah ada:

| File | Jenis di Apps Script |
| --- | --- |
| [score.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/production/score.gs) | **Script `score`**, bukan HTML. Memuat perhitungan Skor, rekap dan acuan harga. |
| [auth.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/production/auth.gs) | Script `auth`, menambah endpoint baca rekap untuk Admin/Tamu. |
| [score-client.html](https://github.com/ryangptcodex/kch-team-analytics/blob/production/score-client.html) | HTML `score-client`, menampilkan rekap/catatan dan mempertahankan perbaikan loading AA. |
| [index.html](https://github.com/ryangptcodex/kch-team-analytics/blob/production/index.html) | HTML `index`, menambahkan widget di posisi yang diminta. |

Pasang **keempatnya bersama-sama**, lalu **Simpan**. Untuk `/dev`, refresh. Untuk `/exec`, perbarui deployment UJI COBA yang sama → ikon pensil → Versi baru → Terapkan → refresh. Tidak perlu mengganti file lain, mengubah master, membuat sheet manual, menekan Perbarui Sheet atau menjalankan repair.

Gunakan **Muat ulang** di halaman Skor setelah perubahan harga master/data atau untuk membaca data terbaru. Rekap diambil sekali untuk periode tersebut; mengganti sales pada periode yang sama memakai rekap yang sudah dimuat. Setelah menyimpan AA/branding melalui halaman Skor, rekap otomatis dimuat ulang. Mengubah bulan menghapus rekap lama selama permintaan baru diproses; respons lama tidak dapat menimpa bulan terbaru.

Jika data satu sales tidak valid, totalnya ditandai belum dapat dihitung dan alasannya ditampilkan; jangan dianggap skor0. Sales lain yang datanya valid tetap dapat muncul. Kegagalan rekap juga tidak menghalangi tabel AA/detail sales individual untuk dimuat.

## Pemeriksaan

**207 tes Node lulus, 0 gagal, 0 dilewati.** Cakupan tambahan: kesamaan skor rekap/detail untuk tiap tim, harga sesuai tim, pembulatan jumlah ke atas, alternatif Fokus B, satuan, harga hilang/ganda/tidak aktif, sisa AA/branding, target tercapai, perubahan transaksi/periode, pembacaan Tamu tanpa mutasi, data invalid, respons lama, cache/periode, pemisahan kegagalan rekap vs AA dan escaping teks master.

Browser Chromium pada 1440/390/320px lulus: posisi widget, rekap dua sales, catatan produk, perbaruan rekap setelah koreksi AA/branding, pergantian periode/sesi dan pembacaan oleh Tamu. Rekap mengambil satu snapshot master/transaksi/histori melalui satu pembacaan batch, tanpa permintaan Google Sheets terpisah untuk setiap sales.

Agen belum memasang atau memeriksa data Google nyata. Lakukan uji UJI COBA setelah penyalinan: cocokkan satu nilai rekap dengan detail sales, satu perkiraan Bejo dengan harga master timnya, alternatif Komix/Promag, serta sisa AA/branding.

## Pembaruan format dan Family — 28 Oktober 2026

Jika paket rekap sebelumnya sudah terpasang, cukup ganti **score.gs, score-client.html, dan index.html**. auth.gs tidak berubah. Simpan dan refresh /dev, atau terapkan versi baru pada deployment /exec yang sama. Tidak perlu input ulang AA/branding atau repair. Revisi ini menghitung ulang Fokus B tanpa Kids saat dibuka; transaksi historis tidak diubah. **209 tes Node lulus**, termasuk tiga alternatif, perubahan harga master, pemisahan Kids dari Fokus B dan pemisah baris/escaping.
