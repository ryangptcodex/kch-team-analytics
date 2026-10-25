# Catatan melanjutkan proyek KCH Team Analytics

Disimpan 25 Oktober 2026, waktu Jakarta. Ini ringkasan keputusan dan progres, bukan transkrip lengkap chat.

## Tujuan dan keputusan

- Aplikasi monitoring sales KCH Cabang Lhokseumawe, direncanakan mulai dipakai tim awal November 2026.
- Pengguna baru belajar GitHub; pandu dengan langkah singkat dan bahasa sederhana.
- Aplikasi asal berupa Apps Script yang terikat pada Google Sheets, dibuka melalui Ekstensi → Apps Script.
- Spreadsheet asli sudah berisi beberapa transaksi asli Oktober. Pertahankan seluruh data tersebut.
- Pengguna sudah membuat salinan **KCH Analytics - UJI COBA**, dengan kelima file Apps Script ikut tersalin.
- Login menggunakan Gmail pribadi melalui Firebase Authentication dengan penyedia Google.
- Admin pertama: `mhmdryyan7@gmail.com`.
- Sales boleh absen, input dan edit transaksi miliknya sendiri. Admin boleh membantu semua sales.
- Edit transaksi harus menyesuaikan stok, termasuk saat jumlah, produk atau distributor berubah.
- Riwayat harus mencatat pelaku sebenarnya dan sales yang dibantu, termasuk absensi oleh admin.

## Sumber dan konfigurasi

- Lima file asal: `code.gs`, `setup.gs`, `index.html`, `css.html`, `js.html`.
- Manifest asal tersimpan sebagai `appsscript.json`: Asia/Jakarta, V8, executeAs USER_DEPLOYING, access ANYONE_ANONYMOUS.
- Proyek Firebase uji sudah dibuat pengguna dan konfigurasi web sudah diberikan.
- Runtime config dan ID spreadsheet uji ada di `firebase-config.gs`.
- Jangan meminta password, ID token, private key, atau service-account key di chat.

## Pekerjaan yang sudah selesai

- Analisis kode awal dan reproduksi masalah stok/identitas dengan simulasi.
- Commit awal kode asli: `eddf306`.
- Implementasi awal login: Firebase di browser, verifikasi token melalui Identity Toolkit di server, allowlist akun, peran ADMIN/SALES, pengaitan UID/email/sales_id.
- Sheet `ACCESS_USERS` dirancang untuk dibuat saat admin pertama berhasil login; belum dibuat di Google oleh agen.
- Menu admin untuk mendaftarkan dan menonaktifkan akses sales.
- Browser RPC memakai satu gateway `kchApi`; helper dan fungsi setup dibuat privat dengan akhiran `_`.
- Pembatasan akses data sales, pemeriksaan pemilik untuk input transaksi/foto dan laporan bulanan.
- Identitas Ryan yang menjadi fallback dihapus. Identitas pelaku transaksi berasal dari pengguna terverifikasi.
- Kode memakai ID spreadsheet uji secara eksplisit melalui `getKchSpreadsheet_()`.
- 18 tes lokal lulus: `node --test tests/auth.test.cjs`. Layanan Firebase/Spreadsheet pada tes adalah simulasi; ini belum membuktikan login nyata atau deployment berfungsi.
- Kode login diunggah atas persetujuan pengguna ke cabang **uji-login**, commit `d5dfabc75bd6c4e2ea0a8114f1903dc7660a5264`.
- Repository: https://github.com/ryangptcodex/kch-team-analytics/tree/uji-login
- Panduan pemasangan lengkap: `PANDUAN-UJI-LOGIN.md`.

## Posisi terakhir pengguna

Tautan ZIP lokal workspace tidak bisa diunduh dari chat. Jangan mengulangi cara tersebut.
Atas izin pengguna, kode sudah di-push ke GitHub dan remote SHA sudah dicocokkan dengan commit lokal.
Pengguna diarahkan membuka cabang uji-login, lalu **Code → Download ZIP** dan mengikuti panduan.
Belum ada konfirmasi bahwa pengguna sudah mengunduh, mengganti file atau melakukan deployment.
Pengguna berhenti sementara untuk tidur dan ingin melanjutkan nanti.

### Pembaruan setelah pengguna melanjutkan

- File halaman login diganti namanya menjadi `auth-ui.html` agar berbeda dari server `auth.gs`; `index.html` dan panduan sudah diperbarui di GitHub.
- Pengguna sudah memasang kode dan membuka deployment `/dev`.
- Error pertama `auth/unauthorized-domain` ditangani pengguna dengan menambahkan hostname iframe ke Firebase Authorized domains.
- Setelah itu muncul `AUTH_UNAVAILABLE: Verifikasi Google belum dapat dihubungi`. Ini terjadi dalam catch `UrlFetchApp.fetch`; penyebab spesifik belum diketahui. Izin OAuth external_request yang belum diotorisasi merupakan kemungkinan, bukan diagnosis terkonfirmasi.
- Ditambahkan `checkKchGoogleConnection_()` ke `auth.gs`. Jalankan manual di editor untuk memicu otorisasi yang diperlukan dan memperoleh laporan aman dengan token palsu. HTTP 400 INVALID_ID_TOKEN adalah hasil koneksi yang diharapkan, bukan login berhasil.
- Pengujian lokal kini 20 tes lolos. Belum ada hasil diagnostik dari lingkungan Apps Script pengguna; lanjutkan dari langkah ini.
- Dropdown editor pengguna hanya menampilkan fungsi publik. Ditambahkan pembungkus `checkKchGoogleConnection` TANPA underscore; helper privat tetap `checkKchGoogleConnection_`. Pembungkus memeriksa `Session.getActiveUser().getEmail()` terhadap Gmail admin dan menolak akun kosong/akun lain sebelum request. Jangan mengubah semua helper menjadi publik. Tes kini 21 lolos; hasil pemeriksaan di Google masih ditunggu.

## Langkah berikutnya

1. Tanyakan apakah ZIP sudah diunduh dan kode sudah dipasang di Apps Script salinan; jangan menganggap sudah.
2. Pandu pemasangan empat file lama yang berubah dan empat file baru sesuai panduan. Pasang bersama-sama.
3. Uji deployment salinan dengan akun admin. Pastikan provider Google Firebase aktif.
4. Bila Firebase menolak domain, tambahkan hostname iframe yang tampil pada pesan error ke Authorized domains. Jangan menebak hostname sandbox atau mengizinkan wildcard.
5. Tangani popup, izin Apps Script, akses API dan batasan iframe berdasarkan error nyata. Login Firebase dalam iframe Apps Script belum diverifikasi; mungkin perlu penyesuaian arsitektur jika tidak didukung browser/deployment.
6. Setelah admin berhasil masuk, daftarkan satu akun sales. Uji akun sales dan akun tak terdaftar di profil browser terpisah, serta penonaktifan akses.
7. Lanjutkan perbaikan transaksi dan fitur edit, kemudian pengujian stok, transaksi bersamaan, laporan dan uji bersama tim sebelum launch.

## Pekerjaan yang belum selesai / batas penting

- Belum ada koneksi akun Google yang memungkinkan agen mengedit atau deploy Apps Script langsung. Pemasangan saat ini dilakukan pengguna.
- Tidak ada perubahan oleh agen pada spreadsheet asli/salinan atau deployment Google. Jangan menyatakan login nyata sudah berhasil.
- Fitur edit transaksi BELUM ditambahkan.
- Bug transaksi lama BELUM diperbaiki: produk yang sama qty 6 + 6 bisa lolos dari stok 10; jumlah negatif bisa menambah stok; harga masih dipercayai dari browser; pemotongan stok bisa terjadi sebelum semua catatan selesai ditulis tanpa pemulihan saat gagal.
- Paket ini hanya untuk uji login, BELUM siap untuk transaksi operasional atau launch.
- `setup.gs` memiliki operasi yang menghapus sheet/kolom dan mengubah struktur. Jangan menjalankan perbaikan massal pada data asli.
- Unggah foto masih mengatur akses Drive ANYONE_WITH_LINK; kebijakan akses foto perlu dipertimbangkan sebelum launch.
- Aturan target penjualan tersebar dan berpotensi tidak konsisten; perlu validasi sesuai aturan bisnis pengguna.
- Jangan mereset data Oktober untuk memulai November; pisahkan laporan berdasarkan tanggal dan rekonsiliasi stok akhir/awal.

### Login admin terverifikasi di deployment uji

- Pengguna menjalankan `checkKchGoogleConnection` di editor; screenshot menunjukkan `connectionOk: true`, HTTP 400 INVALID_ID_TOKEN sesuai tes yang dirancang. Penyebab pasti kegagalan fetch sebelumnya tidak dikonfirmasi; jangan menyatakan pasti masalah jaringan atau OAuth.
- Setelah refresh dan mencoba login, pengguna mengonfirmasi web app berhasil masuk dan sheet `ACCESS_USERS` muncul. Screenshot memperlihatkan dashboard pada deployment `/dev`.
- Login admin pada salinan uji kini telah diverifikasi oleh pengguna, bukan hanya tes lokal.
- Akun sales, penolakan akun tak terdaftar dan pencabutan akses BELUM diuji di browser nyata.
- Langkah berikutnya: admin mendaftarkan satu Gmail sales lewat menu akun → Kelola akses sales, menghubungkan sales_id yang benar, kemudian menyiapkan deployment uji `/exec` untuk akun sales tanpa membagikan akses editor spreadsheet. `/dev` hanya ditujukan bagi editor proyek.
- Perbaikan transaksi/stok dan fitur edit tetap belum selesai; hindari transaksi operasional.

### Login sales terverifikasi pada /exec

- Pengguna mendaftarkan satu Gmail ke profil Muhammad Ryan, role SALES dan status ACTIVE, melalui menu Kelola akses sales.
- Pengguna kemudian mengonfirmasi login sales berhasil pada deployment `/exec`; screenshot memperlihatkan nama Muhammad Ryan dan menu akun tanpa Kelola akses sales.
- Belum ada konfirmasi pilihan sales hanya dirinya, riwayat/ekspor hanya miliknya, akun tak terdaftar ditolak, atau akses nonaktif ditolak dalam pengujian browser nyata. Itu langkah verifikasi berikutnya.
- Screenshot memperlihatkan label Sales Coordinator pada akun sales. Pemeriksaan sumber membuktikan `.user-role-header` masih teks statis di `index.html`; fungsi `updateDynamicGreeting()` belum memperbarui label role. Ini masalah tampilan, bukan bukti role ADMIN. Perlu diperbaiki di pembaruan berikutnya.
- Screenshot memperlihatkan target Rp147.000.000 dan hari kerja 0/26. Sumber membuktikan nilai-nilai tersebut adalah placeholder HTML awal. Grafik dan metrik belum terbukti selesai dimuat saat screenshot; jangan menafsirkan angka ini sebagai hasil server atau memastikan penyebab grafik kosong tanpa hasil permintaan/error.
- Tahap berikutnya: verifikasi form Input Penjualan (hanya diri sendiri), riwayat transaksi sendiri, lalu uji pencabutan akses menggunakan dua akun yang tersedia. Jangan membuat transaksi sebelum perbaikan stok.

### Pengecekan pembatasan dan perbaikan panel akses

- Pengguna mengonfirmasi pilihan sales pada Input Penjualan hanya dirinya dan riwayat hanya transaksi miliknya.
- Setelah instruksi uji penonaktifan, pengguna menyebut sinkronisasi ditolak; kalimat awal ambigu, penolakan perlu dipastikan terkait status INACTIVE. Pemulihan akses setelah aktif kembali BELUM terverifikasi.
- Pengguna kemudian melaporkan dropdown profil sales di panel admin kosong; screenshot menunjukkan daftar akun tetap tampil.
- Ditemukan ketergantungan dropdown pada `appState.attendanceSales` yang dimuat terpisah dari daftar akun. Panel dapat dibuka sebelum metadata selesai, dan tidak otomatis memperbarui pilihan setelah metadata tiba.
- Perbaikan: `listAccessUsers_` mengirim profil SALES yang diperlukan bersama daftar akun (tetap admin-only). Panel mengambil profil langsung, menampilkan status memuat/gagal/kosong, mencegah penyimpanan saat belum siap, mengabaikan respons lama, dan menyediakan tombol Ubah pada akun sales yang sudah terdaftar.
- File yang perlu diganti bersama di Apps Script: `auth.gs`, `auth-client.html`, `auth-ui.html`. Perlu update versi deployment existing untuk `/exec`; `/dev` cukup simpan dan refresh.
- 28 tes lokal lulus lewat `node --test tests/*.test.cjs`. Pemasangan perbaikan dropdown dan keberhasilan aktif kembali di browser pengguna masih menunggu.

### Perbaikan logout halaman putih

- Pengguna melaporkan klik Keluar akun menghasilkan halaman putih pada `/dev`, dan meminta langsung kembali ke login.
- Kode sebelumnya memanggil `window.location.reload()` dalam iframe Apps Script. Diganti alur sign out di dokumen yang sama tanpa navigasi/reload iframe.
- `auth-client.html` menyimpan template UI bersih sebelum login, lalu saat sesi berakhir membersihkan state akun, timer pencarian, grafik, formulir, modal, menu admin dan daftar akses. Respons RPC dari sesi lama diabaikan. Setelah sign out sukses layar login dan tombol login tersedia; kegagalan tetap terkunci dengan opsi mencoba lagi.
- Pergantian akun membangun ulang menu dan memperbarui label peran menjadi Admin atau Sales.
- `js.html` menambahkan pemeriksaan generasi sesi pada callback kompresi foto agar unggah yang dimulai sebelum logout tidak terkirim atas nama akun berikutnya.
- Dua file yang perlu diganti: `auth-client.html`, `js.html`. Perlu update versi deployment existing untuk `/exec`; `/dev` cukup simpan dan refresh dari tab browser.
- 35 tes lokal lolos, termasuk logout sukses/gagal, tanpa Firebase, klik berulang, admin ke sales dalam tab sama, respons lama dan kompresi foto lintas sesi. Perilaku nyata pada browser pengguna setelah pemasangan masih menunggu.
