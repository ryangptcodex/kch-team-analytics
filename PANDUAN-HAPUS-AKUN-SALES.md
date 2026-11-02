# Bersihkan akun login sales lama

Revisi ini menghapus **akun login**, bukan profil sales atau histori bisnis.

## Pasang

1. Ganti seluruh isi Script [setup.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/production/setup.gs).
2. Ganti seluruh isi Script [sheet-updates.gs](https://github.com/ryangptcodex/kch-team-analytics/blob/production/sheet-updates.gs).
3. Simpan. Buka spreadsheet UJI COBA sebagai admin → tab PEMBARUAN_SHEET → klik checkbox **PERBARUI SELURUH SHEET** sekali. Tunggu status Berhasil dan periksa Rincian.

Fungsi checkbox menggunakan kode tersimpan; tidak perlu memperbarui deployment webapp hanya untuk menjalankan pembersihan ini. Bila webapp memakai `/exec` dan ingin menyamakan seluruh kode deployment, terapkan Versi baru yang sama seperti biasa. Tidak perlu menjalankan repair lama.

## Hasil

- ACCESS_USERS: pertahankan baris email admin yang ditentukan dan penanda akun Tamu yang ditentukan. Semua baris akun lain, termasuk sales lama atau akun lain ber-role ADMIN, dihapus. Seluruh kolom/kredensial/password/status dua baris yang dipertahankan tetap utuh.
- USERS: hapus baris akun lama selain role ADMIN/GUEST, termasuk SALES dan SALES_COORDINATOR. Baris admin/Tamu legacy tetap dipertahankan, tetapi sheet ini tidak menjadi sumber login webapp. Definisi USERS di TABLE_SCHEMAS dihapus agar setup/pembaruan tidak membuat kembali database akun login lama pada pemasangan baru.
- Master **SALES** dan seluruh transaksi, AA, branding, Skor, absensi, stok, serta ACTIVITY_LOGS **tidak dihapus**. Nama atau ID sales historis di log tetap diperlukan untuk audit.
- Backup lengkap dibuat sebelum perubahan. Backup berisi data sebelum pembersihan, termasuk akun lama; ini untuk pemulihan dan tidak menjadi sumber login webapp.
- Pembersihan dan perubahan struktur berada dalam satu batch Sheets API atomik; penghapusan baris berjalan dari bawah agar indeks baris yang dipertahankan tidak bergeser salah. Klik ulang tidak menghapus admin/Tamu atau membuat akun lama kembali.
- Header akun yang tidak dikenali menyebabkan pembaruan berhenti sebelum mengubah data, bukan menebak kolom.

Login Google nonadmin sudah ditolak oleh auth.gs terbaru; pembersihan ini menghapus sisa baris akun yang sebelumnya hanya dinonaktifkan secara aturan akses. Profil sales bukan akun login.

**236 tes Node lulus**, termasuk penghapusan akun selain dua yang ditentukan, preservasi kolom password Tamu, penghapusan role sales/coordinator legacy, master SALES tidak berubah, dan pembersihan berulang. Belum dijalankan pada spreadsheet Google nyata oleh agen; tindakan terjadi setelah admin memasang kode dan menekan kontrol pembaruan.
