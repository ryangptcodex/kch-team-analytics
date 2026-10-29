# Login Google Admin dan username/password Tamu

Revisi 29 Oktober 2026 menggantikan login Google Tamu. **Hanya Gmail admin `mhmdryyan7@gmail.com` yang dapat masuk melalui Google.** Tamu memakai satu username/password bersama melalui tombol **Masuk sebagai Tamu**, di atas tombol **Masuk dengan Google (Admin)**.

Akun Tamu tetap **hanya melihat** seluruh tim, termasuk Skor: tidak dapat input/edit transaksi, absen, unggah, menyimpan AA/branding, mengubah profil atau akun. Validasi dilakukan server pada setiap permintaan, bukan hanya menyembunyikan tombol. Fitur bisnis dan data lama dipertahankan.

## Pasang enam file lengkap

Di proyek Apps Script **UJI COBA**, gunakan Raw / Copy raw file pada masing-masing tautan:

| File | Tindakan |
| --- | --- |
| [guest-crypto.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/guest-crypto.gs) | **BARU, Script** `guest-crypto`, bukan HTML. Library SHA-256/HMAC server, js-sha256 0.11.1 berlisensi MIT disertakan lengkap. |
| [guest-auth.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/guest-auth.gs) | **BARU, Script** `guest-auth`, bukan HTML. Password Tamu dan sesi. |
| [auth.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/auth.gs) | Ganti seluruh isi Script `auth`. |
| [auth-ui.html](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/auth-ui.html) | Ganti seluruh isi HTML `auth-ui`. |
| [auth-client.html](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/auth-client.html) | Ganti seluruh isi HTML `auth-client`. |
| [sheet-updates.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/uji-login/sheet-updates.gs) | Ganti seluruh isi Script `sheet-updates`; daftar skema ACCESS_USERS sekarang mencakup kolom kredensial. |

**Pasang semuanya sebelum dipakai, lalu Simpan.** File setup/index/css/js/score/transaksi/manifest/firebase-config tidak perlu diganti. Tidak perlu repair, menghapus akun/sales lama, atau mengubah stok/harga/data transaksi.

Untuk `/dev`, refresh sebagai editor admin. Untuk pengguna Tamu tanpa Gmail, gunakan **URL `/exec`**, bukan `/dev` yang tetap membutuhkan akses editor Google. Perbarui deployment UJI COBA yang sama: **Terapkan → Kelola deployment → ikon pensil → Versi baru → Terapkan**. Pengaturan webapp harus tetap berjalan sebagai pemilik dan dapat diakses Siapa saja, sesuai manifest yang sudah ada; autentikasi di dalam webapp tetap wajib. Deployment lama yang belum diperbarui masih menjalankan login lama.

## Atur username dan password pertama kali

1. Masuk memakai **Google admin** pada webapp terbaru.
2. Buka menu akun kanan atas → **Kelola akun**.
3. Isi username Tamu (3–40 karakter: huruf kecil/angka/titik/garis bawah/tanda hubung), password pilihan sendiri (12–128 karakter), lalu pilih **Aktif**.
4. Klik **Simpan akses**. Tunggu pesan **Akun Tamu disimpan**.
5. Buka URL `/exec` pada tab samaran, klik **Masuk sebagai Tamu**, isi username/password yang dibuat tadi, klik **Masuk**. Tidak ada popup atau login Gmail yang diperlukan.

Belum ada password bawaan. Pengguna menentukan sendiri dari sesi admin. Username/password tidak perlu dikirim lewat chat. Untuk mengganti password, gunakan panel yang sama; kosongkan password jika hanya mengubah username/status dan ingin mempertahankan password lama. Pemasangan pertama wajib mengisi password.

## Penyimpanan di ACCESS_USERS

Tujuh kolom lama tidak dihapus/dipindah. Kolom `display_name` tetap dipertahankan, lalu kredensial memakai:

- `auth_type` = PASSWORD.
- `username` = username Tamu.
- `password_hash` = hasil PBKDF2-HMAC-SHA256, bukan password asli.
- `password_salt` = salt acak per penggantian password.
- `password_iterations` = 600000.
- `session_version` = versi acak untuk mencabut sesi lama.
- `password` = salinan password yang bisa dibaca di sheet, sesuai permintaan terbaru pengguna.

Admin menyimpan lewat Kelola akun; kolom yang kurang dibuat otomatis sehingga tidak perlu menambahkan header secara manual atau menekan pembaruan sheet terlebih dahulu. Kontrol **PEMBARUAN_SHEET** juga mengenali kolom baru setelah script-nya diganti.

Baris Gmail Tamu lama tetap dipakai sebagai **penanda internal satu akun Tamu** agar status/data lama tidak hilang. Kolom email/Firebase UID lama tidak memberi izin login Google lagi. Username/password tidak bisa mempromosikan akun menjadi Admin, walaupun payload dimanipulasi; perubahan role/status yang tidak valid pada sheet ditolak.

Sesuai revisi 29 Oktober 2026, password asli ditulis ke kolom `password` di sheet setelah admin menyimpannya, tetapi tidak dikirim kembali ke browser/panel, log, GitHub, atau Script Properties. Siapa pun yang dapat membaca spreadsheet/cadangan dapat membaca password ini. Jangan mengisi password asli ke kolom `password_hash`; gunakan Kelola akun agar hash/salt/versi konsisten.

## Sesi dan pembatasan login

- Sesi Tamu berlaku maksimal **8 jam**, disimpan di memori tab browser, bukan localStorage/sessionStorage. Refresh/menutup tab memerlukan login ulang.
- Server menyimpan hash token sesi dan masa berlaku pada Script Properties, terpisah dari kredensial ACCESS_USERS. Setiap RPC memeriksa kembali akun/status/hash/versi dari sheet.
- Mengganti username/password/status atau menyimpan ulang akun mencabut sesi sebelumnya pada permintaan berikutnya. Logout menghapus sesi server; UI dan data sesi lama segera dibersihkan. Bila jaringan putus saat logout, UI tetap dibersihkan dan sesi server tersisa akan kedaluwarsa.
- Maksimal **20 percobaan login Tamu per 10 menit** untuk webapp ini, termasuk percobaan username lain. Jika batas tercapai, tunggu jendela berikutnya. Tidak menggunakan kunci per username acak yang dapat memenuhi penyimpanan.
- Mendukung beberapa pembaca Tamu bersamaan, maksimal 50 sesi aktif; bila penuh sesi tertua dicabut. Salt/verifier/versi kredensial tidak dikirim ke browser.
- PBKDF2 dikerjakan saat menyimpan password baru dan saat login; proses ini dapat memerlukan beberapa detik. API pembacaan data selanjutnya tidak menghitung ulang PBKDF2.

## Pengujian

**231 tes Node lulus**, termasuk pembandingan PBKDF2 dengan Node crypto (password UTF-8), penyimpanan tanpa plaintext, setup awal tanpa ACCESS_USERS, login salah/akun nonaktif/role palsu, token palsu/berakhir/logout, pencabutan password/username/status, rate limit, penolakan seluruh write Tamu, guest RPC tanpa Firebase dan respons lama saat logout. Seluruh regresi transaksi/edit/stok/AA/branding tetap dijalankan.

Chromium memakai HTML/JS dan gateway/login/sesi asli dengan layanan Google tiruan: Tamu masuk tanpa Firebase currentUser, password salah, Skor dan semua tim terbaca tanpa perubahan data bisnis, kontrol input tersembunyi, logout mencabut token, Admin Google mengatur kredensial, perpindahan Tamu → Admin → Tamu, pencabutan akun membersihkan UI, serta lebar 1440/390/320. Pengujian browser Skor/input AA/branding juga lulus.

Belum dipasang atau diuji langsung pada Google/deployment pengguna oleh agen. Setelah memasang, cocokkan login Admin, Tamu pada tab samaran `/exec`, pembacaan Skor dan penolakan input. Akun Google Tamu lama seharusnya ditolak oleh versi terbaru.

## Revisi password terlihat di sheet

Cukup ganti **guest-auth.gs** terbaru. Registry pada sheet-updates.gs otomatis membaca kolom tambahan dari deklarasi tersebut; tidak perlu mengganti file aplikasi lain. Simpan, refresh dev atau update versi exec yang sama. Klik Perbarui jika ingin membuat kolom password terlebih dahulu (berada setelah session_version), tetapi updater tidak bisa memulihkan password dari hash.

Login Admin → Kelola akun → **isi kembali password yang diinginkan** → Simpan akses. Kolom password terisi otomatis dan terbaca; jika password dikosongkan saat simpan, nilai sebelumnya dipertahankan. Untuk akun lama yang kolomnya baru ditambahkan, nilai tetap kosong sampai password diisi dan disimpan ulang. Ubah password melalui Kelola akun agar hash dan salinannya sinkron; mengedit kolom password saja tidak mengganti password login karena autentikasi tetap memakai hash. Password yang diawali tanda sama dengan disimpan sebagai teks literal, bukan formula. **232 tes lulus**.
