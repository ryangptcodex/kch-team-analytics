# Sidebar putih dan hijau KCH

Perubahan hanya tampilan sidebar, mengikuti referensi pengguna: latar putih, menu aktif hijau, teks gelap dan ikon sejajar. Teks dan urutan menu, hak Admin/Tamu, footer, lebar sidebar, serta tombol buka/tutup tetap memakai struktur dan mekanisme sebelumnya. Dashboard, login, widget, rumus dan tema halaman lainnya tidak diubah.

Hijau antarmuka `#167342` adalah adaptasi visual dari logo pada surat resmi Kalbe yang diunggah pengguna. Akses Google dan situs resmi Kalbe ditolak HTTP 403 oleh jaringan saat pemeriksaan; warna ini tidak diklaim sebagai kode HEX resmi panduan merek Kalbe.

## Pasang satu file

1. Buka [css.html lengkap di GitHub](https://github.com/ryangptcodex/kch-team-analytics/blob/production/css.html).
2. Klik **Copy raw file**. Di Apps Script Production, ganti seluruh isi file HTML **css.html**, lalu Simpan.
3. Untuk `/exec`, terapkan **Versi baru pada deployment Production yang sama**, lalu muat ulang. Untuk `/dev`, cukup Simpan dan muat ulang.

Tidak perlu mengganti file lain, A3 pembaruan sheet, reset, atau menerapkan saldo awal. Pemasangan ke Google tetap dilakukan pengguna.

## Validasi

- Seluruh 20 halaman pada 12 perpindahan ukuran dari 2560 sampai 320 CSS pixel lulus pemeriksaan responsive; empat grafik nyata tetap merespons perubahan ukuran.
- Gaya hasil komputasi dan geometri 2.919 elemen di luar sidebar identik sebelum dan sesudah tambahan CSS.
- Browser Admin/Tamu serta Audit lulus, termasuk pembatasan hak, logout, sesi, dan layar HP.
- Screenshot sidebar: [contoh dengan data simulasi](docs/sidebar-green-2026-11-18.png).

Seluruh selector tambahan dibatasi ke `.sidebar`. Tidak ada perubahan variabel tema global, markup HTML, JavaScript atau backend pada revisi ini.
