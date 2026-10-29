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

### Desain ulang login sesuai referensi pengguna

- Pengguna merespons perbaikan logout dengan "oke, mantap", lalu meminta tombol Ganti akun di login dihapus dan desain menyerupai referensi kartu putih dua kolom dengan latar pastel. Gambar orang diminta diganti ikon/ilustrasi dashboard.
- `auth-ui.html` didesain ulang: branding KCH Team Analytics, satu tombol Google, panel kanan lavender dengan ilustrasi dashboard SVG tertanam, dan layout satu kolom pada HP. Tidak menambahkan form password atau pendaftaran karena autentikasi yang disepakati memakai Google.
- `auth-client.html` menyesuaikan pesan pemulihan karena tombol Ganti akun dihapus, serta memeriksa ulang akses jika akun Google yang sama dipilih ulang tanpa event onAuthStateChanged. Logout tanpa reload dan pembersihan data akun tetap dipertahankan.
- 37 tes lokal lolos. Chromium juga memverifikasi layout 1440px, 390px, 320px tanpa overflow horizontal; tepat satu tombol login; tombol dapat diklik; pesan error panjang tidak melebarkan layout; halaman login tersembunyi saat status hidden aktif. Ini tidak mengulangi login Google nyata.
- Pratinjau desktop dan HP disimpan di `docs/login-desktop.png` dan `docs/login-mobile.png`.
- File yang perlu diganti pengguna: `auth-ui.html`, `auth-client.html`. `/dev` cukup simpan dan refresh; `/exec` perlu update versi deployment existing. Pemasangan desain baru pada Google masih menunggu pengguna.

### Perbaikan tombol Perbarui spreadsheet

- Pengguna mengklik Perbarui pada sheet UJI COBA dan mendapat `Fungsi skrip tidak ditemukan: repairAndOptimizeSpreadsheet`.
- Nama lama masih dipakai tombol/menu yang ada, sedangkan kode awal pengamanan mengubah implementasi menjadi `repairAndOptimizeSpreadsheet_`. Pemanggilan yang gagal menemukan fungsi belum masuk ke proses pembaruan.
- Ditambahkan callback publik stabil `repairAndOptimizeSpreadsheet` di `setup.gs`. Hanya Gmail admin aktif yang diperbolehkan; fungsi harus berjalan di konteks UI spreadsheet dengan ID aktif sama dengan salinan uji. Gateway web tetap menolak operasi maintenance.
- Menu `onOpen` untuk pembaruan kini memakai callback stabil tersebut. Fungsi internal tetap privat.
- Penghubung baru mengunci operasi, membuat salinan backup spreadsheet sebelum menjalankan pembaruan lama, dan membatalkan pembaruan jika backup gagal. Log memuat URL backup sebelum perubahan; kegagalan migrasi menyertakan URL itu. Backup tidak otomatis mengembalikan perubahan izin foto Drive yang dilakukan routine lama.
- File yang perlu diganti: `setup.gs`, lalu simpan dan refresh sheet. Tidak perlu deployment web baru untuk tombol native spreadsheet.
- 43 tes lokal lolos, termasuk admin/konteks/ID, backup sebelum mutasi, pembatalan bila backup gagal dan pelepasan lock. Migrasi penuh data Google belum dieksekusi dari workspace ini atau dikonfirmasi pengguna.

### Nama tampilan dan masalah login terbaru

- Pengguna bertanya apakah role di ACCESS_USERS bisa diubah manual. Dijelaskan bahwa ADMIN/SALES dibaca pada permintaan berikutnya, sementara menu sebaiknya diperbarui dengan logout/login; pemeliharaan sheet tetap hanya Gmail admin utama.
- Pengguna ingin mengubah nama "Abangda" pada tombol akun. Nama itu sebelumnya berasal dari displayName Google untuk admin. Pengguna memilih pembahasan opsi nama khusus aplikasi, lalu bertanya caranya.
- Ditambahkan fitur Edit profil: endpoint privat `saveMyProfile_` melalui gateway login, menu dan modal Edit profil untuk setiap akun. Menyimpan hanya nama tampilan milik pengguna terverifikasi dan updated_at; email/UID/role/sales_id tidak bisa diganti melalui payload ini. Nama personel di SALES tetap dipertahankan.
- Kolom opsional `display_name` ditambahkan di akhir ACCESS_USERS hanya saat nama pertama kali disimpan. Sheet tujuh kolom lama tetap dapat login; kolom tambahan lain dipertahankan. Nama khusus dipakai pada login berikutnya.
- File yang perlu diganti bersama: auth.gs, auth-client.html, auth-ui.html. Tidak perlu menjalankan repair/setup untuk menambah kolom ini. Belum dipasang di Google oleh agen.
- 52 tes lokal lolos. Chromium menguji modal, email read-only, perubahan header langsung, layout HP, penanganan gagal simpan dan penghapusan input profil saat logout dengan backend tiruan. Belum menguji penyimpanan profil nyata pada Google.
- Saat pengerjaan ini pengguna melaporkan tidak bisa login setelah mengubah nama di pengaturan Gmail; screenshot `/exec` menampilkan ACCESS_DENIED: Akses akun tidak aktif. Di kode yang telah terpasang, pesan itu meliputi status bukan ACTIVE ATAU role bukan ADMIN/SALES. Perubahan nama Google sendiri tidak mengubah role/status; penyebab spesifik belum terkonfirmasi.
- Sudah diminta secara async nilai role dan status pada baris Gmail yang dipilih login, tanpa meminta UID. Jawaban belum diterima saat catatan ini ditulis. Prioritaskan memulihkan akses admin, cek akun Google yang dipilih dan row yang sesuai.
- Pesan backend terbaru membedakan role tidak valid dan status tidak aktif; tes membuktikan perubahan displayName Google tidak mengubah otorisasi email/UID yang sama. Jangan menghapus akun Firebase/UID atau mengubah API key untuk pesan role/status ini.

- Jawaban pengguna akhirnya diterima: role/status yang ada adalah TEAM LEADER ACTIVE dan SALES ACTIVE. Penyebab penolakan pada akun TEAM LEADER sudah jelas: role tersebut belum didukung. Instruksikan mengembalikan akun admin ke ADMIN/ACTIVE. Jangan otomatis menganggap TEAM LEADER sama dengan admin; jika dibutuhkan, tetapkan kewenangannya sebagai fitur terpisah.

### Nama lengkap pada tombol akun dan label TEAM LEADER

- Pengguna meminta nama pada tombol akun kanan atas tampil lengkap dan label Admin menjadi TEAM LEADER.
- `js.html`: nama tombol kini menggunakan fullName, sedangkan sapaan tetap memakai nama pendek.
- `auth-client.html`: role ADMIN ditampilkan dengan label TEAM LEADER; otorisasi tetap ADMIN. Role SALES tetap berlabel Sales. Jangan mengubah nilai role ACCESS_USERS menjadi TEAM LEADER.
- `css.html`: nama membungkus tanpa ellipsis, metadata nama tetap terlihat di HP, header menyesuaikan baris dan tinggi agar kontrol tidak bertumpuk.
- File yang perlu diganti: js.html, auth-client.html, css.html. `/exec` memerlukan pembaruan versi deployment existing; `/dev` simpan dan refresh.
- 52 tes regresi lokal lulus. Chromium memeriksa nama 13 dan 80 karakter pada 1920, 1440, 1024, 820, 390, 320px; tampilan penuh dan label diperiksa setelah transisi layout selesai. Pemasangan di Google masih menunggu pengguna.

### HK profil sales dari absensi

- Pengguna bertanya ikon kalender dengan tanda minus pada Profil Sales. Sumber sebelumnya memakai nilai tetap `hk = '-'`. Pengguna meminta data HK dihitung ketika sales melakukan absensi.
- Ditambahkan helper privat `getAttendanceWorkDatesBySales_` di code.gs: hitung tanggal hadir unik per sales/bulan, format tanggal divalidasi, tanggal masa depan diabaikan, deduplikasi tanggal dan sales_id dinormalisasi. Memakai pembatasan getSheetData_ sehingga sales tidak dapat membaca absensi pengguna lain.
- Hadir/terlambat dan format status kehadiran yang didukung dihitung. Izin, sakit, alpa, cuti, tidak hadir, status nonaktif/arsip/batal dan status tidak dikenal tidak dihitung. Baris legacy dengan status kosong masih dihitung bila ID dan tanggal valid. Minggu/libur dengan absensi hadir tetap menambah HK aktual.
- Metadata tiap profil memuat attendance_hk dan attendance_month. Profil menampilkan bulan berjalan menurut Asia/Jakarta, misalnya 8 HK · Okt 2026, dan 0 HK bila belum absen.
- Setelah unggah absensi berhasil, client memuat ulang metadata profil. Entri manual ATTENDANCE memerlukan Sinkronisasi Live/refresh agar tampilan diperbarui.
- TOTAL HK pada laporan bulanan disamakan dengan absensi hadir unik untuk bulan yang dipilih, menggantikan gabungan tanggal transaksi/semua status absensi. Total transaksi/SHJ tidak diubah.
- File yang perlu diganti: code.gs (di editor mungkin Kode.gs) dan js.html. Tidak perlu update struktur sheet. `/exec` perlu update versi deployment existing; `/dev` simpan dan refresh.
- 64 tes lokal lolos, termasuk duplikasi, status, tanggal invalid/future, Jakarta saat pergantian bulan, batas akses, konsistensi laporan dan pemuatan ulang setelah unggah. Chromium memverifikasi badge HK di 1440, 390, 320px. Belum dipasang atau diuji terhadap data Google nyata oleh agen.

### Review menyeluruh kesiapan launch

- Pengguna meminta analisis semua bagian aplikasi, fitur/fungsi yang belum selesai dan rekomendasi. Scope kali ini review, bukan implementasi perbaikan transaksi.
- Review memakai kode aplikasi commit 0d564397388c1d7279413d53df84e8726a1fc318. Ditambahkan REVIEW-KESIAPAN-LAUNCH.md, tools/review-repro.cjs dan docs/review-observations-2026-10-25.jsonl. Tidak mengubah logika aplikasi/deployment/data Google.
- Suite yang ada 64 lulus/0 gagal. Reproduksi tambahan dengan Sheet/auth/Drive tiruan menghasilkan 22 observasi, bukan suite lulus. Script tidak memakai jaringan Google atau data nyata.
- Terkonfirmasi: stok10 qty6+6 menjadi-2; qty-2 menambahstok12; qty0 diterima; browserharga0/1 menimpa master60/100; gagalwrite transaksi meninggalkan stok8/transaksi0; gagalmutasi menyisakan transaksi tetapi responsgagal, retry memotongstoklagi; kirimanulang tidak dicegah; tanggalinvalid/distributorunknown/produkINACTIVE diterima; catatan formula diteruskan utuh; datefilter kehilangan Date yang memiliki komponenjam; SHJmaster10 vs tersimpan40; targetCanvasser30jt menjadi80jt di metadata tetapi30jt di dashboard; grafikCanvasser0 meskipuncabang100; ekspor menutupi errorbaca menjadi sukses0row; absensi future/2026-02-31 diterima;23:59diberiontime; gagalflush setelahappend absensi meninggalkanrow tetapifileditrash; mutasisheetabsen takmencegahpenjualan.
- Potensi formula injection ditandai berdasarkan jalur data dan semantik API; eksekusi formula/exfil pada Google nyata TIDAK diuji. Pembacaan dokumentasi publik dari jaringan ditolak403; tidak mengklaim melakukan verifikasi Google langsung.
- Kebutuhan edit transaksi yang sudah disepakati masih belum ada. Pembatalan, stok masuk/koreksi lengkap, penutupan bulan, backup berkala/restoreuji, koreksi absensi/izin/sakit/GPS/checkout belum lengkap/tersedia. Bedakan kebutuhan launch dari tambahan opsional.
- Prioritas yang direkomendasikan: integritas penulisan dan validasitransaksi (termasukliteralteks danretryaman), edit/pembatalan+audit, ketepatanlaporan, aturanabsensi/foto, rekonsiliasidataOktober+stokNovember serta pilot danproduksiterpisah.
- Review lengkap menandai keterbatasan: isi AppsScript/deploymentGoogle aktual belum dicocokkan denganrepo, konfigurasi sharing tidak diperiksa, data spreadsheet nyatatidakdiaudit. Jangan menyebut semua64tes sebagai buktikesiapanlaunch.

### Paket perbaikan transaksi dan stok (pembuatan transaksi)

- Pengguna menyetujui prioritas pertama review: satu paket integritas transaksi/stok. Implementasi di cabang uji-login; bukan edit/cancel dan bukan memperbaiki semua temuan laporan/absensi.
- Baru transactions.gs memakai REST Sheets API + OAuth internal tanpa logging token; enabledAdvancedServices Sheets v4 di manifest untuk aktivasi API. Public diagnostic checkKchTransactionSetup hanya admin utama, read-only. Endpoint status kiriman privat di gateway auth.
- Qty integer positif, agregasi produk, tanggal valid <=hariini, validasi sales/produk/harga/distributor aktif dan master unik, penentuan kolom stok tanpa fallback, harga master dengan quote-check dan dua desimal minor units, kepemilikan server, literal stringValue untuk catatan.
- Satu atomic batchUpdate menyimpan stok+transaksi+mutasi+audit+COMMITTED receipt, membuat ledger yang belum ada dalam batch sama. Reservasi PENDING terpisah append-only; retry memakai ID+UID/fingerprint. COMMITTED replay tak menulis finansial lagi, failed terminal memakai kode baru setelah koreksi.
- Keputusan konservatif: PENDING ambigu tidak pernah dikirim ulang finansial secara otomatis. Menahan seluruh save dan native maintenance sampai hasil dipastikan; eksekusi mati setelah reservasi bisa membutuhkan investigasi admin manual. Tidak ada auto-timeout reset/rollback yang berisiko menimpa stok dari batch terlambat.
- Client sessionStorage hanya opaque request ID, dipisahkan UID+hostname, bukan payload/token. Form fieldset terkunci saat uncertain; tombol Periksa hasil di luar fieldset. NOT_FOUND retry mempertahankan ID/detail; refresh perlu isi detail lagi jika belum tercatat. Sukses reload metadata, tanpa local stock decrement.
- getSheetData mempertahankan numerik uang raw; preview SHJ disamakan dengan jual-modal existing server semantics, formatRupiah mendukung maksimal2desimal. Tidak mengubah transaksi historis.
- Paket pemasangan7file: baru transactions.gs, ganti code.gs/Kode.gs, auth.gs, setup.gs, js.html, index.html, appsscript.json. Seluruh langkah, aktivasi API, pemeriksaan admin dan skenario UJI COBA di PANDUAN-UJI-LOGIN.md.
- Alat review-repro sekarang menjelaskan bahwa ia historis ketika dijalankan terhadap implementasi baru; bukti JSONL lama dipertahankan. Tidak mengklaim semua review selesai.
- Tidak ada perubahan spreadsheet/deploymentGoogle nyata. Pengguna perlu memasang lalu uji API pada salinan. Manual stok/proyeklain tidak terlindungi ScriptLock proyek ini. Edit/cancel, stokmasuk/koreksi, laporan, absensi lanjutan tetap backlog.
- Hasil akhir lokal: `node --test tests/*.test.cjs` → 104 lulus/0 gagal (40 tes transaksi/client baru); Chromium memeriksa disabled fieldset, tombol Periksa hasil di luar fieldset, retry ID sama, pembukaan form setelah COMMITTED serta lebar1440/390/320px. `git diff --check` dengan toleransi CRLF lolos. Tidak membuktikan aktivasi API/dataGoogle aktual.

### Jeda setelah panduan pemasangan paket transaksi

- Pengguna meminta menyimpan progres untuk dilanjutkan nanti.
- Kode paket transaksi sudah di-push ke uji-login, commit ef80dcfcd0ff4e93d147734fc2716c5c09ee6312; tujuh tautan file dan cara Copy raw file sudah diberikan.
- Pengguna tidak menemukan Google Sheets API di daftar Layanan. Diberikan alternatif lewat Setelan proyek: tampilkan manifes appsscript.json, salin manifest berisi enabledAdvancedServices Sheets v4, simpan dan refresh editor; layanan tampil sebagai Sheets. Belum ada konfirmasi/screenshot bahwa aktivasi berhasil.
- Pertanyaan terakhir apakah perlu menekan Perbarui di sheet: dijawab tidak perlu, karena itu maintenance bukan update kode webapp. Berikutnya pilih checkKchTransactionSetup di editor lalu Jalankan, izinkan akses bila diminta, periksa log success:true. Untuk /exec perlu versi deployment baru.
- Jangan menganggap tujuh file, pemeriksaan API, deployment atau uji transaksi Google sudah selesai: pengguna belum mengirim hasil pemeriksaan. Saat lanjut, mulai dengan memastikan hasil log checkKchTransactionSetup, kemudian uji kecil pada salinan UJI COBA mengikuti panduan. Jangan memakai data asli atau menjalankan repair hanya untuk memasang paket.

### Uji Google berhasil dan penyederhanaan status simpan — 26 Oktober 2026

- Screenshot pengguna membuktikan checkKchTransactionSetup di Google selesai success:true, missingSheets:[], pendingRequests:[], layanan Sheets terlihat. Pengguna kemudian mengonfirmasi uji simpan transaksi berhasil; detail saldo/ledger tidak ditinjau langsung oleh agen.
- Pengguna terganggu panel oranye berisi Menyimpan transaksi dan stok, request ID dan Periksa hasil saat proses normal. js.html kini menyembunyikan panel pada pengiriman/retry normal: progres cukup tombol Menyimpan… dan form disabled. Panel recovery tetap muncul bila hasil tidak pasti/koneksi gagal; perlindungan transaksi/stok tidak berubah.
- Pemasangan perubahan tampilan ini hanya mengganti js.html. Simpan + refresh /dev, atau versi deployment baru + refresh /exec. Tambahan assertion pada tes client memeriksa panel tidak terlihat dan label tombol saat mengirim.

### Tampilan netral selama memuat data — 26 Oktober 2026

- Pengguna kembali mengonfirmasi tes transaksi berhasil (screenshot Monitoring Stok); uji penolakan stok kurang untuk dua baris produk belum dilakukan karena pengguna mengalihkan sementara ke revisi tampilan loading.
- Angka Rp147.000.000 ternyata hardcoded pada index.html, bukan angka master saat loading. Diganti placeholder — untuk KPI omzet/target/achievement/hari/top sales, donut dan counter dashboard. Nama/email contoh di header juga dinetralkan; berita awal memakai Memuat berita, bukan klaim belum ada berita sebelum dibaca.
- js.html menambahkan setDashboardLoadState: loading mengosongkan KPI/legenda/grafik/performa/aktivitas/transaksi terbaru dan cache dashboard lama; status Memuat data; hanya setelah render respons berhasil menjadi Live Sync. Error tetap — dengan pesan Gagal memuat data; angka nol ditampilkan bila memang dikembalikan server.
- loadMetadata memulai loading dan menginvalidasi respons metrics lama. Sequence dashboard memastikan respons permintaan periode lebih lama tidak menimpa filter yang lebih baru. Dihapus pemanggilan metrics ganda dalam callback triggerManualSync; metadata sudah memuat metrics.
- Dua file pemasangan: index.html dan js.html. /dev simpan+refresh, /exec versi deploymentbaru+refresh; tidak perlu Perbarui Sheet/repair atau perubahan schema/API.
- 110 tes otomatis lokal lulus termasuk 6 tes state loading, error, success, zero nyata, race filter dan invalidasi metadata; Chromium menguji placeholder awal/loading/error/success pada1440/390/320px. Tidak mengubah perhitungan target server atau dataSheet.

### Penolakan di Google dan bahasa validasi qty — 26 Oktober 2026

- Screenshot uji dua baris PEAGB qty250+250 menunjukkan penolakan: sisa499 diminta500. Screenshot lanjutan menunjukkan stok PT.Global tetap499; riwayat6faktur tidak menampilkan transaksi percobaan Rp3.279.500. Bukti UI mendukung uji penolakan; ledger/jurnal Google tidak dibaca langsung agen.
- Uji qty0 menghasilkan tooltip native browser Inggris Value must be greater than or equal to1. Pengguna meminta pesan Bahasa Indonesia. js.html menambahkan updateTransactionQuantityValidity dan mengaitkan oninput/oninvalid pada input qty dinamis; required/min1/step1 tetap. Pesan menjadi Jumlah produk minimal1 dan harus berupa bilangan bulat. Pesan toast pre-submit disamakan. Custom validity dibersihkan setelah qty valid agar koreksi tidak terkunci.
- Chromium memeriksa0/negatif/pecahan/kosong, event invalid lewat reportValidity dan koreksi ke1/2. Sembilan tes client transaksi lulus. Perubahan bahasa ini hanya mengganti js.html; simpan+refresh /dev atau updateversi /exec+refresh, tanpa PerbaruiSheet.

### Hasil uji Google yang dikonfirmasi setelah jeda

- Pengguna mengonfirmasi qty0 ditolak; pesan native sudah diterjemahkan melalui js.html commit27c3276. Screenshot tanggal27Okt saat26Okt menunjukkan penolakan server tanggalfuture; saldo/riwayat untuk uji tanggal tidak ditinjau langsung.
- Uji klikganda menghasilkan faktur TRX-20261026-d6d34682ff7c4f10 Rp6500; screenshot riwayat6→7faktur, stokLEXUA PT.Global500→499 danGeubrina500. Mutasi baris8 OUT1 total1000→999 denganID sama; audit baris95 CREATE_TRANSACTION sameID. Mendukung satu transaksi/satu pengurangan.
- SALES berhasil simpan TRX-20261026-3efbbfe0c08a42fd Rp13000. Screenshot profil hanya1personilMuhammadRyan/3HK; pengguna mengonfirmasi riwayat danpilihanpersonil terbatasmiliksendiri. Snapshot audit selanjutnya memperlihatkan aktor sales untuk transaksi ini.
- Admin membantuAmulHusni berhasil TRX-20261026-d9c27c78884d4603 Rp11000. Auditrow101 salesIdMPR-LSE-BIREUN, actorRoleADMIN, assistedtrue. Pengguna mengonfirmasi nama faktur danstokbenar.
- Uji masterhargaLKXOD timMotoris diAP.Geubrina: formharga13000 ditolak karena berbedamaster. Setelah sinkron, pengguna mengonfirmasi transaksi hargabaru benar. Sudah diminta mengembalikan harga asli dan sinkron; konfirmasi spesifik pemulihan harga tidak terpisah dari jawaban umum pengguna.

### Implementasi edit transaksi

- Pengguna memberi instruksi lanjut setelah usulan edit: sales sendiri/admin membantu, stok selisih, audit. Scope kali ini edit, bukan pembatalan atau perbaikan laporan/absensi.
- Tambah transaction-edits.gs: snapshot yang terotorisasi dari rawREST, validasi faktur lama, expectedRevision hash isi + urutanedit untuk optimisticconcurrency termasukABA, reason3–500, ownerimmutable, harga produkexisting dari faktur, produkbaru dari master. Distributor/tanggal/qty/produk/catatan dapat diedit.
- transactions.gs direfaktor txExecuteRequest_ untuk create/edit memakai mekanisme receipt sama; fingerprintedit mencakup operation/ID/revision/reason/business intent, sehingga collisioncreate/edit ditolak. txPlan_ menerima options internal raw/fixedPrices dan mengembalikan proposedrows; tidak menerima pilihan ini dari endpoint pengguna. Create fingerprint tetap kompatibel dengan receipt lama.
- Stok dikembalikan hanya secara virtual sebelum validasi, lalu selisih aktual ditulis bersama barisfaktur, mutasiIN/OUT dan auditEDIT_TRANSACTION, arsip_KCH_TX_EDITS danreceiptCOMMITTED dalam satu batch. PENDING ambigu tetapfailclosedglobal. IDfaktur dancreated_by/at asli dipertahankan. Tambahanproduk append, penguranganrow kosongkan18kolomstandard tanpa deletephysicalrows. Histori berisiJSONbefore/after/stock perdistributor+editor/role/alasan/waktu, dibatasi45kchar/cell.
- Authgateway menambah private getSalesTransactionForEdit/editSalesTransaction; pengecekanowner dilakukan terhadap faktur asli di server, bukanpayloadsalesId. Non-owner tidak mendapat snapshot.
- index.html menambah modaledit; js.html tombolEdit diRiwayat, hargaasli vs master, alasan, totaltwo decimal, fieldsetlock dan recoverypanel. txClientSend memilihendpointedit hanya bila payloadtransactionId, status/IDretry sama. Suksesedit menutupmodal+reloadmetadata/riwayat tanparesetdraftcreate. Snapshotlogout mencakupmodalbaru. EscapeHTMLditerapkan padaargonclickIDfaktur.
- Batas: tidakubahpemilikfaktur, belumcancel, belumclosingsbulan. Fakturlama invalid/campur/qtynonpositive/SHJinconsistent/extracolumnnonempty/>100rows ditolak. Tim sales harus masihsama, produk aktif, distributortujuan aktif. Penulismanual/proyeklain tidak ikutScriptLock.
- Paket5file: BARU Script transaction-edits.gs; ganti transactions.gs, auth.gs, js.html, index.html. Tidak perlu code.gs/setup/css/manifestbaru/APIactivationlagi/repair. Pasangsemua sebelumuji. Panduanlengkap diPANDUAN-UJI-LOGIN.md bagianPaketedittransaksi.
- Belum dipasang atau mengedit dataGoogle oleh agen. Langkahselanjutnya pengguna install5file/save danupdate/execversi, laluuji fakturqty1→2 stokkurang1 danIDtetap, laluqty2→1 stokkembali1.
- Verifikasiakhir: 139tesotomatis lokal lulus/0gagal (26tes serveredit+3tesclientbaru, suitecreate/auth/HK/loadingtetaplulus); Chromium memeriksa formedit/penambahanproduk/hargahistoris/total/doublesubmit/lostresponse/retry/commit/reset-sesi danviewport1440/390/320px. DiffchecktoleransiCRLFbersih. DataGoogle/deploymentaktualbelum disentuh.

### Menu Skor Motoris/MMTW — 27 Oktober 2026

- Pengguna meminta implementasi Skor di uji-login, mempertahankan transaksi dan edit. Instruksi lama di atas yang menyebut edit belum tersedia sudah digantikan progres terakhir; transaksi/edit tidak dihapus atau ditulis ulang dalam paket ini.
- Aturan per sales/bulan: Fokus A Bejo Jahe Merah target5jt bobot40% maks40; Fokus B Komix Herbal All/Family+Promag Herbal target5jt bobot25% maks25; omzet semua produk kecuali Promag Tablet target27jt bobot25% maks25; AA manual target400 bobot10% maks10. Fokus A/B tetap masuk omzet. Faktur campuran hanya mengecualikan baris Promag Tablet.
- Pengguna mengonfirmasi master PRODUCTS: A LBMAV=Bejo Jahe Merah; B LKXOD=Sachet Original, LKXJA=Sachet Jahe, LKXPA=Sachet Peppermint, LKXNA=Sachet Jeruk Nipis, LKXOB=Tube Original, LKXLA=Tube Lemon, LKXKA=Kids (semua Komix Herbal), LPRGQ=Promag Herbal. Pengecualian hanya LPRGN=Promag Tablet. Produk lain masuk omzet saja. Tidak ada akses baca Sheets nyata dari cloud; pemetaan berasal dari daftar eksplisit pengguna, lalu divalidasi terhadap master saat runtime.
- Baru score.gs: report read-only memakai REST Sheets API helper transaksi, pemetaan kode+cek nama master (mismatch/missing/ganda failclosed), subtotal baris dan cents; harga faktur tidak diganti masterbaru. Bulan/sales difilter, future diabaikan, baca ulang edit saat Muat ulang. Rumus Excel bobotdesimal*pencapaian*100, MIN perparameter, total asli tanpa ROUND, kategori <40/>=40<60/>=60. Target sebulanpenuh, kalender Senin–Sabtu dikurangi HOLIDAYS/alias (tanggal merah perlu lengkap), label bulanberikut dinamis termasuk pergantian tahun.
- AA hanya ADMIN melalui gateway dan helper; sales hanya baca miliksendiri. Input integer>=0 pertanggal<=hariini Jakarta, salesaktif Motoris/MMTW; tidak mengumpulkan toko dan tidak menghitung faktur/absensi. Koreksi mengganti totalharian. SKOR_EVENTS dibuat otomatis pada simpanAApertama; append-only JSON events+actorUID/email/role/time, optimisticrevision, replay ID samatidak menambah; literal stringValue, atomic sheet+event. Histori duplicate event identik dideduplikasi; revisibercabang ditolak agar tidak memilih hasil salah. Tidak menulis stok/faktur. AA tidak otomatis berubah saat edit transaksi; admin perlu koreksi bila kelayakan berubah.
- Baru score-client.html, sidebar+section di index.html, tiga integrasi kecil di js.html (state/reset, subtitle, switchView), gateway/guard AA di auth.gs. State masuk appState agar resetlogout membersihkan data. Loading/error mengosongkan hasil, late response diabaikan, pendingAA kunci form dan retry ID/detail sama. Admin bisa memeriksa pemetaan master read-only; tidak ada konfirmasi ulang karena pengguna sudah memberikan daftar kode.
- Paket pemasangan **5 file**: BARU Script score.gs dan HTML score-client.html; GANTI auth.gs, index.html, js.html. File transaksi/edit/setup/code/css/manifest/auth lain tetap dipertahankan. Pasang bersama, Simpan, refresh /dev atau updateversi /exec yang sama. Tidak perlu Perbarui Sheet/repair/API baru. Panduan lengkap dan tautan: PANDUAN-SKOR.md.
- Validasi akhir: **167 tes Node lulus, 0 gagal, 0 dilewati** (139 lama+28 baru); Chromium 1440/390/320px, input/koreksiAA, respons hilang/replayID, race periode, reset sesi, sales-only; sintaks 12 berkas/blok lulus (template server distub hanya untuk parse); diffcheck CRLF lulus. tools/score-ui-check.cjs menyimpan pratinjau docs/skor-{1440,390,320}.png dengan data tiruan.
- Agen belum memasang/deploy atau mengubah spreadsheet Google nyata. Langkah berikut pengguna salin5file ke proyek **UJI COBA**, update deployment existing, cek pemetaan, rekonsiliasi fakturcampuran dan cobaAA10→12 laluhari berikut7 menghasilkan19; pastikan akun sales hanya baca sendiri. Insentif/branding di luar scope.

### Loading abu-abu pada seluruh widget — 27 Oktober 2026

- Pengguna meminta tanda garis saat mengambil data diganti persis **Sedang memuat data**, warna abu-abu. Perubahan tampilan saja, tanpa perubahan server/perhitungan/transaksi/edit.
- index.html mengganti placeholder awal widget KPI/counter/donut/tabel/Skor; grafik menampilkan pesan saat kosong karena loading. js.html menerapkan copy yang sama pada pemuatan ulang dashboard, laporan bulanan, stok/harga/profil/berkas dari metadata, absensi, foto kunjungan, rencana, meeting, berita dan riwayat. score-client.html mengikuti status yang sama. Nilai kosong yang sah (misalnya AA belum diinput), draft formulir, error dan angka nol aktual tetap dibedakan dari loading.
- css.html memberi font kecil abu-abu hanya pada placeholder, otomatis lepas saat nilai asli dirender. Teks panjang dibungkus pada kartu selama loading; kolom dashboard/canvas dibatasi saat loading agar tidak meluber pada HP. Ilustrasi/login dan desain widget setelah data berhasil dimuat tidak diubah.
- 167 tes Node lulus; Chromium dashboard 1440/390/320 memeriksa warna abu-abu, loading grafik, transisi ready/error dan nol sebenarnya; smoke browser Skor lulus (input/koreksi/replay AA, race periode, reset sesi, akses sales). Belum dipasang di Google oleh agen.
- Paket pemasangan **4 file HTML**: ganti seluruh isi css.html, index.html, js.html, score-client.html, Simpan lalu refresh /dev atau update versi deployment /exec yang sama. Tidak perlu mengganti auth/score.gs/transaksi/manifest, menjalankan repair atau mengubah data spreadsheet.

### Layout responsif dan zoom 75% — 27 Oktober 2026

- Pengguna biasanya memakai zoom Chrome 75% dan meminta seluruh webapp tetap jelas saat diperbesar/diperkecil. Penyebab terkonfirmasi pada pengujian browser: track grid 1fr/2fr mengikuti min-content tabel/canvas, sehingga kolom dashboard dapat melampaui viewport setelah data selesai dimuat. Pembatasan sebelumnya hanya berlaku saat loading.
- Perbaikan **css.html saja untuk aplikasi**: grid KPI/dashboard/form/arsip memakai minmax(0, fr), kolom dan kartu boleh menyusut sesuai ruang, canvas dibatasi lebar wadah; tabel lebar tetap horizontal-scroll di dalam widget. Judul KPI dan nama top performer boleh membungkus tanpa elipsis. Kontrol header/filter menyesuaikan baris dan modal dibatasi tinggi viewport dengan scroll agar isi/tombol dapat dijangkau. Tidak memaksa zoom browser, mengecilkan font global, mengganti warna atau mengubah JS/server/perhitungan/transaksi/edit.
- tools/responsive-ui-check.cjs menyiapkan HTML/JS asli dengan data tiruan panjang, empat grafik **Chart.js asli**, lalu menguji 14 view pada 12 perpindahan viewport (2560,2400,1920,1536,1440,1280,1024,820,768,390,320,kembali2560). 2560 CSS px dengan device scale0.75 mewakili ruang layout layar1920 pada zoom75%; ini simulasi viewport efektif, bukan kendali menu zoom Chrome pengguna. Pengecekan overflow halaman, kolom saling tumpang tindih, resize grafik, header/modal pada tinggi600px, sidebar collapse/expand dan data tetap utuh lulus.
- Pengujian Node167 tetap lulus; tes loading1440/390/320 tetap lulus. Alat browser opsional membutuhkan Playwright/Chromium serta CHART_JS_PATH menunjuk bundle UMD Chart.js resmi (pengujian ini memakai4.5.1 melalui HTTPS CDN); tidak menambah dependensi aplikasi.
- Pemasangan pengguna: salin seluruh **css.html** terbaru ke proyek Apps Script **UJI COBA**, Simpan, refresh/dev atau update versi deployment/exec yang sama lalu refresh. File aplikasi lain tidak perlu diganti untuk revisi ini; tidak perlu repair/Perbarui Sheet. Belum diuji di deployment Google pengguna oleh agen.

### Dua akun tetap: Admin dan Tamu — 28 Oktober 2026

- Pengguna sudah mengonfirmasi layout zoom rapi di UJI COBA. Permintaan berikutnya mengubah akses menjadi hanya dua akun: admin pemilik tetap mhmdryyan7@gmail.com, akun pembaca diberi nama **Tamu** dan email **juniortlkchlse@gmail.com** (diberikan eksplisit pengguna). Tamu melihat progres semua tim, tidak boleh input/edit/absen/unggah/AA/ubah profil atau mengubah data apa pun. Akun sales lain tidak lagi boleh login; master profil SALES/data/transaksi/histori harus tetap ada.
- firebase-config.gs menambah KCH_GUEST_EMAIL_. auth.gs memeriksa dua email terverifikasi pada setiap RPC sebelum akses sheet; email lain ditolak walaupun barisnya role ADMIN/ACTIVE. Admin tetap role ADMIN/status/UID/namakustom existing. Tamu selalu role GUEST, label/fullname Tamu, tanpa salesId; role sheet tidak dapat menaikkan izin. Tamu boleh login tanpa baris ACCESS_USERS dan tidak membuat/mengikat UID/menulis sheet; jika ada baris, status/UID/duplikasi tetap diperiksa.
- Gateway Tamu memakai daftar operasi baca eksplisit; semua write, edit snapshot, receipt/status internal, profil, akses dan logClientActivity ditolak. Data bisnis semua sales terbaca; USERS/ACCESS_USERS/SKOR_EVENTS/_KCH_ internal tetap tidak dibaca melalui generic sheet helper. score.gs menyediakan semua Motoris/MMTW untuk Tamu; AA tetap admin saja.
- code.gs: pembacaan laporan bulanan Tamu tidak menyimpan MONTHLY_TEAM_REPORT; getTodayPlans untuk Tamu tidak membuat sheet bila belum ada. Jalur admin/transaksi/edit/stok tidak ditulis ulang. Browser smoke dan server snapshots membuktikan baca Tamu tidak memutasi sheet pada layanan tiruan.
- Panel admin diganti Kelola akun: hanya menampilkan Admin/Tamu dan mengubah status Tamu Aktif/Nonaktif; menolak tambah akun ketiga/ubah Gmail admin/promosi Tamu. Save oleh admin membuat/memperbarui satu baris GUEST dengan sales_id kosong, mempertahankan UID, kolom tambahan dan baris lama. Tidak ada penghapusan data/akun lama.
- auth-client.html memasang class kch-readonly/label Tamu, hanya menu baca/sinkron/keluar untuk Tamu, tanpa Edit profil/Kelola akun. Reset sesi melepas class sehingga login admin memulihkan kontrol tulis. index.html/js.html/css.html menandai/sembunyikan form/tombol tulis, mencegah buka Input Penjualan/upload/edit serta pemulihan draft transaksi/logclient pada sesi Tamu. Server tetap penegak izin utama, bukan CSS.
- Validasi: **170 tes Node lulus/0 gagal/0 dilewati**; tes akses sales yang sekarang obsolete diperbarui sesuai kontrak dua akun. Seluruh suite transaksi/edit/stok tetap berjalan. tools/guest-ui-check.cjs (Playwright/Chromium, app dan resolver/gateway Tamu asli dengan layanan Google tiruan) lulus untuk baca semua tim, tanpa mutasi sheet, kontrol tulis tersembunyi dan transisi Tamu→Admin→Tamu.
- Paket aplikasi **9 file pengganti**: firebase-config.gs, auth.gs, code.gs/Kode.gs, score.gs, auth-client.html, auth-ui.html, index.html, js.html, css.html. Pertahankan transactions.gs/transaction-edits.gs/score-client.html/setup.gs/manifest. Tidak perlu repair/Perbarui Sheet/menghapus baris sales. Pasang bersama/Simpan/update deployment /exec yang dipakai; gunakan /exec untuk Tamu, bukan memberi akses editor demi /dev. Panduan lengkap PANDUAN-AKUN.md. Deployment lama yang belum diperbarui masih memakai izin lama; hentikan URL deployment usang yang tidak dipakai.
- Agen belum memasang kode/mengubah data Google atau menguji login nyata pengguna. Langkah berikut pengguna memasang9file ke **UJI COBA**, login admin/Tamu terpisah, uji all-team/read-only, penolakan Gmail sales lama dan status Tamu. Jangan meminta password/token. Instruksi lama tentang pendaftaran/login sales di atas sudah digantikan keputusan dua akun ini.

### Skor MPR/Canvasser + branding harian — 28 Oktober 2026

- Pengguna meminta menambah Skor untuk **MPR/Canvasser**: branding target300/bulan maks5poin, AA menjadi5poin hanya untuk dua tim ini. Melalui pertanyaan async, pengguna mengonfirmasi target/parameter lain serta kategori mengikuti Motoris/MMTW (FokusA5jt40, FokusB5jt25, TotalValue27jt25, AA400), dan branding **input harian admin** yang dijumlah bulanan. Jangan mengubah aturan Motoris/MMTW atau fitur lain.
- score.gs menambah klasifikasi tepat MPR/CANVASSER (TEAM-01 legacy), mengecualikan Junior Canvasser/Asisten MPR/Ultimate. Rule MPR/Canvasser lima parameter:40/25/25/5/5, targetbranding300, totalmax100; Motoris/MMTW tetap40/25/25/10 empatparameter tanpa branding. Rumus asli tanpa ROUND, kategori, targetbulanpenuh, kalender dan pemetaan produk tidak diubah.
- Endpoint baru privat saveScoreBranding_ melalui auth.gs admin-only; Tamu diblokir daftar izin baca. Save AA/branding memakai helper harian bersama dengan validasi integer>=0, tanggal nyata<=hariini, salesaktif dan branding hanya MPR/Canvasser. Catatan append-only jenis BRANDING:SALesID:date di SKOR_EVENTS, scope terpisah dari AA, header/AA lama tetap. Revisi, requestID/replay, audit dan penulisan literal/atomic yang sama dipertahankan.
- score-client.html/index.html menambah kartu input dan riwayat branding hanya untuk pilihan MPR/Canvasser; Tamu hanya baca. Parameter branding dirender sebagai angka, bukan Rupiah. Pending branding mengunci kedua form/filters; retry kiriman sama, koreksi mengganti nilai harian. Pindah ke Motoris/MMTW menyembunyikan kartu dan mempertahankan AA10. js.html hanya memperbarui subtitle halaman Skor.
- **184 tes Node lulus/0 gagal/0 dilewati**, termasuk14tesbaru dan penyesuaian teseligibilitas yang sekarang mencakupCanvasser. Browser1440/390/320 lulus untuk brandingcreate/correction/replay respons hilang, isolasiAA, periode/reset sesi, MPR↔Motoris dan guestread-only; tools/guest-ui-check.cjs tetap lulus tanpa mutasi pada pembacaan Tamu. Tidak mengubah transaksi/edit/stok/accountdesign/css atau dataGoogle.
- Paket **5 file pengganti**: Script score.gs, Script auth.gs, HTML score-client.html, index.html, js.html. Panduan lengkap **PANDUAN-SKOR-MPR.md**. Tidak perlu mengganti CSS/code/transactions/manifest, repair, atau membuat sheet manual. Pastikan **score.gs benar-benar file Script** lengkap (bukanHTML) agar tidak mengulang getScoreSetup_ is not defined pada deployment pengguna. Simpan lalu refresh/dev atau updateversi/exec yang sama. Belum dipasang/ditestGoogle nyata oleh agen.

### Koreksi target khusus MPR/Canvasser — 28 Oktober 2026

- Pengguna mengoreksi target MPR/Canvasser: FokusA Bejo **Rp6.400.000**, FokusB KomixHerbalFamily+PromagHerbal **Rp8.200.000**, TotalValue(nonPromagTablet) **Rp80.000.000**, AA **400outlet**, Branding **300outlet**. Bobot/maks tetap40/25/25/5/5. Koreksi ini menggantikan asumsi target5jt/5jt/27jt MPR pada catatan paket awal di atas.
- score.gs memakai target sesuai kelompok tim. **Motoris/MMTW tetap5jt/5jt/27jt, AA400 maks10 dan tanpa branding**. Pemetaan produk, input harian dan kategori/rumus tidak berubah. Hanya3nilai target conditional pada kode aplikasi; panduan PANDUAN-SKOR-MPR.md dan tes disesuaikan.
- **185 tes Node lulus**, termasuk targetpenuh100poin dan setengahseluruhtarget50poin untuk kedua tim serta regresiMotoris/MMTW. Jika paketbranding5file sudah dipasang, koreksi ini hanya mengganti seluruh isi **Script score.gs**, Simpan lalu refresh/dev atau updateversi/exec. Tidak perlu fileHTMLbaru/repair. Belum diubah atau diuji pada Google nyata oleh agen.

### Rincian harian AA tertinggal loading — 28 Oktober 2026

- Pengguna mengirim screenshot: parameter AA dan ringkasan sudah400/400, tetapi tabel harian masih Sedang memuat data, tanggalinput kosong dan headeraktor belum tampil. Bukti menunjukkan respons agregat sudah diterima; belum ada akses langsung ke konsol/deploymentGoogle untuk memastikan payload produksi.
- Reproduksi lokal terhadap kode sebelumperbaikan: respons berisi AA400 dan satu hari kosong dengan properti count tidakada menghasilkan Cannot read properties of undefined (reading toLocaleString). Ringkasan400 sudah tampil, tabelharian tetaploading, cocok dengan gejala screenshot. Penyebab omission pada deployment nyata belum terkonfirmasi; jangan mengklaim sudah memeriksa transportGoogle.
- Perbaikan aplikasi **score-client.html saja**: normalisasi nullable dailyAA/dailyBranding di batas respons, count kosong/omitted tanpa revisi diperlakukan belumdiinput (null→—), angka0 tetap0 dan400 tetap400. Bila catatanpunyarevisi tetapi angkanya tidak ada, data invalid, arrayharian tidaklengkap atau rendergagal, tampilkan pesan, hapusplaceholderloading dan nonaktifkan simpan; janganmengarang0/mengizinkan overwrite. Callback renderdibungkus errorhandling agar exceptiontidak meninggalkan loadingtanpabatas. Nilai/rumus/target/ledger server tidak diubah.
- **190 tes Node lulus**, termasuk5tesbaru: nullableomitted+AA400+zero, arraymissing, committedcountmissing, transportfailureclearloading, brandingnullable. Browser1440/390/320 lulus dengan respons menghilangkan sebagian fieldcountnull secara sengaja serta mempertahankan sebagian null eksplisit; guestsmoke dan isolasiAA/branding/replay tetaplulus. Belum diuji langsung padaGoogle pengguna.
- Pasang cukup seluruh isi **HTML score-client.html**, Simpan dan refresh/dev atau update versi/exec yang sama. Tidakperlu score.gs/auth/indexbaru, repair atauinputulangAA400. Jika masalah belum selesai, pesan errorbaru menggantikan loadingpermanen untuk diagnosislanjutan.

### Rekap Skor seluruh tim + catatan mengejar target — 28 Oktober 2026

- Pengguna meminta widget tabel rekap Skor seluruh sales yang masuk penilaian, **di bawah parameter dan di atas AA**, dengan catatan singkat di bawah nama sales: kekurangan produk FokusA Bejo dan FokusB Komix/Promag berdasarkan harga/satuan, TotalValue, AA dan branding. Penjelasan disetujui pengguna sebelum implementasi: satu targetgabungan FokusB dengan Komix **ATAU** Promag sebagai alternatif, jumlahdibulatkankeatas, varian/satuanacuan jelas, targettercapai ditandai dan Admin/Tamu dapatmembaca.
- score.gs mengekstrak helper perhitungan report yang sama (tidak mengubah rumus/target) dan menambah getScoreTeamSummary_. Satu snapshot metadata+batchread untuk semua sales; transaksi dikelompokkan per sales sekali. Rekap mengikuti bulan, memuat Motoris/MMTW/MPR/Canvasser (profil nonaktif ditandai), sort totalasli menurun. Invalidreport satuorang ditandai null/alasannya bukan0, yanglain tetapditampilkan. Tidak ada write sheet/finansial.
- Estimasi memakai harga jual **aktif PRICE_MASTER sesuai tim**, harga per satuan, qtyCEIL(sisa/harga), harga historis transaksi tetap untuk aktual. FokusA LBMAV; FokusB satuvarianKomix valid (Originaldiprioritaskan, fallback bernama jelas) **ATAU** LPRGQ, tidak meminta dua kali target. Harga/satuan kosong/nol/invalid/ganda/beda master atauproduk nonaktif → sisaRp+penjelasan tanpa qtytebakan. Tidak ada konversi sachet/tube/dus→box tanpa data; harga tim lain tidak dipinjam. UnitPRICE_MASTER fallbackPRODUCTS jika kosong; konflikunit ditolak untukquote.
- auth.gs hanya menambah endpointbaca rekap ke gateway dan whitelistTamu. index.html menambah widget pada posisi tepat; score-client.html menambah catatan/kolom/period cache dan sequenceguard. Periode/gantiakun/Muatulang invalidasi, saveAA/branding memperbarui rekap; gantisales bulan sama reuse, kegagalanrekap terpisah dari AA agar tidakmengunci detail. Seluruh teks master/nama/notes di-escape. Nilai totalnull/omitted tetap—bukan0.
- **207 tes Node lulus**, termasuk17tesrekap baru; seluruh tesSkor lama/target MPR/motoris/transaksi/edit/akun tetapdijalankan. Chromium1440/390/320 lulus: posisiwidget, quotesBejo/KomixATAUPromag, perbaruan rekapAA384 danbranding288 setelahkoreksi/replay, pergantianperiode/sesi, guestread-only dan tanpamutasisheet. Backendtest memverifikasi hanya2requestGoogleAPI (metadata+batchread) untuk rekapseluruhtim, bukan NreportRPC. Belum membaca/deployGoogle nyata.
- Paket **4 file pengganti**: Script score.gs, Script auth.gs, HTML score-client.html, index.html. Panduan **PANDUAN-REKAP-SKOR.md**. Tidak perluCSS/jsbaru, repair, reset data atau sheetbaru. Simpan lalu refresh/dev atau updateversi/exec sama; minta pengguna cocokkan hasil satu sales dengan detail/hargamastertimnya. Input/rumus/bobot/target/profilakun dan fitur lain tetapdipertahankan.

### Revisi catatan rekap dan Komix Herbal Family — 28 Oktober 2026

- Pengguna menyetujui penulisan “Fokus A/B: Masih kurang Rp ….” diikuti baris kebutuhan produk, harga per satuan dan “untuk skor maksimal”. Fokus B menampilkan tiga alternatif: Komix Herbal Sachet, Komix Tube, atau Promag Herbal. AA/branding memakai “Masih kurang … outlet lagi”. Harga tetap PRICE_MASTER aktif sesuai tim; contoh pengguna bukan harga tetap.
- Definisi terbaru Fokus B menggantikan daftar lama: hanya empat sachet Original/Jahe/Jeruk Nipis/Peppermint dan dua Tube Original/Lemon + Promag Herbal. LKXKA Kids dikeluarkan dari Fokus B tetapi tetap Total Value. Aktual dihitung ulang dari transaksi ketika dibaca; tidak mengubah transaksi historis. Target/bobot/rumus/izin/input lain tetap.
- Acuan sachet dan tube terpisah, Original prioritas dengan fallback jenis sama; jika harga/satuan varian berbeda nama acuan eksplisit. CEIL sisa/harga: contoh4934800 harga10000 menghasilkan494, bukan120. Baris catatan di-escape sebelum newline menjadi br.
- Paket aplikasi cukup **score.gs (Script), score-client.html, index.html (HTML)**. Simpan/refresh dev atau update versi exec sama. Tidak perlu auth baru/repair/input ulang. 209 tes Node lulus; browser1440/390/320 dan guest read-only/transisiakun lulus. Belum membaca master atau deploy Google nyata.

### Catatan rekap lebih rapat — 28 Oktober 2026

- Permintaan pengguna: hilangkan baris kosong antara sisa target dan kebutuhan produk; tambahkan “Komix Herbal Family dan Promag Herbal bisa dikombinasikan.” setelah alternatif Fokus B.
- Hanya score-client.html untuk aplikasi: newline ganda menjadi tunggal, keterangan kombinasi pada baris berikutnya tanpa baris kosong. Harga, pengelompokan, rumus dan fitur lain tetap. Pasang cukup HTML score-client lengkap, Simpan/refresh dev atau update versi exec yang sama.

### Header rekap Skor — 28 Oktober 2026

- Sesuai permintaan pengguna, header widget Rekap Skor Seluruh Tim menjadi Fokus A, Fokus B, Total Value, AA, Branding, Total tanpa /maks. Hanya index.html untuk aplikasi; isi tabel/perhitungan tetap. Pasang HTML index lengkap, Simpan/refresh dev atau update versi exec sama. Verifikasi diff hanya lima label header.

### Tab pembaruan struktur sheet — 28 Oktober 2026

- Pengguna menyetujui tab terakhir sesudah ACTIVITY_LOGS dengan satu kontrol pembaruan mengikuti kode Apps Script. Implementasi baru **sheet-updates.gs**, tab PEMBARUAN_SHEET paling kanan, checkbox A3 berlabel PERBARUI SELURUH SHEET; Google Apps Script tidak membuat Drawing button secara native, checkbox+installable onEdit dipasang otomatis. Penjelasan checkbox disampaikan kepada pengguna saat pengerjaan.
- setup.gs hanya menambah menu pemasangan installKchSheetUpdates_. Installer admin/idUjiCoba/scriptlock, tab dan trigger idempoten, mempertahankan status existing, menolak tab nama sama yang bukan kontrol. Pasang sekali lewat menu atau editor; kode tetap harus disalin terlebih dahulu setiap revisi. Tidak memanggil repair lama/destruktif.
- Registry struktur mengambil TABLE_SCHEMAS + report/plans/meetings + ACCESS_USERS/SKOR_EVENTS/internal receipt/edit. Preflight semua header: tambah sheetkosong dan kolomkurang pada posisi skema; data/formula/format/validasi existing digeser dengan insertDimension bukan ditulisulang. Kolomcustom trailing dipertahankan; headerduplikat/kosong/reordered/ambigu berhenti, perlu migrasiexplisit bukan menebak. Header diberi navy/putih, barisdata dan nilai master tidakdireset. Tidak menanam harga/akun/contoh/hari libur.
- Guard trigger memeriksa **e.user** (editor aktual) selain Session aktif dan IDtarget, karena trigger berjalan sebagai installeradmin. Identitas kosong ditolak. Lock sama dengan transaksi + assertNoPendingTransactions_; backup copy Drive sebelum perubahan; satu batch SheetsAPI atomik; status/waktu/URLbackup/rincian di kontrol; checkbox resetfinally. Lock tidak mencegah edit manual spreadsheet sehingga jangan edit manual bersamaan. Klikulang tidakganda; backupbaru tiapklik yanglolospreflight.
- auth.gs satu tambahan filter baca nonadmin PEMBARUAN_SHEET supaya linkbackup/status tidakmunculkeTamu; tidak ada endpoint RPC baru/izin web baru. Fungsi baru berakhiran underscore.
- **217 tes Node lulus**, 8tesbaru termasuk datapreservation/formula/kolomtambahan, idempoten, registryschema, failclosed, backupfailure/pending/batchfailure, actor/target, guesthidden, installerulang1tab1trigger. Belum memasang atau menguji trigger/izinGoogle nyata. Paket3Script: BARU sheet-updates.gs, GANTI setup.gs dan auth.gs; panduan PANDUAN-PEMBARUAN-SHEET.md. Simpan, reload spreadsheet, menuSiapkanTabsekali, beriizinGoogle, klikcheckbox. Update exec untuk auth terbaru; fungsiSheets memakai kode tersimpan tanpa deploymentbaru. Jangan suruhrepair/reset.

### Fungsi pemasangan terlihat di editor — 28 Oktober 2026

- Screenshot pengguna menunjukkan Tidak ada fungsi di sheet-updates.gs. Ditambahkan entry point publik setupKchSheetUpdates tanpa underscore, memanggil installer privat dengan guard admin/IDUjiCoba yang sama. Menu setup.gs diarahkan ke nama baru; nama privat lama tetap kompatibel. Gateway web tidak menambahkan endpoint ini. Pasang sheet-updates.gs terbaru lalu Simpan/reload editor/pilih setupKchSheetUpdates/Jalankan. setup.gs terbaru opsional untuk labelmenu yang memakai fungsi baru. Tes instalasi memakai wrapper publik dan tes gateway menolak wrapper.

### Google khusus Admin; Tamu username/password — 29 Oktober 2026

- Pengguna meminta hanya admin login Google, Tamu loginbawaan username/password dengan tombol diatasGoogle, kredensial tetap ACCESS_USERS. Diimplementasikan tanpa meminta password viachat: admin menetapkan sendiri di menu Kelola akun. Tombol Masuk sebagai Tamu membuka form; tombolGoogle diberilabel(Admin). Desainutama dan fitur bisnis lain tetap.
- BARU guest-crypto.gs vendor js-sha2560.11.1/MIT serveronly (lisensi lengkap), guest-auth.gs PBKDF2-HMAC-SHA256 **600000iterasi**, saltacak, hash32byte, password12–128. Pembandingan Nodecrypto termasukUTF8 cocok; benchmarklokal600k~3.9s, bukan jaminanwaktuGoogle. Tidak ada plaintext/passworddefault/logkredensial.
- ACCESS_USERS base7kolom tetap; display_name dipertahankan; kolom auth_type/username/password_hash/password_salt/password_iterations/session_version ditambah otomatis saat adminsave. BarisKCH_GUEST_EMAIL_ tetap sebagaiidentifierinternal, bukanizinGoogle; firebaseuidlama tidakmemberiakses. Username3–40lowercase alnum._-. Saveadmin tidak menerimaemailtarget/promosirole/salesbinding; satuGuesttetap. FailclosedINACTIVE selama penulisankredensial multisel, optimisticcheck saat hashingtanpalock. Sessionversion acak menolak sesi lama walaupun deactivate/reactivate dalam timestamp sama.
- auth.gs menolak SEMUA Googleemail selain bootstrapadmin, gateway menerima tokenKCHG_ hanya melalui resolveGuestSession_; whitelistGuestread lama dipertahankan. Endpoint saveGuestCredentials adminonly. Legacy saveAccessUser tetap untukkompatibilitas dan merotasi sessionversion jika ada. listAccessUsers hanyausername/configured/status, tanpa hash/salt. GenericREAD tetapmelindungi ACCESS_USERS/SKOR_EVENTS/internal/control.
- SesiGuest8jam, tokenacak2UUID, hanya hash token di ScriptProperties denganexpiry/revision/username; tiapRPC rereadcredentials/status; logoutdelete; max50sesi cleanup expired/oldest. Global20attempts/10menit persistScriptProps+scriptlock. Login tidakmenulis sheetbisnis. Passwordhashing di luarscriptlock agar tidakmenahan transaksi.
- auth-client.html kchRun memilih guesttokeninmemory atau IDtokenGoogle; guest tidakbutuhFirebasecurrentUser. Loginpending mencegahdoubleclick/Googleeventnull, sequenceguard stale login di-logoutserver, expiryresetUI, logout tanpa navigasi. Inputpassword dikosongkan setelahsubmit/success. Adminpanel pengaturanusername/password/status. Tidakmenyimpan sesi di browserstorage; refreshperluloginulang.
- sheet-updates.gs registryACCESS_USERS mengikuti base+display_name+6kolomguest. Tidak perlu repair/inputmanualsheet. BARU2Script guest-crypto/guest-auth, GANTI auth.gs/sheet-updates.gs dan HTMLauth-ui/auth-client =6file. Simpan/update execyangsama; gunakan exec untuk GuesttanpaGmail (dev tetapbutuheditorGoogle). Setup/index/css/js/score/transaksi/firebaseconfig tidakperluubah. Panduan PANDUAN-LOGIN-TAMU.md; panduan akunlama diberipenandadigantikan.
- **231tesNode lulus**, standarPBKDF2/secretstore/nativeauth/rate/revocation/RPCguards/concurrencyUI + regresilama. Browserguest denganrealengine/nativecredentials/login tanpaFirebasecurrentUser/Googleadmin/kelolaakun/guest→admin→guest/scoreallteam/readonly/noBusinessMutation/expiry/viewport1440/390/320 lulus; browserscore AA/brandingjugalulus. Guestbrowser memakaiiterasi1000khusustes; tesstandar memverifikasikonstanta600000. Belumdeploy/readGoogle nyata.

### Password Tamu bisa dibaca di ACCESS_USERS — 29 Oktober 2026

- Pengguna eksplisit meminta password terlihat di sheet; hash saja tidak memenuhi preferensinya. Ditambahkan kolom **password** setelah session_version pada deklarasi guest-auth.gs. Saat saveGuestCredentials_ menerima passwordnonkosong, salinan asli ditulis richtext literal (tidak dievaluasiformula); hash/salt/iterasi tetap untuklogin. Savepasswordkosong mempertahankansalinanlama. Baca credentialinternal mengecualikan mirrorpassword, tidakdiRPC/log/ScriptProperties.
- Pengguna diberitahu aksesSheet berarti bisa baca password. Password lama dari hash tidakbisadipulihkan: harusdiisikembalimelaluiKelolaakunsekali. PerbaruiSheet hanya menambahkolomkosong, bukan recoverpassword. Editpasswordlewatpanel supayahashsinkron; mengeditmirrorlangsungtidakmengganti login.
- Paket cukup **Script guest-auth.gs** terbaru, Simpan/refreshdev atau updateexec. sheet-updates registry sudahdinamis dari KCH_GUEST_ACCESS_HEADERS_, tidakperluubah. 232tesNode lulus termasuk mirrorpersist/blankpreserve/literalformula/secretRPC/regresilama. BelumditerapkanGoogle nyata.

### Password kosong harus terdeteksi pada form dan save — 29 Oktober 2026

- Screenshot berikutnya menampilkan kolom password sudahada tetapi kosong. Belum ada akseslive untuk memastikan versi deployment/payload tersimpan; jangan mengklaim penyebab pasti. Ditambahkan passwordRecorded boolean (tanpa nilai asli) pada listadmin, formwajibpassword dan pesan isikembali bila mirror kosong. Blank save dengan hash existing+mirrorkosong ditolak sehingga tidak sukses tanpa mengisi sheet.
- guest-auth.gs memverifikasi readback nilai mirror setelahflush sebelum mengaktifkanakun/returnsuccess. Kegagalanwrite mismatch berhenti denganakunINACTIVE dan pesan eksplisit. Tidak mencoba recoverpassword darishash. Paket3file: guest-auth.gs, auth.gs, auth-client.html; Simpan/refreshdev atau updateexecsame. Pengguna harus isi kembali password yang diinginkan sekali laluSimpanakses, bukan sekadarPerbaruiSheet. 234tesNode lulus termasuk2tesbaru.
