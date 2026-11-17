# Warna utama webapp mengikuti sidebar hijau

Warna utama sekarang `#167342`, sama dengan sidebar. Tombol utama, fokus input, tab aktif, badge utama, ikon dekoratif, progress, grafik, dan ilustrasi login memakai hijau beserta variasi terangnya. Grafik donat memakai lima tingkat hijau; warna legenda sama dengan masing-masing segmen.

Layout, ukuran, teks, widget, data, rumus, filter, hak akses dan mekanisme penyimpanan tetap. Warna merah/oranye untuk gagal dan peringatan, serta warna status absensi yang sudah dibedakan, dipertahankan. Logo Google pada tombol login tidak diwarnai ulang. Warna netral pada target grafik tetap membedakannya dari pencapaian.

## Pasang tiga file lengkap

Klik file, pilih **Copy raw file**, lalu ganti seluruh isi file yang sama pada Apps Script Production:

- [css.html](https://github.com/ryangptcodex/kch-team-analytics/blob/production/css.html) — HTML.
- [auth-ui.html](https://github.com/ryangptcodex/kch-team-analytics/blob/production/auth-ui.html) — HTML.
- [js.html](https://github.com/ryangptcodex/kch-team-analytics/blob/production/js.html) — HTML.

Simpan ketiganya, lalu terapkan **Versi baru pada deployment Production yang sama**, dan muat ulang `/exec`. Untuk `/dev`, Simpan dan muat ulang. Tidak perlu A3, reset, atau penerapan saldo awal. Tidak ada backend `.gs` yang perlu diganti untuk pembaruan warna ini.

## Validasi

- Seluruh 547 tes Node lulus, tanpa gagal atau dilewati.
- Browser foto/absensi, Tamu, Insentif, evaluasi dan Audit lulus.
- Seluruh 20 halaman diperiksa pada 12 perpindahan ukuran sampai 320 CSS pixel; empat grafik Chart.js nyata tetap menampilkan data dan merespons ukuran.
- Pemeriksaan tambahan memastikan warna utama hijau, warna dataset grafik hijau, dan legenda mengikuti grafik. Nilai dataset tetap sama.
- Perbandingan source CSS dan markup login membuktikan hanya nilai warna yang berubah; ukuran, struktur, serta teks identik. Perubahan JavaScript dibatasi warna tampilan dan pemilihan palet grafik, bukan perhitungan datanya.

Hijau mengikuti adaptasi sidebar yang sudah disetujui, bukan klaim kode HEX resmi panduan merek Kalbe. Agen tidak memasang file ke Google; pemasangan dilakukan pengguna.
