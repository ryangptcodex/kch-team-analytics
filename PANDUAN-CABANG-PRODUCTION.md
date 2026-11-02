# Cabang kode Production

Cabang untuk pekerjaan dan tautan pemasangan terbaru adalah **[production](https://github.com/ryangptcodex/kch-team-analytics/tree/production)**. Seluruh histori sebelumnya dipertahankan. Tautan file pada panduan sudah diarahkan ke cabang ini.

Sesi agen tidak dapat mengakses API GitHub untuk rename/default-branch (request Forbidden). Karena `uji-login` masih menjadi default di GitHub, cabang lama dipertahankan pada checkpoint sebelumnya. Ini transisi ke cabang kerja baru, belum rename default branch secara penuh. Tidak ada force push atau penghapusan histori.

## Ganti default lewat GitHub

1. Buka [Settings repository](https://github.com/ryangptcodex/kch-team-analytics/settings).
2. Pada **General → Default branch**, ganti `uji-login` menjadi **production** dan simpan perubahan.
3. Pastikan halaman utama repository menampilkan **production** pada pemilih cabang. Gunakan tautan production untuk menyalin kode; jangan mengandalkan tautan lama yang masih menyebut uji-login.

Jika GitHub meminta hak Admin repository, langkah default branch harus dilakukan pemilik repository. Cabang lama tidak perlu dihapus sebelum pengaturan default dan referensi terkait diperiksa. Agen belum dapat memeriksa daftar PR/proteksi lewat API; jangan mengklaim keduanya tidak ada.

Nama cabang GitHub tidak menentukan database webapp. ID Apps Script, spreadsheet Production dan Firebase Production tetap seperti konfigurasi sebelumnya. Mengganti default branch tidak memperbarui deployment Apps Script; pemasangan dan Versi baru /exec tetap dilakukan di proyek Production.
