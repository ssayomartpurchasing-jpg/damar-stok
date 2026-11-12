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

`npm test` menjalankan enam pengujian: transaksi manual, stok kurang, impor atomik, preview tanpa penyimpanan, impor duplikat, retry, migrasi tanpa menimpa, baca dan tulis endpoint tanpa cookie/token serta pemeliharaan data lama, format Excel dan barcode nol depan, serta tampilan saat koneksi gagal. SQL diuji dengan PGlite (mesin PostgreSQL lokal); alur halaman diuji dengan DOM simulasi. Pengujian ini tidak menggantikan pemeriksaan akses publik dan koneksi database Netlify pada Deploy Preview. Build dan penerapan migrasi dilakukan platform saat deploy.
