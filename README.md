# DAMAR Inventory dan Stock

Aplikasi mempertahankan halaman stok, barang masuk/keluar, riwayat, ekspor Excel, dan cadangan JSON. Master dan transaksi disimpan melalui Netlify Function `/api/inventory`; browser tidak menerima koneksi database. Folder `public` saja yang dipublikasikan oleh proses deploy.

## Pemeriksaan Deploy Preview

Perubahan ini disiapkan untuk Deploy Preview dan belum diterapkan ke situs utama. Netlify menerapkan migrasi SQL ketika deploy dan menyediakan cabang database terisolasi untuk preview. Jangan menjalankan migrasi secara manual atau mengisi database produksi untuk pengujian preview.

Aplikasi dan endpoint inventaris sekarang terbuka: siapa pun yang memiliki link dapat membaca dan mengubah data tanpa akun, cookie login, atau peran. Kredensial database tetap hanya digunakan server. Riwayat baru memakai penanda `anonymous`; identitas pelaku pada riwayat lama tetap tersimpan. Netlify Identity yang pernah diaktifkan tidak lagi dipakai aplikasi dan tidak perlu diatur untuk mengakses DAMAR.

Agar link dapat dibuka tanpa akun Netlify, pemilik tim atau Developer dengan akses proyek perlu membuka [Project configuration > General > Visitor access](https://app.netlify.com/projects/damar-stok/configuration/general/#project-visibility). Pada **Project visibility**, pilih **Edit visibility**, **Customize** jika mengikuti pengaturan tim, lalu **Public**. Pastikan preview juga boleh dibuka publik. Jika dashboard memakai **Password Protection**, pilih **No protection/Unprotected** dan pastikan cakupannya mencakup preview. Simpan, lalu buka link di jendela samaran tanpa sesi Netlify. Pengaturan ini terpisah dari kode aplikasi dan harus diubah di dashboard. Internal Builder tidak dapat membuat proyek publik; hubungi Team Owner atau Developer bila pilihan tidak tersedia.

Jalankan uji penerimaan tanpa login di URL preview: halaman otomatis memuat data; `/api/inventory` harus memberi respons 200. Buat barang uji, masukkan stok 10, jual 2, pastikan stok 8; coba jual 9 dan pastikan ditolak. Unggah Excel dengan beberapa baris, periksa preview, lalu konfirmasi. Unggah isi yang sama sekali lagi dan pastikan ditolak. Saat koneksi diputus, halaman tidak boleh menampilkan keberhasilan; muat ulang data server setelah koneksi pulih untuk memastikan hasil permintaan yang responsnya hilang.

## Format Excel

Sheet pertama: baris 1 judul, baris 2 `BARCODE`, `NAMA ITEM`, `QTY`, `SATUAN`; data mulai baris 3. Unduh template dari aplikasi. Format barcode sebagai **Text** di Excel sebelum mengetik untuk mempertahankan nol depan. Nol yang sudah dibuang Excel tidak dapat dipulihkan. Barcode dibaca dari teks/tampilan sel, dicocokkan tanpa membedakan huruf besar/kecil, dan disimpan sebagai teks unik. Kuantitas maksimal tiga desimal.

Transaksi mengikuti tanggal dan jenis pada formulir. Barang masuk menambah stok dan barang keluar/penjualan mengurangi stok. Nama pada riwayat mengikuti master; satuan harus sesuai master. Barcode tidak dikenal ditolak. Master Excel membuat barang baru; barcode yang sudah ada ditolak supaya tidak mengganti stok diam-diam. Maksimal 5.000 baris per impor. Semua baris harus valid sebelum preview dapat dikonfirmasi; server memeriksa lagi saat simpan. Jika satu baris gagal, semua perubahan dibatalkan. Isi impor yang sama ditolak meskipun nama file atau urutan baris berubah. Transaksi manual menggunakan pengenal permintaan agar percobaan ulang setelah gangguan koneksi tidak menambah transaksi kedua.

## Migrasi cadangan lama

Pada browser/perangkat lama, tekan **Unduh cadangan localStorage lama**, atau gunakan JSON cadangan aplikasi versi 1 yang sudah ada. Tombol ini tetap tersedia jika koneksi database gagal. Data localStorage tidak dihapus, tidak diperbarui, dan tidak diunggah otomatis.

Buka **Migrasi / Pulihkan Cadangan JSON**, pilih file, periksa pratinjau barang serta jumlah riwayat, lalu konfirmasi. Migrasi hanya diizinkan jika database kosong. Stok cadangan dipakai sebagai saldo terkini; riwayat dimasukkan tanpa mengubah saldo lagi. Database yang sudah berisi barang tidak dapat ditimpa. Cadangan JSON baru dan ekspor Excel tetap tersedia. Batas permintaan JSON 5 MB, maksimal 5.000 barang dan 50.000 riwayat per migrasi.

## Pengujian

`npm test` menjalankan pengujian: transaksi manual, stok kurang, impor atomik, preview tanpa penyimpanan, impor duplikat, retry, migrasi tanpa menimpa, baca dan tulis endpoint tanpa cookie/token serta pemeliharaan data lama, format Excel dan barcode nol depan, serta tampilan saat koneksi gagal. SQL diuji dengan PGlite (mesin PostgreSQL lokal); alur halaman diuji dengan DOM simulasi. Pengujian ini tidak menggantikan pemeriksaan akses publik dan koneksi database Netlify pada Deploy Preview. Build dan penerapan migrasi dilakukan platform saat deploy.


## Edit, hapus, dan status master barang

Kolom Aksi pada Stok Barang menyediakan Edit. Stok tampil sebagai informasi; perubahan stok tetap melalui transaksi. Barcode berupa teks unik tanpa membedakan huruf besar/kecil, termasuk barcode barang nonaktif. Barcode dan satuan hanya dapat diubah sebelum barang memiliki riwayat transaksi. Nama dapat diubah tanpa mengganti nama pada riwayat lama.

Hapus dari Master tersedia untuk semua barang berstok nol, dengan konfirmasi nama dan barcode. Barang tanpa riwayat dihapus permanen; barang ber-riwayat disimpan sebagai arsip internal (dihapus=true, aktif=false), tidak muncul di filter Aktif/Nonaktif/Semua, pilihan transaksi, maupun ekspor stok. Riwayat tetap utuh. Barcode arsip tetap dicadangkan dan tidak dapat dipakai ulang. Arsip tidak dapat diedit, diaktifkan kembali, atau dipakai untuk transaksi/impor. Nonaktifkan tetap tersedia sebagai pilihan yang dapat dibalik. Filter Aktif/Nonaktif/Semua dan Aktifkan kembali tersedia. Barang nonaktif tetap masuk cadangan JSON dan ekspor Excel (dengan kolom Status), tetapi tidak tersedia pada pilihan transaksi dan ditolak oleh API untuk transaksi manual maupun impor. Pemulihan JSON ke database kosong mempertahankan status nonaktif; cadangan lama tanpa status dianggap aktif.

Server memeriksa ulang aturan edit, hapus, dan nonaktif di dalam transaksi dengan penguncian tabel yang sama dengan transaksi stok dan impor. Jika transaksi masuk lebih dahulu, pemeriksaan memakai stok dan riwayat terbaru; jika hapus/nonaktif lebih dahulu, transaksi berikutnya ditolak. Penghapusan hanya menyentuh master yang memenuhi syarat, tanpa cascade atau penghapusan riwayat. Semua keberhasilan ditampilkan setelah konfirmasi API.

Migrasi tambahan `20261118140000_add_item_active.sql` menambahkan status aktif dengan nilai awal aktif untuk semua barang lama dan pembatasan stok nol bagi barang nonaktif. Migrasi sebelumnya tetap utuh. Platform menerapkannya saat Deploy Preview; tidak ada reset database.

Pengujian tambahan memeriksa edit melalui API dan pembacaan ulang, penolakan perubahan stok/barcode/satuan terlarang, nama riwayat tetap, barcode duplikat termasuk barang nonaktif, hapus kosong tanpa riwayat, penolakan hapus berstok, hapus stok nol ber-riwayat beserta pemulihan cadangannya, nonaktif stok nol, penolakan manual/impor atomik, serta aktivasi kembali. Pengujian DOM memeriksa isi formulir, kegagalan server, penundaan pesan sukses, filter status, konfirmasi hapus, dan penolakan Excel nonaktif. Uji pada PostgreSQL lokal dan DOM simulasi; pemeriksaan browser serta transaksi bersamaan pada layanan Netlify tetap menjadi pemeriksaan penerimaan preview.

## Pembaruan Hapus dari Master — 18 November 2026

Migrasi `20261118150000_add_item_deleted.sql` menambahkan penanda arsip tanpa mengubah data lama. Jangan mengubah atau menghapus migrasi sebelumnya. Tidak ada reset database. API mengembalikan `barang` (master), `riwayat` (seluruh riwayat), dan `arsip` (referensi barang yang dihapus). Cadangan JSON memasukkan arsip ke array barang dengan penanda dihapus=true. Pulihkan memakai versi aplikasi ini atau yang lebih baru; arsip tetap tersembunyi dan nama transaksi lama dipertahankan.

Hapus dari Master berbeda dari Nonaktifkan: barang yang dihapus tidak tampil lagi dalam daftar master dan tidak memiliki tombol Aktifkan kembali. Baris internal dipertahankan hanya jika diperlukan sebagai referensi riwayat. Penghapusan permanen seluruh data beserta riwayat tidak disediakan.
