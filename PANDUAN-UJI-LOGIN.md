# Uji login Google — salinan KCH

Kode ini ditujukan hanya untuk spreadsheet salinan **KCH Analytics - UJI COBA**.
Belum ada deployment atau perubahan pada spreadsheet Google yang dilakukan dari workspace ini.

## Yang disiapkan

- Admin awal: `mhmdryyan7@gmail.com`.
- Spreadsheet uji: `1zExCrUfi2umx1-AG4kmGS11ZEVFrqGA2PEjClle0z4A`.
- Login Google melalui Firebase, dengan sesi di memori browser.
- Identitas diverifikasi server menggunakan Firebase Identity Toolkit; token dari browser tidak dipercaya tanpa verifikasi Google.
- Sheet baru `ACCESS_USERS` dibuat ketika admin pertama berhasil masuk. Sheet lama `USERS` tidak dihapus atau dipakai untuk password.
- Pendaftaran Gmail sales, pengaitan dengan `sales_id`, dan penonaktifan akses melalui menu pengguna admin → **Kelola akses sales**.
- Pembatasan data sales di server, termasuk riwayat, detail, ekspor, absensi dan foto kunjungan.
- Fungsi setup tidak tersedia sebagai RPC browser. Menu pemeliharaan spreadsheet tetap ada; jangan jalankan perbaikan massal untuk menguji login.
- Catatan transaksi menggunakan email pelaku terverifikasi. Unggah foto mencatat pelaku dan sales yang dibantu di `ACTIVITY_LOGS` jika sheet tersebut tersedia.

## Pasang hanya di Apps Script salinan

1. Buka spreadsheet **UJI COBA** → **Ekstensi → Apps Script**. Pastikan ini proyek salinan.
2. Ganti seluruh isi empat file berikut menggunakan file dalam paket: `code.gs`, `setup.gs`, `index.html`, `js.html`. Perubahan harus dipasang bersama karena fungsi server dan pemanggilan browser saling bergantung.
3. Buat dua file **Script** melalui tombol **+**: `auth` dan `firebase-config`. Isi dari `auth.gs` dan `firebase-config.gs`. Editor menambahkan ekstensi `.gs`.
4. Buat dua file **HTML**: `auth-ui` dan `auth-client`. Isi dari `auth-ui.html` dan `auth-client.html`. Gunakan nama lengkap ini agar file halaman login mudah dibedakan dari file Script `auth.gs`.
5. `css.html` dan `appsscript.json` tetap sama dengan kiriman awal. Paket memuat keduanya untuk kelengkapan.
6. Klik **Simpan**. Jangan memasukkan folder `tests`, folder `config`, atau panduan ini ke editor Apps Script.

File `firebase-config.gs` berisi konfigurasi web publik, Gmail admin, dan ID spreadsheet uji. Jangan memasukkan private key atau file service account.

## Siapkan pengujian deployment

1. Di Firebase, pastikan **Authentication → Sign-in method → Google** sudah aktif, dengan support email terpilih.
2. Di Apps Script salinan pilih **Deploy → Test deployments / Uji deployment → Web app**. Jika pilihan itu tidak tersedia, gunakan **Deploy → New deployment → Web app** di proyek salinan.
3. Gunakan **Execute as: Me / Saya**. Aplikasi perlu izin akun pemilik untuk mengakses spreadsheet; izin sales diberikan oleh kode login, bukan akses edit spreadsheet.
4. Untuk deployment web app gunakan **Who has access: Anyone / Siapa saja** bila tersedia. Halaman login boleh terbuka, tetapi API data menolak pengguna tanpa token dan akses yang sah. Deployment percobaan `/dev` biasanya hanya bisa dibuka editor proyek; gunakan deployment `/exec` terpisah untuk uji akun sales tanpa memberi mereka akses editor.
5. Selesaikan otorisasi akun pemilik. Kode membutuhkan Spreadsheet, Drive untuk foto, dan permintaan HTTPS keluar untuk verifikasi Firebase. Periksa proyek dan akun yang diminta izin.
6. Buka URL uji sebagai tab browser tersendiri, lalu klik **Masuk dengan Google** dan pilih Gmail admin.
7. Jika muncul `auth/unauthorized-domain`, layar login menampilkan hostname iframe Apps Script yang perlu ditambahkan di **Firebase Authentication → Settings → Authorized domains → Add domain**. Tambahkan hostname persis tanpa `https://` atau path. Firebase memakai domain halaman iframe, yang bisa berbeda dari `script.google.com`. Muat ulang dan coba lagi. Jangan menambahkan wildcard atau domain yang tidak terkait.
8. Bila popup diblokir, izinkan popup untuk halaman ini. Bila ada error lain, kirim teks error dan langkah yang memicunya; jangan kirim ID token, access token, atau log yang berisi token.

Jangan menganggap login sudah bekerja sebelum pengujian browser nyata berhasil. Kebijakan browser terkait iframe, popup, dan penyimpanan pihak ketiga dapat memengaruhi login Firebase dalam Apps Script.

## Jika muncul AUTH_UNAVAILABLE saat verifikasi Google

Pesan ini berasal dari kegagalan `UrlFetchApp.fetch` sebelum respons HTTP diterima. Penyebabnya belum tentu koneksi internet: izin OAuth Apps Script yang belum diberikan juga dapat menghasilkan pesan ini.

1. Salin versi terbaru `auth.gs` ke Apps Script salinan lalu simpan.
2. Di dropdown fungsi editor, pilih `checkKchGoogleConnection` **tanpa underscore di akhir**, lalu klik **Run / Jalankan**. Fungsi privat berakhiran `_` tidak ditampilkan oleh editor pengguna. Pemeriksaan ini hanya menerima akun Google aktif yang cocok dengan Gmail admin; akun pemilik efektif deployment tidak dipakai untuk memberi akses.
3. Jika diminta otorisasi, pilih akun pemilik deployment dan periksa serta berikan izin yang diperlukan. Pengujian ini tidak membaca atau mengubah spreadsheet, tidak menjalankan setup dan tidak memakai token login pengguna.
4. Baca **Execution log / Log eksekusi**. Hasil HTTP 400 `INVALID_ID_TOKEN` dengan `connectionOk: true` diharapkan: kode sengaja memakai token palsu untuk membuktikan layanan dapat dihubungi. Hasil itu belum membuktikan login pengguna berhasil.
5. Jika koneksi lolos, refresh halaman `/dev` lalu coba masuk lagi. Jika tidak lolos atau login tetap gagal, kirim laporan diagnostik atau teks error terbaru; jangan menebak masalah atau mengubah pembatasan API key sebelum hasilnya diketahui.

## Pemeriksaan penerimaan

1. **Admin**: masuk dengan Gmail admin, pastikan profil berperan ADMIN dan sheet `ACCESS_USERS` terbentuk hanya di spreadsheet uji.
2. **Daftarkan sales**: buka menu akun → **Kelola akses sales**, isi Gmail, pilih ID sales yang sesuai, pilih Aktif, lalu Simpan akses.
3. **Sales**: gunakan browser/profil terpisah, masuk sebagai sales terdaftar. Dashboard, absensi dan transaksi hanya memuat miliknya. Menu pengelolaan akses tidak muncul.
4. **Akun tak terdaftar**: login harus ditolak dan data aplikasi tidak tampil.
5. **Nonaktifkan akses**: nonaktifkan sales dari admin, lalu lakukan permintaan data baru dari browser sales. Server harus menolak meskipun akun Google masih masuk.
6. **Keluar**: pilih Keluar akun; halaman langsung menampilkan login di dokumen yang sama. Data akun, formulir, modal, grafik dan menu admin sebelumnya dibersihkan tanpa reload iframe. Setelah Firebase berhasil sign out, tombol Masuk dengan Google aktif kembali. Muat ulang manual juga mengharuskan login kembali karena sesi Firebase tidak disimpan permanen.

## Pembaruan logout agar tidak menjadi halaman putih

Ganti seluruh isi `auth-client.html` dan `js.html` dengan versi terbaru dari cabang uji-login, lalu simpan. `auth-client.html` menampilkan login tanpa memuat ulang URL internal iframe Apps Script, menghapus data/tampilan sesi lama, serta membangun ulang menu sesuai peran akun berikutnya. `js.html` membatalkan kelanjutan unggah foto yang masih dikompres saat sesi berganti. Ini tidak menghapus data spreadsheet atau akun Firebase.

Untuk `/dev`, simpan lalu muat ulang URL aplikasi melalui tab browser. Untuk `/exec`, perbarui deployment yang sudah ada lewat **Terapkan → Kelola deployment → ikon pensil → Versi baru → Terapkan**, lalu muat ulang URL yang sama.

Uji: masuk sebagai admin → Keluar akun → pastikan layar login langsung muncul → masuk sebagai sales di tab yang sama → pastikan menu admin dan data akun lama tidak terbawa. Jika sign out Firebase gagal, halaman tetap terkunci tanpa menyatakan logout berhasil. Pengguna dapat memilih akun lagi melalui tombol **Masuk dengan Google**.

## Pembaruan dropdown profil pada menu akses sales

Untuk memasang perbaikan dropdown kosong, ganti seluruh isi **tiga file sekaligus** dari cabang uji-login: `auth.gs`, `auth-client.html`, `auth-ui.html`.
Daftar profil kini dimuat langsung dari server bersama daftar akun saat panel dibuka, tanpa menunggu metadata dashboard. Panel menunjukkan status memuat, gagal, atau sheet SALES kosong; simpan dinonaktifkan selama profil belum tersedia. Akun sales yang sudah terdaftar memiliki tombol **Ubah** untuk mengisi Gmail, profil dan statusnya.

Setelah menyimpan di editor, halaman `/dev` cukup dimuat ulang. Untuk URL `/exec`, buka **Terapkan → Kelola deployment → pilih deployment uji → ikon pensil → Versi baru → Terapkan**, lalu muat ulang URL `/exec` yang sama. Tidak perlu membuat deployment baru atau URL lain.

Untuk mengaktifkan kembali akun: masuk sebagai admin → Kelola akses sales → tunggu profil selesai dimuat → klik **Ubah** pada baris akun sales → ubah status menjadi **Aktif** → **Simpan akses**. Setelah itu uji login kembali di akun sales.

## Batas tahap ini

Pengujian lokal: `node --test tests/*.test.cjs` menggunakan tiruan layanan Google/Spreadsheet dan DOM panel akses. Pengujian itu memeriksa aturan akses, penanganan kegagalan serta pemuatan profil secara asinkron, bukan login Google nyata, izin Drive, atau deployment Apps Script.

Ini paket **uji login**, belum versi siap launch. Fungsi edit transaksi belum ditambahkan. Validasi jumlah/harga, gabungan produk ganda dan pemulihan penyimpanan transaksi saat gagal masih memerlukan perbaikan tahap berikutnya. Jangan gunakan paket ini untuk transaksi operasional atau menganggap stok sudah terverifikasi. Data salinan dapat berubah bila fungsi tulis dijalankan.

Saat menyalin proyek lagi, perbarui ID spreadsheet uji dalam `firebase-config.gs`; kode sengaja menggunakan ID eksplisit agar deployment tidak memilih spreadsheet yang tidak jelas.

## Tombol spreadsheet: fungsi repairAndOptimizeSpreadsheet tidak ditemukan

Tombol/menu spreadsheet lama dapat masih memanggil `repairAndOptimizeSpreadsheet`, sedangkan implementasi internal telah diberi nama privat `repairAndOptimizeSpreadsheet_`. Perbarui seluruh isi `setup.gs` dari cabang uji-login, simpan, kemudian refresh tab spreadsheet UJI COBA agar menu dibangun ulang. Nama callback lama sekarang kembali tersedia melalui penghubung yang dibatasi ke akun admin dan konteks spreadsheet aktif dengan ID salinan uji yang dikonfigurasi.

Ini adalah perbaikan menu spreadsheet: tidak perlu memperbarui deployment web app untuk menguji tombol di sheet. Menu baru dan tombol lama yang memakai nama `repairAndOptimizeSpreadsheet` memanggil penghubung yang sama.

Fungsi pembaruan lama dapat mengubah struktur, menghapus sheet lama dan mengubah akses foto Drive. Penghubung baru mengambil script lock lalu membuat salinan penuh spreadsheet di Google Drive dengan nama berakhiran **BACKUP tanggal/jam** sebelum menjalankannya. Jika penyalinan gagal, pembaruan dibatalkan. URL cadangan dicatat di log eksekusi sebelum perubahan dimulai dan disertakan pada pesan jika pembaruan gagal. Cadangan spreadsheet tidak membatalkan perubahan izin file foto Drive; periksa kebutuhan pemeliharaan sebelum menjalankan fungsi ini.

Perbaikan penghubung dan urutan backup diuji secara lokal dengan tiruan layanan Google. Migrasi lengkap belum dijalankan atau diverifikasi terhadap data spreadsheet pengguna dari workspace ini.

## Tampilan login dengan ilustrasi dashboard

Ganti seluruh isi `auth-ui.html` dan `auth-client.html` dengan versi terbaru di cabang uji-login. Halaman memakai kartu putih dua kolom, latar pastel dan ilustrasi dashboard SVG yang tertanam di HTML; tidak memerlukan gambar Drive atau pengaturan domain tambahan untuk ilustrasinya. Pada HP, kedua panel tersusun vertikal dan tombol login tetap berada dekat bagian atas.

Login hanya menampilkan satu tombol **Masuk dengan Google**. Tombol **Ganti akun** dihapus; pemilihan akun tetap melalui popup Google. Pemilihan ulang akun yang sama juga memicu pemeriksaan akses baru meskipun Firebase tidak mengirim event perubahan pengguna. Menu **Keluar akun** di dalam aplikasi tetap tersedia.

Pratinjau lokal: [desktop](docs/login-desktop.png) dan [HP](docs/login-mobile.png). Ini hasil render browser lokal, bukan screenshot deployment Google.

Simpan perubahan lalu refresh `/dev`. Untuk `/exec`, gunakan **Terapkan → Kelola deployment → ikon pensil → Versi baru → Terapkan**, lalu refresh URL yang sama.
