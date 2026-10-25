> Pembaruan implementasi: paket pembuatan transaksi/stok tersedia di cabang `uji-login` melalui `transactions.gs`. Validasi qty/harga/master/tanggal, penulisan finansial atomik, kode kiriman untuk retry dan teks literal telah ditambahkan dan diuji lokal. Pemasangan Google serta pengujian API nyata masih diperlukan; lihat [panduan paket](PANDUAN-UJI-LOGIN.md#paket-perbaikan-transaksi-dan-stok--25-oktober-2026). Status PENDING ambigu menahan transaksi baru sampai hasil dipastikan. Edit/cancel transaksi serta temuan laporan/absensi di bawah belum ditangani. Laporan berikut tetap merupakan bukti historis kode sebelum perbaikan.

**Review kesiapan KCH Team Analytics — 25 Oktober 2026**

Kesimpulan: fondasi login dan pembatasan akun sudah tersedia, tetapi transaksi dan stok belum layak dianggap siap operasional. Prioritas berikutnya adalah integritas transaksi, fitur edit yang sudah diminta pengguna, dan ketepatan laporan.

Review memakai kode cabang `uji-login`, commit aplikasi `0d564397388c1d7279413d53df84e8726a1fc318`. Versi file di Apps Script, konfigurasi sharing Google, dan seluruh data spreadsheet aktual belum dicocokkan langsung. Temuan simulasi di bawah memakai workbook, layanan Google dan pengguna terverifikasi tiruan; tidak memodifikasi spreadsheet pengguna.

**Bukti dan batas pengujian**

- Suite yang sudah ada: `node --test tests/*.test.cjs` → **64 lulus, 0 gagal**. Cakupannya terutama login, pembatasan akun, profil, logout, HK dan penghubung maintenance.
- Reproduksi tambahan: `node tools/review-repro.cjs`. Output tersimpan di [docs/review-observations-2026-10-25.jsonl](docs/review-observations-2026-10-25.jsonl). Script ini mencetak perilaku yang diamati, bukan suite regresi yang menyatakan bug sebagai perilaku benar.
- Pengujian tambahan berhasil menunjukkan kekurangan pada proses transaksi yang belum ditangani oleh suite 64 tes tersebut. Lulusnya suite tidak membuktikan seluruh aplikasi siap launch.
- Login admin dan satu sales pernah dikonfirmasi berhasil oleh pengguna pada deployment Google. Pilihan sales dan riwayat milik sendiri juga sudah dikonfirmasi. Pemasangan dan validasi semua pembaruan terakhir masih perlu dipastikan.
- Review ini menambah laporan dan alat reproduksi saja; tidak memperbaiki logika aplikasi atau mengubah deployment Google.

**P0 — perlu selesai sebelum transaksi operasional**

**R01. Jumlah dan total permintaan stok belum divalidasi ketat di server.**

Sumber: [saveSalesTransaction_](https://github.com/ryangptcodex/kch-team-analytics/blob/0d564397388c1d7279413d53df84e8726a1fc318/code.gs#L1668), pemeriksaan jumlah sekitar baris 1765.

Simulasi: stok 10, produk sama dua baris berjumlah 6 + 6 → transaksi berhasil, stok menjadi **−2**. Jumlah −2 → transaksi berhasil dan stok bertambah menjadi **12**. Jumlah 0 juga diterima oleh server. Validasi form positif tidak menggantikan validasi server.

Perbaikan: wajib jumlah bilangan bulat positif, gabungkan total per produk/distributor sebelum memeriksa stok, dan validasi ulang semua item sebelum menulis apa pun.

**R02. Harga, produk dan distributor belum diverifikasi terhadap master.**

Sumber: fungsi transaksi yang sama, harga dari payload sekitar baris 1790 dan penentuan distributor sebelum pemeriksaan stok.

Simulasi: master modal/jual 60/100, kiriman browser modal/jual 0/1 → nilai 0/1 disimpan. Produk INACTIVE tetap diterima. Nama distributor yang tidak dikenal tetap diterima dan mengurangi stok Global.

Perbaikan: ambil harga sah dari master di server; periksa produk aktif, harga untuk tim sales yang bersangkutan, distributor aktif dan kolom stok yang benar. Harga historis yang tersimpan dalam transaksi perlu dipertahankan saat mendesain edit, sesuai kebijakan koreksi transaksi.

**R03. Gagal menyimpan dapat meninggalkan stok dan transaksi tidak cocok.**

Sumber: pemotongan stok sekitar [baris 1826](https://github.com/ryangptcodex/kch-team-analytics/blob/0d564397388c1d7279413d53df84e8726a1fc318/code.gs#L1826), kemudian penulisan transaksi dan mutasi sekitar 1845–1853.

Simulasi: kegagalan penulisan transaksi setelah stok dipotong menghasilkan respons gagal, stok **8**, tetapi transaksi **0 baris**. Kegagalan pencatatan mutasi dapat meninggalkan stok 8 dan transaksi sudah tersimpan walaupun pengguna menerima respons gagal.

Script lock sudah ada untuk mengurutkan proses bersamaan; lock belum membuat beberapa operasi spreadsheet menjadi satu penyimpanan yang dapat dipulihkan. Perlu rancangan commit/pemulihan yang memastikan stok, transaksi dan mutasi konsisten. Sheet mutasi yang hilang saat ini juga tidak menghentikan transaksi; ini perlu dijadikan prasyarat yang diperiksa sebelum perubahan.

**R04. Pengiriman ulang belum aman dari transaksi ganda.**

Simulasi: mengirim payload yang sama dua kali mengurangi stok 10 → 8 → 6 dan menghasilkan dua transaksi. Mengulang setelah respons gagal pada penulisan mutasi juga membuat transaksi kedua.

Perbaikan: setiap penyimpanan memiliki identitas permintaan unik; server mengenali permintaan yang sudah diproses dan mengembalikan hasil sebelumnya. Tombol yang dinonaktifkan hanya membantu satu halaman browser dan tidak menyelesaikan retry jaringan atau tab lain.

**R05. Edit transaksi milik sendiri/admin belum tersedia.**

Sumber: [daftar operasi gateway](https://github.com/ryangptcodex/kch-team-analytics/blob/0d564397388c1d7279413d53df84e8726a1fc318/auth.gs#L276) dan fungsi transaksi di code.gs/js.html. Tersedia input, riwayat, detail dan ekspor; belum ada operasi update/edit transaksi atau pembatalan.

Ini kebutuhan yang sudah disepakati pengguna. Implementasi harus mempertahankan ID, membatasi sales ke transaksi sendiri, mengizinkan admin membantu, menghitung selisih stok termasuk pindah produk/distributor, mencatat pelaku sebenarnya dan nilai sebelum/sesudah, serta menahan perubahan berdasarkan versi transaksi agar dua edit tidak saling menimpa.

Pembatalan dengan alasan dan pengembalian stok juga diperlukan untuk memperbaiki faktur yang keliru tanpa menghapus jejak. Alur retur lebih lengkap dapat diputuskan terpisah.

**R06. Teks input belum dilindungi dari interpretasi formula spreadsheet.**

Sumber: catatan transaksi masuk langsung ke `setValues` pada kolom notes; catatan absensi juga masuk melalui `appendRow`. Simulasi membuktikan teks `=SUM(1,2)` diteruskan utuh ke setter sel.

API Google Sheets dapat menafsirkan string berawalan `=` sebagai formula. Escaping HTML di frontend tidak mencegah formula di database spreadsheet. Formula yang merujuk sel lain berpotensi memunculkan data di luar baris milik pengguna pada sel catatannya. Eksekusi formula dan dampak lintas pengguna belum diuji pada spreadsheet Google nyata; temuan ini berdasarkan jalur penulisan dan semantik API, bukan klaim eksploitasi yang telah dilakukan.

Perbaikan: gunakan penyimpanan literal teks yang konsisten pada semua input pengguna yang ditulis ke sheet, tanpa menonaktifkan verifikasi akses. Fitur nama tampilan sudah mempunyai validasi awalan, tetapi kolom input lain belum mendapat perlindungan seragam.

**P1 — ketepatan laporan dan absensi sebelum launch**

**R07. Grafik pencapaian Canvasser bisa berbeda dari penjualan sebenarnya.**

Sumber: [normalisasi tim dan akumulasi dashboard](https://github.com/ryangptcodex/kch-team-analytics/blob/0d564397388c1d7279413d53df84e8726a1fc318/code.gs#L802). Map memakai key uppercase, tetapi beberapa pemetaan menghasilkan `Canvasser` dengan huruf campuran.

Simulasi: penjualan Canvasser 100 masuk ke total cabang 100, tetapi pencapaian tim Canvasser menjadi **0**. Gunakan satu normalisasi key yang sama untuk seluruh pemetaan, penyaringan dan penjumlahan.

**R08. Target dan SHJ belum mempunyai satu aturan yang konsisten.**

Sumber: metadata memakai `getIndividualMonthlyTarget_` sekitar [baris 575](https://github.com/ryangptcodex/kch-team-analytics/blob/0d564397388c1d7279413d53df84e8726a1fc318/code.gs#L575), dashboard membaca target mentah sekitar [baris 733](https://github.com/ryangptcodex/kch-team-analytics/blob/0d564397388c1d7279413d53df84e8726a1fc318/code.gs#L733); frontend mempunyai salinan aturan lagi.

Simulasi: target Canvasser 30 juta → metadata/profil membacanya 80 juta, dashboard 30 juta. Jika SHJ master sengaja berbeda dari jual dikurangi modal, form dapat menampilkan nilai master sedangkan backend menyimpan selisih harga: fixture master SHJ 10, hasil tersimpan 40.

Perlu menetapkan satu sumber target dan definisi SHJ. Target untuk periode Hari Ini/Minggu/Bulan, sales nonaktif, dan perubahan tim/target pada bulan sebelumnya juga perlu aturan yang jelas. Laporan historis saat ini mengambil target dan profil sales saat ini, belum snapshot target per bulan.

**R09. Filter tanggal dapat menyembunyikan transaksi yang sebenarnya ada.**

Sumber: [perbandingan tanggal riwayat](https://github.com/ryangptcodex/kch-team-analytics/blob/0d564397388c1d7279413d53df84e8726a1fc318/code.gs#L1919). `getSheetData_` dapat mengubah sel Date menjadi `yyyy-MM-dd HH:mm:ss`, tetapi filter dibandingkan langsung dengan `yyyy-MM-dd`.

Simulasi: transaksi bertanggal `2026-10-25 00:00:00` muncul tanpa filter, tetapi hilang ketika memilih 25 Oktober. Ekspor/cetak memakai sumber penyaringan yang sama. Normalisasi tanggal diperlukan sebelum perbandingan.

**R10. Kegagalan baca ekspor bisa dilaporkan sebagai file kosong yang berhasil.**

Sumber: [getAllTransactionsForExport_](https://github.com/ryangptcodex/kch-team-analytics/blob/0d564397388c1d7279413d53df84e8726a1fc318/code.gs#L1979). Fungsi tidak memeriksa `res.success` dari paginasi.

Simulasi: pembacaan mengembalikan `success:false`, tetapi ekspor mengembalikan `success:true` dengan nol transaksi. Bedakan gagal membaca dari hasil valid yang memang kosong.

**R11. Validasi tanggal absensi dan status terlambat belum benar.**

Sumber: [saveSalesPhotoUpload_](https://github.com/ryangptcodex/kch-team-analytics/blob/0d564397388c1d7279413d53df84e8726a1fc318/code.gs#L1573). Tanggal hanya diperiksa bentuknya, sedangkan status selalu `Hadir Tepat Waktu`.

Simulasi: absensi masa depan diterima; `2026-02-31` diterima dan Date menormalkannya menjadi 3 Maret; waktu 23.59 tetap berstatus tepat waktu. HK terbaru sudah menolak tanggal masa depan/invalid ketika menghitung, tetapi pintu masuk absensi masih menerima data tersebut.

Usulan: sales absen untuk hari ini menurut waktu server; koreksi tanggal oleh admin memerlukan alasan dan jejak bantuan. Tetapkan jam masuk/toleransi sebelum memakai label tepat waktu/terlambat, atau tampilkan status netral Hadir. Belum ada checkout, formulir izin/sakit/cuti, edit/pembatalan absensi atau GPS; lokasi yang tersimpan sekarang berasal dari area profil sales, bukan pengambilan koordinat perangkat.

**R12. Foto memakai akses siapa pun dengan tautan dan kegagalan simpan dapat meninggalkan tautan rusak.**

Sumber: [setSharing foto](https://github.com/ryangptcodex/kch-team-analytics/blob/0d564397388c1d7279413d53df84e8726a1fc318/code.gs#L1569), append absensi lalu flush, serta cleanup pada catch.

Foto sekarang dapat dibuka siapa pun yang memiliki URL, tanpa melewati role aplikasi. Perlu keputusan akses foto sebelum penggunaan tim; mengubahnya menjadi privat saja belum cukup karena tampilan gambar juga harus tetap berfungsi untuk sales yang diizinkan.

Simulasi kegagalan flush setelah append meninggalkan satu baris absensi tetapi file fotonya dibuang ke trash oleh cleanup. Perlu membedakan kegagalan sebelum dan sesudah baris tersimpan serta memastikan retry tidak membuat catatan/foto ganda.

**P2 — operasional dan fitur berikutnya**

| Area | Kondisi sekarang | Yang perlu ditambahkan/disepakati |
|---|---|---|
| Stok masuk dan koreksi | Mutasi OUT dari penjualan ada; belum ada alur IN/penyesuaian/transfer lengkap | Admin mencatat stok masuk, koreksi, alasan dan saldo sebelum/sesudah; rekonsiliasi stok |
| Retur/pembatalan | Belum ada route atau UI | Pembatalan dengan alasan lebih dulu; retur sesuai kebutuhan bisnis |
| Tutup bulan | Belum ada periode transaksi yang dikunci | Tanggal edit, koreksi bulan lalu, target historis dan persetujuan admin sesuai kebutuhan |
| Audit | Aktivitas input ada; penulisan log dapat gagal diam-diam; edit belum ada | Jejak sebelum/sesudah untuk edit, alasan pembatalan, serta validasi sheet log/mutasi |
| Master data | Banyak perubahan produk, harga, sales dan stok masih melalui Sheets | Form admin dan validasi data agar perubahan manual tidak mudah salah |
| Harga produk baru | Sinkron harga sengaja berhenti jika PRICE_MASTER sudah berisi data | Alur menambahkan harga baru tanpa mereset harga yang sudah ada |
| Kalender kerja | Mendukung HOLIDAYS, default kode hanya dua tanggal contoh | Verifikasi daftar libur nasional/daerah yang benar untuk periode peluncuran |
| Sinkronisasi | Label Live Sync ada, tetapi tidak ada polling/push otomatis | Jelaskan sinkron manual atau tambahkan refresh terukur; stok tampilan dapat tertinggal dari pengguna lain |
| Performa | Metadata/history membaca banyak baris penuh; setiap RPC memverifikasi token lewat jaringan | Uji beberapa sales bersamaan dan volume realistis; kurangi baca berulang tanpa meng-cache akses akun secara basi |
| Pemulihan | Backup sebelum maintenance ada; belum ada backup berkala/restore yang diuji | Backup operasional, retensi dan percobaan pemulihan data |
| Error layar | Beberapa error ditelan; KPI awal berisi angka contoh seperti 147 juta/0 dari 26 hari | Status Memuat/Gagal yang jelas; jangan tampilkan angka contoh sebagai hasil riil |
| Ekspor/cetak | CSV ringkasan faktur dan cetak browser ada | Ekspor detail per produk jika diperlukan; uji popup cetak pada browser tim |
| Pengelolaan akses | ADMIN/SALES bekerja; label TEAM LEADER sudah terpisah dari role | Lindungi kolom kritis dan jelaskan nilai role agar tidak terulang lockout karena label jabatan |
| Deployment | Database dikonfigurasi ke spreadsheet UJI COBA | Siapkan konfigurasi produksi, pemisahan uji/operasional, versi rilis dan pemeriksaan hak berbagi Sheets/Drive |

Pemeriksaan tambahan sebelum launch: putuskan apakah semua sales memang boleh melihat seluruh master harga/modal dan stok distributor. Data tersebut sekarang dikirim dalam metadata; pembatasan transaksi sendiri tidak otomatis berarti harga/modal tim lain disembunyikan. Ini keputusan bisnis yang belum ditetapkan, bukan klaim pelanggaran izin yang sudah disepakati.

**Fitur yang sudah tersedia**

Login Google, allowlist akun, ADMIN/SALES, pembatasan data milik sales, menu akses admin, logout tanpa reload iframe, nama tampilan KCH, label TEAM LEADER, profil sales, input transaksi, stok tampilan, absensi/foto kunjungan, HK dari absensi unik, laporan bulanan, berita, agenda harian, rapat mingguan, daftar dokumen, CSV/cetak dan backup sebelum maintenance.

Keberadaan fitur tidak sama dengan seluruh alurnya terverifikasi pada Google. Poin absensi, laporan dan transaksi masih mempunyai kekurangan di atas.

**Urutan kerja yang disarankan**

1. Perbaiki validasi server, harga/master, penggabungan jumlah produk, penyimpanan teks literal, penyimpanan stok/transaksi/mutasi yang dapat dipulihkan dan retry yang tidak menggandakan data.
2. Tambahkan edit serta pembatalan transaksi dengan aturan kepemilikan, selisih stok dan riwayat perubahan yang sudah disepakati.
3. Samakan angka dashboard/profil/laporan, normalisasi tim/tanggal, perbaiki ekspor dan tentukan target historis serta definisi SHJ.
4. Perketat absensi: tanggal server, peran admin untuk koreksi, status kehadiran/jam masuk dan akses foto.
5. Cocokkan data Oktober dan stok akhir dengan sumber operasional, siapkan stok awal November dan konfigurasi produksi, lalu uji bersama beberapa sales termasuk input bersamaan, koneksi putus/retry dan pemulihan backup.

Tambahan seperti GPS, checkout, notifikasi belum absen, ekspor detail atau target per periode dapat menyusul sesuai kebutuhan. Tidak perlu menambah semua fitur sekaligus untuk launch pertama; integritas transaksi, koreksi dan ketepatan angka lebih mendesak.
