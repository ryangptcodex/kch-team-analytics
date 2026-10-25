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
2. Di dropdown fungsi editor, pilih `checkKchGoogleConnection_`, lalu klik **Run / Jalankan**.
3. Jika diminta otorisasi, pilih akun pemilik deployment dan periksa serta berikan izin yang diperlukan. Pengujian ini tidak membaca atau mengubah spreadsheet, tidak menjalankan setup dan tidak memakai token login pengguna.
4. Baca **Execution log / Log eksekusi**. Hasil HTTP 400 `INVALID_ID_TOKEN` dengan `connectionOk: true` diharapkan: kode sengaja memakai token palsu untuk membuktikan layanan dapat dihubungi. Hasil itu belum membuktikan login pengguna berhasil.
5. Jika koneksi lolos, refresh halaman `/dev` lalu coba masuk lagi. Jika tidak lolos atau login tetap gagal, kirim laporan diagnostik atau teks error terbaru; jangan menebak masalah atau mengubah pembatasan API key sebelum hasilnya diketahui.

## Pemeriksaan penerimaan

1. **Admin**: masuk dengan Gmail admin, pastikan profil berperan ADMIN dan sheet `ACCESS_USERS` terbentuk hanya di spreadsheet uji.
2. **Daftarkan sales**: buka menu akun → **Kelola akses sales**, isi Gmail, pilih ID sales yang sesuai, pilih Aktif, lalu Simpan akses.
3. **Sales**: gunakan browser/profil terpisah, masuk sebagai sales terdaftar. Dashboard, absensi dan transaksi hanya memuat miliknya. Menu pengelolaan akses tidak muncul.
4. **Akun tak terdaftar**: login harus ditolak dan data aplikasi tidak tampil.
5. **Nonaktifkan akses**: nonaktifkan sales dari admin, lalu lakukan permintaan data baru dari browser sales. Server harus menolak meskipun akun Google masih masuk.
6. **Keluar**: pilih Keluar akun; data yang telah dimuat dibersihkan dengan pemuatan ulang halaman. Muat ulang juga mengharuskan login kembali karena sesi Firebase tidak disimpan permanen.

## Batas tahap ini

Pengujian lokal: `node --test tests/auth.test.cjs` menggunakan tiruan layanan Google/Spreadsheet. Pengujian itu memeriksa aturan akses dan penanganan kegagalan, bukan login Google nyata, izin Drive, atau deployment Apps Script.

Ini paket **uji login**, belum versi siap launch. Fungsi edit transaksi belum ditambahkan. Validasi jumlah/harga, gabungan produk ganda dan pemulihan penyimpanan transaksi saat gagal masih memerlukan perbaikan tahap berikutnya. Jangan gunakan paket ini untuk transaksi operasional atau menganggap stok sudah terverifikasi. Data salinan dapat berubah bila fungsi tulis dijalankan.

Saat menyalin proyek lagi, perbarui ID spreadsheet uji dalam `firebase-config.gs`; kode sengaja menggunakan ID eksplisit agar deployment tidak memilih spreadsheet yang tidak jelas.
