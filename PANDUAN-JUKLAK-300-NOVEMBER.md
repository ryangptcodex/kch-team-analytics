# Juklak surat 300 — perubahan mulai November 2026

Implementasi mengikuti surat No. 300/CCDM-AEO/X/2026 dan jawaban pengguna: setelah batas bulanan habis, tambahan penjualan tidak lagi menambah TV yang diperhitungkan, termasuk untuk insentif harian. Tidak ada perubahan spreadsheet atau deployment Google oleh agen.

## Aturan yang diterapkan

| Tim pada kalkulator yang sudah ada | Kode | Produk | Maksimal TV per sales per bulan |
|---|---|---|---:|
| Motoris/MMTW | TNTPK | Entrostop Tablet | Rp5.000.000 |
| MPR/Canvasser | TMXGF | Mixagrip Flu | Rp4.000.000 |
| MPR/Canvasser | TMXGE | Mixagrip Flu & Batuk | Rp4.000.000 |
| MPR/Canvasser | TMXTG | Mextril Batuk | Rp4.000.000 |

Tiga kode Canvasser dikonfirmasi pengguna pada 18 November 2026. TMXTG adalah Mextril Batuk; penamaan lama “Mixgrip Tablet Box” pada panduan telah dikoreksi. Batas dipetakan ke **kode**, sehingga mengganti nama master tidak mengubah hasil. Ketiganya sudah termasuk daftar loading; daftar tersebut tidak ditambah/dikurangi.

Batas dihitung secara kumulatif menurut tanggal bisnis, terpisah untuk setiap sales, SKU dan bulan kalender. Misalnya TNTPK sudahRp4,8 juta, lalu terjualRp500 ribu: yang menambah TV hanyaRp200 ribu. Setelah habis, tambahan berikutnyaRp0 TV. Pemecahan faktur atau urutan input baris tidak mengubah total harian. Tanggal masa depan tidak memakai jatah bulan yang sedang dihitung.

TV ini dipakai pada Skor, insentif harian, bulanan, triwulan, dan tiga laporan sheet INSENTIF. Untuk triwulan, setiap bulan dihitung memakai kebijakannya: Oktober masih tanpa batas baru, November dan Desember masing-masing mempunyai batas sendiri. Tarif bonus tetap mengikuti juklak yang sudah ada. Junior tetap mengikuti 70% hasil Senior tanpa jatah SKU atau potongan kedua.

Insentif harian Motoris/MMTW mulai November juga wajib memenuhi **PF A+PF B minimal Rp400.000 pada hari yang sama**. Tepat Rp400.000 memenuhi. Nilai PF sendiri tetap memakai penjualan produk fokus; tarif harian dan faktor pembayaran bulanan yang lama tidak diganti.

Retur/void yang sudah dicatat melalui mekanisme aplikasi dihitung sebagai pengurang penjualan neto. Jika penjualan neto masih di atas plafon, TV yang diakui tidak berkurang; setelah turun di bawah plafon, TV ikut berkurang sebesar selisih. Edit faktur menghitung ulang alokasi tanggal yang terdampak saat laporan dimuat.

## Yang dipertahankan

- Transaksi asli, omzet transaksi/dashboard/ekspor, harga, stok gudang dan pegangan tetap mengikuti transaksi penuh. Batas ini hanya untuk TV pencapaian.
- Layout/widget, hak Admin/Tamu, foto/absensi, master, saldo awal, aturan AA/branding, daftar loading, serta nominal tarif tidak dirombak.
- Keputusan evaluasi tepat 70/80 dan mekanisme tindak lanjut sebelumnya belum diubah. Ketentuan HR/approval RM pada surat tidak dijadikan tindakan akun otomatis.
- Tidak menetapkan batas akhir Desember secara diam-diam: surat menyebut berlaku mulai November. Kebijakan tetap aktif mulai periode tersebut sampai ada revisi baru yang disetujui.

## Empat file lengkap untuk Apps Script Production

Gunakan file lengkap dari cabang **production** pada tautan berikut. Buka file, klik **Copy raw file**, lalu ganti seluruh isi file yang sama di Apps Script.

| File | Jenis pada editor |
|---|---|
| [period-masters.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/production/period-masters.gs) | Script |
| [score.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/production/score.gs) | Script |
| [incentives.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/production/incentives.gs) | Script |
| [incentive-client.html](https://github.com/ryangptcodex/kch-team-analytics/blob/production/incentive-client.html) | HTML |

1. Selesaikan/periksa input yang sedang berjalan. Ganti seluruh isi keempat file pada proyekProduction yang sama lalu Simpan semuanya; jangan menguji saat baru sebagian file terpasang.
2. Klik **PEMBARUAN_SHEET → A3 PERBARUI SELURUH SHEET**, tunggu Berhasil. Updater aman yang sudah ada merekam versi aturanTV pada snapshot bulan berjalan dan menyegarkan laporan turunan. Tidak ada schema baru; tidak perlu reset, inisialisasi Production, menghapus jurnal, atau menerapkan saldo awal.
3. Pada deploymentProduction yang sama pilih **Versi baru → Terapkan**, lalu muat ulang `/exec`. Nomorversi ditentukan Apps Script; jangan menganggap V17 otomatis berubah.
4. Buka Insentif November dan Skor. Penjelasan batas harus muncul. Tabel harian menampilkanTV diperhitungkan, **TV sebelum batas**, dan **selisih batas**. “TV sebelum batas” masih mengikuti produk yang memenuhi cakupan tim, bukan total seluruh omzet termasuk produk yang dikecualikan.
5. Periksa catatan bisnis yang memang sudah ada; tidak perlu membuat transaksi fiktif. Lihat Oktober untuk memastikan aturan lama tetap dipakai. Bukti monitor/backup/checkKchTransactionSetup Production sebelumnya tetap dipertahankan, bukan diminta ulang tanpa gejalabaru.

## Bukti pengujian

- Seluruh 547 tes Node lulus:529 regresi sebelumnya dan 18 tes baru.
- Regresi baru meliputi sisa plafon, tanggal/urutan input, pemisahan sales/bulan, PF Rp400 ribu, histori Oktober, tiga SKU terkonfirmasi, nama master berubah, snapshot lama, signed return, edit/recompute, bonus Q4, Junior 70%, identitas versi, Tamu, dan kesamaan laporan native dengan web.
- Browser Skor, Insentif, evaluasi, Tamu dan suite baru TV lulus. Suite baru memakai HTML/JS aplikasi sebenarnya dan backend Google tiruan; memeriksa Motoris dan Canvasser, selisih yang terbaca, alasan PF, Skor, data usaha tetap, serta layar 1440/390/320.
- File aplikasi lolos parse dan pemeriksaan whitespace. Tes menggunakan Google simulasi; tidak membuktikan keempat file sudah dipasang atau data Production terkini telah dibaca agen.

Versi aturan TV: `KCH_TV_300_2026_11`. Versi ini disimpan terpisah dari aturan tarif dan evaluasi. Metadata versi/batas yang tidak dikenal tidak disahkan sebagai kebijakan yang valid. Snapshot November lama tanpa penanda TV mengikuti revisi November yang baru disetujui ini; sumber transaksi dan master historis tetap memakai mekanisme snapshot yang ada.
