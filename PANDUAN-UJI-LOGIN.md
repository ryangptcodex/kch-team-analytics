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
5. Gunakan `css.html` terbaru dan `appsscript.json` terbaru. Untuk paket transaksi, buat juga file Script `transactions` dari `transactions.gs`; manifest sekarang mengaktifkan Google Sheets API. Lihat langkah paket transaksi di bawah.
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

## Nama tampilan khusus aplikasi: Edit profil

Ganti seluruh isi **tiga file** dari cabang uji-login: `auth.gs`, `auth-client.html`, `auth-ui.html`. Simpan lalu refresh `/dev`; untuk `/exec`, perbarui versi deployment yang sama lalu refresh. Tidak perlu menjalankan Perbarui Sheet untuk fitur profil ini.

Setelah login, buka tombol akun kanan atas → **Edit profil** → isi **Nama tampilan** (2–80 karakter) → **Simpan nama**. Sapaan, inisial dan nama pada menu akun berubah langsung. Nama akun Google, email, Firebase UID, role, sales_id dan nama personel pada master SALES tidak diubah. Admin dan sales masing-masing hanya dapat mengubah nama tampilannya sendiri.

Pada penyimpanan pertama, kolom tambahan `display_name` otomatis ditambahkan di akhir `ACCESS_USERS` bila belum ada. Tujuh kolom lama tetap dipertahankan, dan kolom tambahan lain tidak ditimpa. Login ke sheet lama tanpa `display_name` tetap berfungsi menggunakan nama Google untuk admin atau nama master SALES untuk sales. Setelah nama khusus disimpan, nama itu diprioritaskan pada login berikutnya.

## Tidak bisa masuk setelah mengganti nama Google

Nama Google bukan dasar penentuan akses. Server memakai email dan UID terverifikasi, lalu role/status di ACCESS_USERS. Pada versi lama, pesan **Akses akun tidak aktif** juga dipakai untuk role tidak valid. Versi `auth.gs` terbaru membedakan role tidak valid dari status tidak aktif.

Periksa **baris email akun yang benar-benar dipilih pada popup Google**: role hanya `ADMIN` atau `SALES`, dan status harus `ACTIVE`. Untuk akun admin utama, gunakan `ADMIN` dan `ACTIVE`. Pastikan perubahan sel sudah tersimpan, refresh tab aplikasi, lalu pilih Gmail admin yang tepat saat login. Tidak perlu menghapus akun Firebase, mengosongkan UID atau mengganti API key untuk menangani pesan ini. Jika nilai itu sudah benar tetapi masih ditolak, kirim nilai role/status dan teks pesan terbaru untuk diagnosis; jangan menganggap perubahan nama pasti penyebabnya.

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

## Nama lengkap dan label TEAM LEADER pada tombol akun

Ganti seluruh isi `js.html`, `auth-client.html`, dan `css.html` dari cabang uji-login. Nama pada tombol akun kini memakai nama tampilan lengkap; nama panjang dapat membungkus ke baris berikutnya dan tetap terlihat di layar HP. Label untuk akun dengan role ADMIN ditampilkan sebagai **TEAM LEADER**. Label akun SALES tetap Sales. Role otorisasi pada ACCESS_USERS harus tetap **ADMIN**, bukan TEAM LEADER. Ini perubahan tampilan tanpa perubahan hak akses.

Simpan dan refresh `/dev`. Untuk `/exec`, perbarui versi deployment yang sama lalu refresh. Nama lengkap berasal dari profil KCH yang disimpan melalui Edit profil, atau sumber nama sebelumnya bila belum dikustomisasi.

## HK profil sales berdasarkan absensi

Ganti seluruh isi **`code.gs`** (file backend di editor pengguna dapat bernama `Kode.gs`) dan **`js.html`** dari cabang uji-login. Ganti isi file backend yang sudah ada; jangan membuat salinan kedua berisi fungsi yang sama. Simpan lalu refresh `/dev`, atau perbarui versi deployment yang sama untuk `/exec`.

Ikon kalender pada kartu Profil Sales sekarang menampilkan misalnya **8 HK · Okt 2026**. Aturannya:

- Satu HK adalah satu tanggal absensi hadir unik untuk satu sales. Absen berulang pada tanggal sama tetap satu HK. Absensi yang diinput admin untuk sales tersebut juga dihitung.
- Profil menampilkan bulan berjalan berdasarkan Asia/Jakarta. Data bulan lama tetap tersimpan; hitungan profil bulan baru dimulai dari absensi pada bulan baru.
- Hadir, hadir tepat waktu/terlambat dan status kehadiran yang didukung dihitung. Baris lama tanpa status tetapi memiliki sales_id dan tanggal valid tetap dianggap absensi. Izin, sakit, alpa, cuti, tidak hadir, arsip, batal dan status yang tidak dikenali tidak menambah HK.
- Tanggal tidak valid atau masa depan tidak dihitung. Minggu/libur tetap dihitung jika benar-benar ada absensi hadir, karena ini HK kehadiran aktual, terpisah dari perhitungan hari kerja kalender untuk target.
- Belum ada absensi menghasilkan 0 HK. Bila frontend baru dipasang tanpa backend baru, label HK belum dimuat menunjukkan bahwa data hitungan belum tersedia; angka nol tidak dibuat-buat.
- Setelah unggah absensi sukses, metadata profil dimuat ulang. Perubahan manual di sheet ATTENDANCE terlihat setelah Sinkronisasi Live atau refresh/login ulang.
- TOTAL HK pada laporan bulanan memakai aturan absensi unik yang sama untuk bulan yang dipilih. Tanggal transaksi tanpa absensi tidak menambah HK; total penjualan dan SHJ tetap dihitung dari transaksi.

Tidak perlu menjalankan Perbarui Sheet atau menambahkan kolom manual untuk fitur ini. Pemrosesan absensi mengikuti pembatasan akun: admin dapat melihat semua profil, sales hanya profil/data miliknya.

## Paket perbaikan transaksi dan stok — 25 Oktober 2026

Paket ini memperbaiki pembuatan transaksi; **edit/pembatalan transaksi dan stok masuk/koreksi belum ditambahkan**. Jangan memakai fungsi repair/setup massal untuk memasang paket ini.

### Pasang tujuh file bersama di proyek UJI COBA

1. Buat file **Script** baru bernama **transactions**, salin seluruh `transactions.gs` ke sana.
2. Ganti seluruh isi `code.gs` (bisa bernama `Kode.gs` di editor), `auth.gs`, `setup.gs`, `js.html`, dan `index.html` dengan versi cabang `uji-login` yang sama. Jangan membuat dua file code/Kode berisi fungsi duplikat.
3. Ganti `appsscript.json` dengan versi terbaru. Jika belum terlihat, buka **Setelan proyek → tampilkan file manifes appsscript.json**. Manifest menambahkan layanan Sheets v4. Alternatifnya, pada **Layanan → + → Google Sheets API → Tambahkan**, dengan identifier `Sheets`. Ini API spreadsheet, bukan pengaturan Firebase.
4. Simpan semuanya. Jalankan **checkKchTransactionSetup** dari dropdown fungsi editor memakai akun admin utama. Setujui izin Google yang diminta oleh proyek salinan. Pemeriksaan ini membaca koneksi, ketersediaan sheet master dan kiriman tertunda; tidak menyimpan transaksi atau mengubah stok.
5. Hasil normal: `success:true`, `missingSheets:[]`, `pendingRequests:[]`. Ini pemeriksaan koneksi, **bukan bukti validitas seluruh data master**. Jika ada HTTP 403/API belum aktif: pastikan layanan Google Sheets API telah ditambahkan. Bila proyek memakai Google Cloud project khusus, aktifkan Google Sheets API di Cloud Console proyek tersebut. Jalankan pemeriksaan lagi.
6. Untuk `/dev`: simpan lalu refresh webapp. Untuk `/exec`: **Terapkan → Kelola deployment → pilih deployment → Edit → Versi baru → Terapkan**, kemudian refresh URL yang biasa digunakan. Browser dengan versi lama perlu refresh sebelum menyimpan transaksi.

Cara salin sekali klik: buka file di GitHub cabang `uji-login`, klik ikon **Copy raw file** di area kanan atas kode. Di file tujuan Apps Script: **Ctrl+A → Ctrl+V**. Jangan menyalin teks panduan atau pembatas Markdown ke editor.

### Perilaku yang berubah

- Qty harus bilangan bulat positif; produk yang sama pada beberapa baris dijumlahkan sebelum memeriksa stok distributor. Baris produk yang sama disimpan sebagai satu baris gabungan.
- Harga modal/jual berasal dari PRICE_MASTER untuk tim sales; harga form yang sudah berbeda ditolak agar total tidak berubah diam-diam. Sinkronkan data dan periksa ulang harga sebelum mengirim ulang. Produk, harga dan distributor nonaktif ditolak.
- Distributor harus cocok dengan master dan satu kolom stok yang jelas. Nilai stok setiap kolom distributor harus angka bulat nonnegatif; isi angka `0` bila stok kosong. Nama kolom master ganda/ambigu akan ditolak, bukan ditebak.
- Tanggal harus benar dan tidak di masa depan. Tanggal historis tetap boleh; penutupan bulan belum diterapkan. Catatan maksimal 2.000 karakter dan ditulis sebagai teks literal, termasuk jika diawali `=`.
- Transaksi, pengurangan stok, mutasi keluar, audit dan bukti berhasil disimpan dalam satu batch atomik. Kegagalan satu bagian mencegah seluruh batch keuangan tersimpan. SHJ per unit memakai harga jual dikurangi modal, sesuai perhitungan penyimpanan sebelumnya; preview form disamakan. Nilai uang maksimal dua desimal.
- Kiriman memiliki kode unik. Respons berhasil yang hilang dapat diperiksa kembali tanpa memotong stok ulang. Browser mengambil stok terbaru dari server setelah berhasil; tidak mengurangi salinan stok lokal sendiri.
- Sheet tersembunyi `_KCH_TX_REQUESTS` mencatat status kiriman dan pelakunya. Jangan diedit/dihapus/diurutkan manual. Sheet finansial yang belum ada dibuat dalam batch pertama; transaksi dan saldo lama tidak dihitung ulang atau diperbaiki otomatis oleh paket ini.

### Bila koneksi putus / hasil belum pasti

Gunakan **Periksa hasil**. Bila hasil sudah COMMITTED, transaksi sebelumnya ditampilkan sebagai berhasil tanpa mengirim batch finansial lagi. Bila belum ada kiriman tercatat, aplikasi memakai kode yang sama untuk mencoba lagi. Bila ditolak secara pasti, form dibuka kembali agar dapat dikoreksi; kiriman koreksi mendapatkan kode baru.

Jika sudah ada catatan PENDING tetapi hasil penulisan belum pasti, form tetap terkunci dan **penyimpanan transaksi baru seluruh pengguna serta pemeliharaan sheet ditahan**. Sistem tidak melakukan rollback atau pengiriman ulang yang berisiko bertabrakan dengan batch yang terlambat selesai. Periksa hasil lagi setelah koneksi pulih; jalankan `checkKchTransactionSetup` sebagai admin untuk melihat kode kiriman, ID transaksi, email pelaku dan waktu. Jika PENDING tidak selesai, pengelola perlu menelusuri eksekusi serta isi ledger sebelum pemulihan; tidak tersedia tombol pembatalan PENDING otomatis. Jangan menghapus jurnal, membuat kode baru, atau mengubah saldo manual untuk melewati penguncian ini.

Tab browser hanya menyimpan kode kiriman di sessionStorage, dipisahkan menurut akun dan hostname; payload transaksi/token tidak dipersistenkan. Jangan menutup tab atau membersihkan data browser saat hasil belum pasti. Jika refresh dan status belum tercatat, detail perlu diisi kembali dengan kode yang dipertahankan. Pemblokiran penyimpanan sesi browser mencegah pengiriman dimulai. Pengiriman ulang dengan kode sama dilindungi; transaksi yang sengaja dimasukkan lagi di tab lain dengan kode baru tetap dianggap transaksi baru.

ScriptLock mengurutkan transaksi dari proyek Apps Script yang sama. Perubahan manual stok atau penulis dari proyek lain tidak ikut lock tersebut; hindari perubahan itu ketika transaksi sedang berjalan. Paket ini belum menambahkan fitur penerimaan/koreksi stok yang diaudit.

### Uji kecil sebelum dibagikan ke tim

Lakukan hanya di salinan UJI COBA dengan data uji yang bisa dikenali:

1. Catat stok distributor dan harga master satu produk. Simpan qty kecil; pastikan ID yang sama muncul pada SALES_TRANSACTIONS, INVENTORY_MOVEMENTS dan ACTIVITY_LOGS, stok distributor berkurang tepat satu kali dan jurnal COMMITTED. Coba sebagai sales sendiri dan admin membantu sales.
2. Isi produk sama dua baris hingga total melebihi stok: harus ditolak tanpa perubahan finansial. Qty nol/negatif/pecahan dan tanggal masa depan juga harus ditolak.
3. Uji harga form yang sudah lama setelah master diubah: harus ditolak, lalu sinkronkan dan ulang dengan harga yang benar.
4. Klik simpan berulang: satu kiriman tetap satu transaksi. Bila ada gangguan jaringan, gunakan Periksa hasil dan cocokkan ID/qty/stok sebelum meneruskan. Jangan memaksakan simulasi kegagalan Google pada data asli.
5. Refresh/logout/login kembali; konfirmasi login, nama lengkap/TEAM LEADER, HK dan pembatasan sales masih berfungsi.

Validasi otomatis lokal memakai workbook dan layanan Google tiruan, termasuk penolakan batch, respons hilang, penulisan terlambat, retry, batas akses serta perhitungan desimal. Chromium memeriksa penguncian form/tombol pemeriksaan, retry dengan kode sama dan tampilan 1440/390/320px. Belum ada pemasangan atau pengujian Sheets API terhadap akun/data Google nyata dari workspace ini.

## Revisi tampilan loading dashboard — 26 Oktober 2026

Ganti bersama `index.html` dan `js.html` terbaru. Salin dengan Copy raw file, tempel seluruh isi, lalu simpan. `/dev` cukup refresh; `/exec` gunakan versi deployment baru lalu refresh. Tidak perlu menekan Perbarui Sheet.

KPI awal tampil **—**, bukan target contoh Rp147 juta atau angka lama. Status **Memuat data…** berubah **Live Sync** setelah respons dashboard berhasil. Saat memuat ulang/pergantian periode, angka/grafik lama dikosongkan; kegagalan tampil **Gagal memuat data** dan tetap netral. Nol asli dari server tetap tampil sebagai nol setelah berhasil. Perhitungan target/harga/stok server tidak diubah oleh revisi ini.
