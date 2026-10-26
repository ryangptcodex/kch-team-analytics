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
