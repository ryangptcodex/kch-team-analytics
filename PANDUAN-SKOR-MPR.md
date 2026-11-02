# Tambahan Skor MPR/Canvasser — 28 Oktober 2026

Paket ini hanya memperluas fitur Skor ke **MPR** dan **Canvasser** serta menambahkan input branding harian admin. Aturan Skor Motoris/MMTW, pemetaan produk, perhitungan transaksi/stok/edit, dua akun Admin/Tamu, dan desain bagian lain tetap dipertahankan.

## Aturan per tim

| Parameter | Target MPR/Canvasser | Bobot / maks. poin MPR/Canvasser | Target Motoris/MMTW (tetap) | Bobot / maks. poin Motoris/MMTW |
| --- | ---: | ---: | ---: | ---: |
| Fokus A · Bejo Jahe Merah | **Rp6.400.000** | 40% / 40 | Rp5.000.000 | 40% / 40 |
| Fokus B · Komix Herbal Family + Promag Herbal | **Rp8.200.000** | 25% / 25 | Rp5.000.000 | 25% / 25 |
| Total Value (non Promag Tablet) | **Rp80.000.000** | 25% / 25 | Rp27.000.000 | 25% / 25 |
| Active Account (AA) | **400 outlet** | 5% / 5 | 400 | 10% / 10 |
| Branding | **300 outlet** | 5% / 5 | Tidak termasuk | Tidak termasuk |

Target MPR/Canvasser di atas mengikuti koreksi pengguna; bobot dan kategori tetap. Branding diinput admin **per sales per hari**, kemudian dijumlahkan untuk bulan terpilih. Total skor maksimal tetap 100. Tidak ada prorata target berdasarkan tanggal atau jumlah hari kerja. Pencapaian = aktual/target; poin = bobot desimal × pencapaian ×100; skor tiap parameter dibatasi maksimum; total asli tanpa ROUND menentukan kategori lama. Semua produk fokus tetap masuk Total Value; hanya kode Promag Tablet LPRGN dikecualikan, sama seperti paket sebelumnya.

MPR dan Canvasser mengikuti nama tim pada master SALES; kode lama TEAM-01 tetap dikenali sebagai Canvasser. Tim yang berbeda seperti Junior Canvasser, Asisten MPR, Motoris Ultimate, dan SPG tidak otomatis dimasukkan ke aturan baru ini.

## Pasang lima file lengkap bersama-sama di Apps Script UJI COBA

Buka masing-masing tautan → **Raw / Copy raw file** → ganti **seluruh isi** file yang sudah ada.

| File | Jenis di editor |
| --- | --- |
| [score.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/production/score.gs) | **Script `score`**, bukan HTML. Jika belum ada, + → Script → beri nama `score`. Berkas lengkap ini memuat `getScoreSetup_`, `getScoreReport_`, AA dan branding. |
| [auth.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/production/auth.gs) | Script `auth`: endpoint branding khusus admin; akun Tamu tetap hanya baca. |
| [score-client.html](https://github.com/ryangptcodex/kch-team-analytics/blob/production/score-client.html) | HTML `score-client`: tampilkan/input branding hanya saat sales MPR/Canvasser dipilih. |
| [index.html](https://github.com/ryangptcodex/kch-team-analytics/blob/production/index.html) | HTML `index`: kartu branding di halaman Skor. |
| [js.html](https://github.com/ryangptcodex/kch-team-analytics/blob/production/js.html) | HTML `js`: judul Skor mencakup MPR/Canvasser. |

Pertahankan file lain, termasuk css.html, code.gs/Kode.gs, transactions.gs, transaction-edits.gs, firebase-config.gs, auth-client.html, auth-ui.html, setup.gs dan manifest, pada versi terbaru yang sudah terpasang. Tidak perlu membuat sheet baru secara manual, mengubah master, menekan Perbarui Sheet, atau menjalankan repair.

Setelah lima file lengkap: **Simpan**. Untuk `/dev`, refresh aplikasi; untuk `/exec`, perbarui **deployment UJI COBA yang sama → ikon pensil → Versi baru → Terapkan**, lalu refresh. Kesalahan `getScoreSetup_ is not defined` berarti fungsi dari Script score.gs belum tersedia pada proyek/versi yang dibuka; pastikan seluruh berkas server score disalin sebagai **Script**, bukan hanya score-client HTML.

## Memakai branding

1. Admin membuka **Skor** dan memilih sales tim MPR atau Canvasser, lalu bulan penilaian.
2. Tabel parameter menampilkan AA maksimal 5 dan Branding target300, maksimal5.
3. Pada kartu **Branding · khusus MPR/Canvasser**, pilih tanggal, isi jumlah, lalu **Simpan branding**.
4. Isi bilangan bulat nonnegatif; isi 0 bila sudah diperiksa dan memang tidak ada branding. Tanda — berarti belum diinput. Tanggal masa depan dan sales nonaktif ditolak.
5. Koreksi pada sales/tanggal yang sama **mengganti** angka hari itu, bukan menambah nilai sebelumnya. Dua hari berbeda dijumlahkan untuk bulan tersebut.

Branding berasal dari angka harian admin, bukan jumlah faktur, transaksi, AA atau absensi. Fitur ini tidak menambah foto branding, identitas toko, insentif atau branding untuk tim lain.

Catatan branding menggunakan sheet histori Skor **SKOR_EVENTS** yang sama, dengan jenis catatan terpisah dari AA. Header dan histori AA lama tidak diubah. Kode kiriman, pemeriksaan revisi, audit admin, dan pemulihan respons hilang tetap dipakai: klik **Periksa / ulangi simpan** menggunakan kiriman yang sama bila hasil belum pasti. Jangan mengubah atau mengurutkan baris histori manual.

Akun **Tamu** bisa membaca Skor, angka branding, serta riwayat harian seluruh MPR/Canvasser; tidak memiliki form input. Server menolak endpoint simpan branding untuk Tamu, termasuk bila tombol/form dimunculkan secara manual. Motoris/MMTW tetap menampilkan empat parameter, AA10 poin, tanpa kartu branding; server juga menolak input branding untuk kedua tim tersebut.

## Uji cepat pada UJI COBA

- Pilih Motoris/MMTW: empat parameter, AA10, tanpa branding; nilai sebelumnya tetap.
- Pilih MPR/Canvasser: lima parameter, AA5, branding5; target300 sebulan penuh.
- Input branding10 pada satu hari, koreksi menjadi12: total12. Hari lain isi7: total19. AA tidak ikut berubah.
- Pilih bulan/sales lain: tidak membawa angka branding dari pilihan sebelumnya.
- Aktual AA400 dan branding300 memberi masing-masing5 poin. Aktual AA200 dan branding150 memberi masing-masing2,5 poin; melampaui target tetap maksimal5 per parameter.
- Buka akun Tamu: dapat melihat MPR/Canvasser dan angka branding, tanpa input. Kembali pilih Motoris/MMTW: kartu branding menghilang dan AA tetap10.

## Validasi pengembangan

**185 tes Node lulus, 0 gagal, 0 dilewati.** Tes baru meliputi aturan MPR/Canvasser, perlindungan aturan Motoris/MMTW, batas poin/presisi, input/koreksi branding, bulan/sales, validasi, audit/revisi, replay setelah respons hilang, benturan ID antara AA/branding, serta larangan tulis Tamu. Seluruh suite transaksi/edit/stok tetap dijalankan.

Chromium pada 1440/390/320px lulus untuk input/koreksi/replay branding, AA tetap terpisah, perpindahan MPR ↔ Motoris, lima/empat parameter, serta branding hanya baca bagi Tamu. Pemeriksaan browser akun Tamu dengan resolver/gateway asli dan layanan Google tiruan juga tetap lulus. Agen belum memasang atau menguji deployment Google nyata; lakukan uji penerimaan di UJI COBA setelah pemasangan.


Koreksi target MPR/Canvasser setelah paket awal: jika kelima file paket branding sudah terpasang, cukup ganti seluruh isi **Script score.gs** dari tautan di atas, Simpan, lalu refresh /dev atau perbarui versi deployment /exec. Empat file aplikasi lainnya tidak berubah dalam koreksi target ini.
