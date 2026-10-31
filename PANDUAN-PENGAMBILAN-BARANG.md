# Pengambilan barang dan sumber stok per produk

Paket cabang `uji-login` ini menambahkan perpindahan stok distributor → pegangan sales. Pencatatan pengambilan tidak membuat faktur penjualan, tidak menambah omzet, dan tidak menambah skor/insentif. Penjualan yang terjadi kemudian tetap dihitung melalui faktur seperti sebelumnya.

## Pasang sembilan file pada Apps Script UJI COBA

Gunakan **Copy raw file** pada GitHub, lalu di file tujuan Apps Script **Ctrl+A → Ctrl+V**. Pasang seluruh paket sebelum memakai webapp atau tombol pembaruan.

| File | Tindakan |
|---|---|
| `stock-pickups.gs` | Buat file **Script** baru bernama `stock-pickups` |
| `stock-client.html` | Buat file **HTML** baru bernama `stock-client` |
| `transactions.gs` | Ganti seluruh isi |
| `transaction-edits.gs` | Ganti seluruh isi |
| `auth.gs` | Ganti seluruh isi |
| `code.gs` / `Kode.gs` | Ganti seluruh isi file yang sudah ada; jangan membuat duplikat fungsi |
| `sheet-updates.gs` | Ganti seluruh isi |
| `index.html` | Ganti seluruh isi |
| `js.html` | Ganti seluruh isi |

File Skor, Insentif, CSS, login, manifest dan `setup.gs` yang sudah terpasang tetap digunakan. Paket dibuat dari versi terbaru cabang ini yang memuat akun Tamu, Skor dan Insentif Senior/Junior. Tidak perlu membuat proyek Firebase/API baru.

1. **Simpan** semua file Apps Script.
2. Buka spreadsheet UJI COBA → tab **PEMBARUAN_SHEET** → klik checkbox **A3 / PERBARUI SELURUH SHEET**. Tunggu status **Berhasil**. Ini tombol pembaruan tambahan yang membuat backup dan mempertahankan sumber data; jangan menjalankan fungsi repair/reset lama yang berakhiran underscore.
3. Untuk `/dev`: refresh webapp. Untuk `/exec`: **Terapkan → Kelola deployment → Edit → Versi baru → Terapkan**, lalu refresh URL yang dipakai Admin/Tamu.

Updater mencakup tiga sheet baru dan dua kolom transaksi:

- **SALES_STOCK**: saldo pegangan per `sales_id + product_id + distributor_id`. Saldo lama yang sudah ada tidak dihitung ulang atau direset.
- **SALES_STOCK_MOVEMENTS**: mutasi masuk/keluar pegangan sales, beserta asal distributor, ID referensi dan pelaku.
- **STOCK_PICKUPS**: satu baris per produk pengambilan, termasuk tanggal, sales, distributor, jumlah dan referensi foto bila ada.
- **SALES_TRANSACTIONS**: menambah `stock_source` dan `stock_distributor_id` setelah 18 kolom lama. Sel/kolom tambahan lama digeser utuh, tidak dihapus. Transaksi lama dengan sumber kosong tetap dianggap langsung distributor yang tercatat pada baris tersebut.

Pembaruan tetap mencakup modul laporan Insentif sebelumnya, tanpa mengubah rumusnya. Pengambilan tidak menjadi sumber perhitungan laporan penjualan/Skor/Insentif. Laporan hasil sinkron dihitung ulang dari transaksi yang benar-benar tersimpan.

## Pengambilan barang

Buka menu **Pengambilan Barang**. Admin mengisi tanggal, distributor asal, sales penerima, satu atau beberapa produk dan jumlah bulat positif. Distributor menggunakan master GMP / PT. Global Mitra Prima (Subdist) atau Geubrina Rizki/Rizky (Panel); kode dan nama master tetap dipertahankan. Produk berulang pada satu pengambilan dijumlahkan sebelum cek stok.

Foto bukti opsional: JPEG/PNG/WebP, dikompres di browser hingga maksimal sekitar2MB; file asli maksimal15MB sebelum kompresi. Tunggu status **Foto siap dilampirkan**. File dibuat di Drive akun pemilik deployment; kode tidak membagikannya secara publik. Admin dan Tamu yang sudah login melihat bukti melalui tombol **Lihat foto** pada riwayat di aplikasi.

Saat simpan berhasil, stok distributor berkurang dan pegangan sales bertambah dengan jumlah sama. Saldo dan riwayat terlihat pada halaman yang sama. Riwayat menampilkan maksimal500baris produk pengambilan terbaru; saldo pegangan tetap memakai seluruh saldo aktif, bukan hanya500baris itu. Tidak ada form edit/pembatalan pengambilan pada paket ini; jangan menghapus baris saldo/jurnal secara manual.

## Penjualan: sumber di setiap baris produk

Pada **Input Penjualan**, kolom **Sumber stok** menyediakan:

- **Distributor pilihan faktur**: perilaku lama, langsung dari distributor yang dipilih di bagian atas.
- **Langsung — [distributor]**: potong distributor pada baris tersebut.
- **Pegangan sales — [distributor asal]**: potong pegangan sales penerima, khusus asal distributor itu. Gudang distributor tidak dipotong lagi.

Satu faktur boleh mencampur sumber/distributor, termasuk produk sama dengan sumber berbeda. Harga dan subtotal tetap dihitung sebagaimana transaksi biasa. Dropdown sumber selalu menyebut asal distributor; saldo pegangan tidak dicampur antar-sales atau antar-distributor.

**Detail Riwayat Transaksi** menampilkan sumber dan distributor asal untuk setiap produk. Ringkasan faktur menampilkan **Campuran** bila distributor berbeda. Filter distributor memilih faktur yang memiliki distributor itu dan tetap menampilkan total seluruh faktur, bukan subtotal satu sumber.

## Edit transaksi

Pada modal Edit, sumber stok juga dipilih tiap baris. Saldo lama dipulihkan secara virtual untuk validasi, lalu hanya selisih akhir ditulis. Contoh:

- Pegangan qty2→3: pegangan berkurang1, stok gudang tetap.
- Pegangan qty3→1: pegangan bertambah2, stok gudang tetap.
- Langsung GMP→pegangan asal GMP: saldo gudang yang semula dipotong dikembalikan; pegangan dipotong sesuai qty baru.
- Pegangan asal GMP→pegangan asal Geubrina: pegangan GMP dikembalikan dan pegangan Geubrina dipotong. Gudang tidak berubah.
- Produk dihapus: kembali ke sumber lamanya sendiri.

Pilihan distributor di bagian atas modal tetap menjadi default. Menggantinya mengalihkan baris sumber **langsung** ke distributor baru; baris pegangan mempertahankan asalnya sampai diubah pada sumber perbaris. Harga historis, pemeriksaan versi dua-tab dan audit alasan edit sebelumnya tetap berlaku.

## Izin dan pemulihan hasil

Hanya Admin boleh membuat pengambilan/penjualan/edit. Tamu boleh membaca saldo, riwayat dan foto, tanpa hak tulis. Pembatasan diterapkan di server dan UI. Data sesi/foto di browser dibersihkan saat logout.

Pengambilan memakai jurnal `_KCH_TX_REQUESTS`, lock dan batch atomik yang sama dengan transaksi/edit: saldo gudang, pegangan, mutasi, riwayat pengambilan, audit serta receipt COMMITTED tersimpan bersama. Kegagalan subrequest tidak meninggalkan perpindahan sebagian. Request ID ulang mengembalikan hasil sebelumnya, bukan memindahkan barang lagi. Browser hanya menyimpan ID pemulihan di sessionStorage, bukan payload/foto.

Bila jaringan terputus, gunakan **Periksa hasil**. Hasil PENDING yang belum pasti menahan seluruh penulisan stok dan pembaruan sheet sampai hasilnya diketahui. Jangan menghapus jurnal, mengubah saldo manual atau membuat kiriman baru untuk melewati kondisi ini. Foto dibuat sebelum batch Sheets; pada penolakan batch yang pasti foto yang tidak dipakai dicoba dibuang. Pada hasil tidak pasti foto dipertahankan, karena batch mungkin masih berhasil. Kegagalan Drive dapat meninggalkan file bukti tanpa catatan; itu tidak memindahkan stok dan perlu diperiksa admin jika terjadi.

Lock mengurutkan penulis dari proyek Apps Script yang sama; perubahan langsung pada sheet atau proyek lain tidak ikut lock. Jangan mengedit saldo manual selama aplikasi menyimpan.

## Uji pertama pada salinan

1. Catat stok satu produk di GMP, lalu ambil **qty5** untuk satu sales. Harus: GMP−5, pegangan asalGMP+5, tidak ada faktur/omzet tambahan.
2. Jual **qty2 dari pegangan asalGMP**. Harus: pegangan tersisa3, stokGMP tetap, hanya penjualanqty2 masuk omzet.
3. Coba satu faktur dua baris: satu dari pegangan dan satu langsungGeubrina. Periksa saldo masing-masing serta dua sumber di detail faktur.
4. Edit qty/sumber lalu pastikan barang kembali ke sumber lama dan berkurang dari sumber baru. Saldo tidak boleh negatif.
5. Uji Tamu: bisa melihat menu/riwayat/saldo/bukti, tetapi form input dan tombol tulis tidak tersedia.
6. Klik Perbarui Seluruh Sheet lagi: saldo dan catatan pengambilan lama tetap; tidak ada kolom atau baris sumber yang digandakan.

Validasi lokal: 313tesNode lulus (288regresi+25baru). Chromium menguji alur produksi dengan Google tiruan: loginAdmin/Tamu, transfer tanpa/denganfoto, sumbercampuran, detail, editsumber, reset-sesi dan lebar2560/1440/390/320px. LayananGoogle nyata/deployment/spreadsheet belum diubah dari workspace ini; pemasangan dan ujiUJI COBA dilakukan pengguna.

## Tambahan: Setoran Pegangan Sales (uang)

Pengguna menegaskan setoran adalah **uang hasil penjualan**, hanya untuk catatan agar mudah diingat. Widget berada tepat **di bawah Stok Pegangan Sales**, sebelum Riwayat Pengambilan. Tidak menginput pencapaian ulang, tidak menambah omzet/Skor/Insentif, tidak mengurangi pegangan barang, serta tidak mengubah status/lunas/tagihan faktur.

Admin mengisi tanggal, sales penyetor, distributor, nominal Rupiah positif (tanpa pemisah ribuan pada form), catatan opsional dan foto bukti opsional. Nominal mendukung maksimal dua desimal. Tanggal nyata, tidak boleh masa depan. Foto memakai kompresi, batas ukuran, akses privat dan pemeriksaan login yang sama dengan bukti pengambilan; foto setoran dan pengambilan dipisahkan pada form serta endpoint pembacaannya.

Tabel pada widget menampilkan tanggal, sales, distributor, nominal, catatan dan tombol **Lihat foto** jika dilampirkan. Admin boleh menambah; Tamu hanya membaca. Riwayat menampilkan500catatan terbaru. Setiap simpan membuat catatan baru dengan ID CASH dan pelaku. Tidak tersedia edit/pembatalan catatan setoran dalam paket ini.

Sheet **SALES_CASH_DEPOSITS** berisi `deposit_id, deposit_date, sales_id, sales_name, distributor_id, distributor_name, amount, notes, photo_file_id, photo_url, created_by, created_at`. Skema ditambahkan melalui modul pengambilan yang sudah terdaftar: tombol **Perbarui Seluruh Sheet** otomatis membuat tab ini tanpa mengubah catatan/stock/faktur lama. API juga dapat membuat tab kosong tersebut pada penyimpanan pertama. Audit CREATE_CASH_DEPOSIT ditulis bersama memo dan receipt atomik; tidak menggunakan CREATE_TRANSACTION. Klikulang/retry kode sama tidak menggandakan memo. Mekanisme PENDING/Periksa hasil dan pemulihan foto mengikuti pengambilan.

Jika paket9file pengambilan di atas sudah dipasang, **ganti enam file** berikut: **stock-pickups.gs, transactions.gs, auth.gs, stock-client.html, index.html, js.html**. Tidak ada file baru untuk tambahan setoran. Simpan semuanya → klik **PEMBARUAN_SHEET A3 / Perbarui Seluruh Sheet**, tungguBerhasil → refresh `/dev` atau terapkan versi baru `/exec` lalu refresh. `sheet-updates.gs` yang terbaru dari paketpengambilan memakai registrydinamis sehingga tidak perlu diganti lagi hanya untuk tambahan skema ini.

Jika belum memasang paketpengambilan9file, pasang semua9file dari tabel utama menggunakan versi terbaru cabang `uji-login`; versi tersebut sudah mencakup setoran. Jangan hanya memasang enam file tambahan di atas fondasi transaksi lama.

Uji memo: catat stok, jumlahfaktur dan pencapaian sebelum uji, lalu simpan setoran **Rp100.000** untuk satu sales. Harus muncul satu catatan setoran, sementara seluruh angka penjualan/Skor/Insentif danstok tetap. Coba foto; buka melalui Tamu, pastikan formtulis tersembunyi. Nominalnol/negatif ditolak. Klik PerbaruiSeluruhSheet kembali harus mempertahankan barissetoran lama.

Pengujian tambahan: total **327tesNode lulus** (313sebelumnya+12backendmemo+2clientrecovery). BrowserproductionUI+Googlemock menguji catatan tanpa/denganfoto, proofGuest, posisiwidget, cash/pickupphotoindependent, tanpa perubahanbusinessledger, logout dan responsive2560/1440/390/320. Belum ada penyimpanan setoran atau pemasanganGoogle nyata oleh agen.
