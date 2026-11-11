document.addEventListener("DOMContentLoaded", function () {
  const ambil = (id) => document.getElementById(id);

  // Pertahankan kunci ini agar data lama tetap terbaca.
  const KUNCI_DATA = "damar-stok-barang-v1";

  let daftarBarang = [];
  let riwayatTransaksi = [];
  let jenisTransaksi = "masuk";
  let penyimpananSiap = true;

  function angka(nilai) {
    return Number(nilai).toLocaleString("id-ID", {
      maximumFractionDigits: 3
    });
  }

  function tanggalHariIni() {
    const waktu = new Date();
    const tahun = waktu.getFullYear();
    const bulan = String(waktu.getMonth() + 1).padStart(2, "0");
    const tanggal = String(waktu.getDate()).padStart(2, "0");

    return tahun + "-" + bulan + "-" + tanggal;
  }

  function teksTerisi(nilai) {
    return typeof nilai === "string" && nilai.trim() !== "";
  }

  function tanggalValid(nilai) {
    if (
      typeof nilai !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(nilai)
    ) {
      return false;
    }

    const waktu = new Date(nilai + "T00:00:00Z");

    return (
      Number.isFinite(waktu.getTime()) &&
      waktu.toISOString().slice(0, 10) === nilai
    );
  }

  // Memeriksa data sebelum dibaca atau dipulihkan.
  function validasiData(barang, riwayat) {
    if (!Array.isArray(barang) || !Array.isArray(riwayat)) {
      throw new Error("Format data tidak sesuai.");
    }

    const kodeTerdaftar = new Set();

    for (const item of barang) {
      if (
        !item ||
        !teksTerisi(item.kode) ||
        !teksTerisi(item.nama) ||
        !teksTerisi(item.satuan) ||
        !Number.isFinite(item.stok) ||
        item.stok < 0
      ) {
        throw new Error("Ada data barang yang tidak valid.");
      }

      const kode = item.kode.trim().toLowerCase();

      if (kodeTerdaftar.has(kode)) {
        throw new Error("Kode barang ganda: " + item.kode);
      }

      kodeTerdaftar.add(kode);
    }

    for (const transaksi of riwayat) {
      if (
        !transaksi ||
        !teksTerisi(transaksi.kode) ||
        !teksTerisi(transaksi.nama) ||
        !teksTerisi(transaksi.satuan) ||
        !tanggalValid(transaksi.tanggal) ||
        !["masuk", "keluar"].includes(transaksi.jenis) ||
        !Number.isFinite(transaksi.jumlah) ||
        transaksi.jumlah <= 0 ||
        typeof transaksi.keterangan !== "string"
      ) {
        throw new Error("Ada riwayat transaksi yang tidak valid.");
      }

      if (
        !kodeTerdaftar.has(transaksi.kode.trim().toLowerCase())
      ) {
        throw new Error(
          "Barang pada riwayat tidak ditemukan: " + transaksi.kode
        );
      }
    }
  }

  // Membaca data yang sudah tersimpan.
  try {
    const teks = localStorage.getItem(KUNCI_DATA);

    if (teks !== null) {
      const data = JSON.parse(teks);

      const barang = Array.isArray(data) ? data : data?.barang;
      const riwayat = Array.isArray(data) ? [] : data?.riwayat;

      validasiData(barang, riwayat);

      daftarBarang = barang;
      riwayatTransaksi = riwayat;
    }
  } catch (error) {
    penyimpananSiap = false;

    alert(
      "Data lama gagal dibaca: " + error.message +
      "\nJangan hapus data browser. Kirim pesan ini untuk diperiksa."
    );

    return;
  }

  function simpanData(barangBaru, riwayatBaru = riwayatTransaksi) {
    if (!penyimpananSiap) {
      throw new Error("Penyimpanan belum siap.");
    }

    const gabungan = {
      barang: barangBaru,
      riwayat: riwayatBaru
    };

    // Ubah data di memori hanya setelah penyimpanan berhasil.
    localStorage.setItem(KUNCI_DATA, JSON.stringify(gabungan));

    daftarBarang = barangBaru;
    riwayatTransaksi = riwayatBaru;
  }

  function barisKosong(tabel, jumlahKolom, pesan) {
    const baris = tabel.insertRow();
    const kolom = baris.insertCell();

    kolom.colSpan = jumlahKolom;
    kolom.textContent = pesan;
  }

  // TAMPILAN STOK
  function tampilkanBarang() {
    const tabel = ambil("daftar-stok");
    const kata = ambil("cari-barang").value.trim().toLowerCase();

    const hasil = daftarBarang.filter(function (barang) {
      return (
        barang.kode.toLowerCase().includes(kata) ||
        barang.nama.toLowerCase().includes(kata)
      );
    });

    tabel.replaceChildren();

    ambil("jumlah-barang").textContent =
      hasil.length + " dari " + daftarBarang.length +
      " jenis barang ditampilkan.";

    if (hasil.length === 0) {
      barisKosong(
        tabel,
        4,
        kata ? "Barang tidak ditemukan." : "Belum ada barang."
      );
      return;
    }

    hasil.forEach(function (barang) {
      const baris = tabel.insertRow();

      [
        barang.kode,
        barang.nama,
        barang.satuan,
        angka(barang.stok)
      ].forEach(function (isi, index) {
        const kolom = baris.insertCell();
        kolom.textContent = isi;

        if (index === 3) kolom.className = "angka";
      });
    });
  }

  function perbaruiInfoStok() {
    const barang = daftarBarang.find(function (item) {
      return item.kode === ambil("pilih-barang").value;
    });

    ambil("info-stok").textContent = barang
      ? "Stok saat ini: " + angka(barang.stok) + " " + barang.satuan
      : "Pilih barang untuk melihat stok.";
  }

  function perbaruiPilihanBarang() {
    const pilihan = ambil("pilih-barang");
    const kodeLama = pilihan.value;

    pilihan.replaceChildren();
    pilihan.add(new Option("-- Pilih barang --", ""));

    daftarBarang.forEach(function (barang) {
      pilihan.add(
        new Option(barang.kode + " — " + barang.nama, barang.kode)
      );
    });

    if (daftarBarang.some((barang) => barang.kode === kodeLama)) {
      pilihan.value = kodeLama;
    }

    perbaruiInfoStok();
  }

  // FILTER RIWAYAT
  function rentangTanggalSalah() {
    const dari = ambil("filter-dari").value;
    const sampai = ambil("filter-sampai").value;

    return Boolean(dari && sampai && dari > sampai);
  }

  function urutkanRiwayat(data) {
    return [...data].reverse().sort(function (a, b) {
      return b.tanggal.localeCompare(a.tanggal);
    });
  }

  function ambilRiwayatTerfilter() {
    if (rentangTanggalSalah()) return [];

    const dari = ambil("filter-dari").value;
    const sampai = ambil("filter-sampai").value;
    const kata = ambil("filter-barang").value.trim().toLowerCase();
    const jenis = ambil("filter-jenis").value;

    const hasil = riwayatTransaksi.filter(function (transaksi) {
      const cocokTanggal =
        (!dari || transaksi.tanggal >= dari) &&
        (!sampai || transaksi.tanggal <= sampai);

      const cocokBarang =
        transaksi.kode.toLowerCase().includes(kata) ||
        transaksi.nama.toLowerCase().includes(kata);

      const cocokJenis = !jenis || transaksi.jenis === jenis;

      return cocokTanggal && cocokBarang && cocokJenis;
    });

    return urutkanRiwayat(hasil);
  }

  function tampilkanRiwayat() {
    const tabel = ambil("daftar-riwayat");
    const hasil = ambilRiwayatTerfilter();

    tabel.replaceChildren();

    ambil("jumlah-riwayat").textContent = rentangTanggalSalah()
      ? "Tanggal awal tidak boleh melewati tanggal akhir."
      : hasil.length + " dari " + riwayatTransaksi.length +
        " transaksi ditampilkan.";

    if (hasil.length === 0) {
      barisKosong(
        tabel,
        6,
        rentangTanggalSalah()
          ? "Perbaiki rentang tanggal."
          : "Tidak ada transaksi yang sesuai."
      );
      return;
    }

    hasil.forEach(function (transaksi) {
      const baris = tabel.insertRow();

      const isi = [
        transaksi.tanggal,
        transaksi.kode + " — " + transaksi.nama,
        transaksi.jenis === "masuk" ? "Masuk" : "Keluar",
        angka(transaksi.jumlah),
        transaksi.satuan,
        transaksi.keterangan || "-"
      ];

      isi.forEach(function (nilai, index) {
        const kolom = baris.insertCell();

        if (index === 2) {
          const label = document.createElement("span");
          label.className = "jenis-" + transaksi.jenis;
          label.textContent = nilai;
          kolom.appendChild(label);
        } else {
          kolom.textContent = nilai;
        }

        if (index === 3) kolom.className = "angka";
      });
    });
  }

  function perbaruiTampilan() {
    tampilkanBarang();
    perbaruiPilihanBarang();
    tampilkanRiwayat();
  }

  // PERPINDAHAN MENU
  function bukaMenu(menu) {
    ambil("bagian-stok").hidden = menu !== "stok";
    ambil("bagian-riwayat").hidden = menu !== "riwayat";

    const transaksiAktif = menu === "masuk" || menu === "keluar";
    ambil("bagian-transaksi").hidden = !transaksiAktif;

    ["stok", "masuk", "keluar", "riwayat"].forEach(function (nama) {
      const tombol = ambil("menu-" + nama);
      const aktif = nama === menu;

      tombol.classList.toggle("aktif", aktif);

      if (aktif) {
        tombol.setAttribute("aria-current", "page");
      } else {
        tombol.removeAttribute("aria-current");
      }
    });

    if (transaksiAktif) {
      jenisTransaksi = menu;

      ambil("judul-transaksi").textContent =
        menu === "masuk" ? "Barang Masuk" : "Barang Keluar";

      ambil("form-transaksi").reset();
      ambil("tanggal-transaksi").value = tanggalHariIni();
      ambil("pesan-transaksi").textContent = "";
      perbaruiPilihanBarang();
    }

    if (menu === "stok") tampilkanBarang();
    if (menu === "riwayat") tampilkanRiwayat();

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  ["stok", "masuk", "keluar", "riwayat"].forEach(function (menu) {
    ambil("menu-" + menu).addEventListener("click", function () {
      bukaMenu(menu);
    });
  });

  ambil("cari-barang").addEventListener("input", tampilkanBarang);
  ambil("pilih-barang").addEventListener("change", perbaruiInfoStok);

  [
    "filter-dari",
    "filter-sampai",
    "filter-barang",
    "filter-jenis"
  ].forEach(function (id) {
    ambil(id).addEventListener("input", tampilkanRiwayat);
  });

  ambil("reset-filter").addEventListener("click", function () {
    [
      "filter-dari",
      "filter-sampai",
      "filter-barang",
      "filter-jenis"
    ].forEach(function (id) {
      ambil(id).value = "";
    });

    tampilkanRiwayat();
  });

  // TAMBAH BARANG
  ambil("form-barang").addEventListener("submit", function (event) {
    event.preventDefault();

    const pesan = ambil("pesan-barang");
    const kode = ambil("kode-barang").value.trim();
    const nama = ambil("nama-barang").value.trim();
    const satuan = ambil("satuan-barang").value.trim().toUpperCase();
    const nilaiStok = ambil("stok-awal").value;
    const stok = Number(nilaiStok);

    if (!kode || !nama || !satuan) {
      pesan.textContent = "Kode, nama, dan satuan wajib diisi.";
      return;
    }

    if (nilaiStok === "" || !Number.isFinite(stok) || stok < 0) {
      pesan.textContent = "Stok awal harus berupa angka minimal nol.";
      return;
    }

    const sudahAda = daftarBarang.some(function (barang) {
      return barang.kode.toLowerCase() === kode.toLowerCase();
    });

    if (sudahAda) {
      pesan.textContent = "Kode barang sudah terdaftar.";
      return;
    }

    try {
      simpanData([...daftarBarang, { kode, nama, satuan, stok }]);
    } catch (error) {
      pesan.textContent = "Gagal menyimpan. Data belum ditambahkan.";
      console.error(error);
      return;
    }

    ambil("cari-barang").value = "";
    ambil("form-barang").reset();
    perbaruiTampilan();

    pesan.textContent = nama + " berhasil ditambahkan.";
  });

  // SIMPAN TRANSAKSI
  ambil("form-transaksi").addEventListener("submit", function (event) {
    event.preventDefault();

    const pesan = ambil("pesan-transaksi");
    const kode = ambil("pilih-barang").value;
    const barang = daftarBarang.find((item) => item.kode === kode);
    const tanggal = ambil("tanggal-transaksi").value;
    const jumlah = Number(ambil("jumlah-transaksi").value);
    const keterangan = ambil("keterangan-transaksi").value.trim();

    if (!barang) {
      pesan.textContent = "Pilih barang terlebih dahulu.";
      return;
    }

    if (!tanggalValid(tanggal)) {
      pesan.textContent = "Tanggal transaksi tidak valid.";
      return;
    }

    if (!Number.isFinite(jumlah) || jumlah <= 0) {
      pesan.textContent = "Jumlah harus lebih besar dari nol.";
      return;
    }

    if (jenisTransaksi === "keluar" && jumlah > barang.stok) {
      pesan.textContent = "Stok tidak cukup.";
      return;
    }

    const perubahan = jenisTransaksi === "masuk" ? jumlah : -jumlah;
    const stokBaru = Math.round((barang.stok + perubahan) * 1000) / 1000;

    if (!Number.isFinite(stokBaru) || stokBaru < 0) {
      pesan.textContent = "Hasil stok tidak valid.";
      return;
    }

    const dataBaru = daftarBarang.map(function (item) {
      return item.kode === kode ? { ...item, stok: stokBaru } : item;
    });

    const catatan = {
      tanggal,
      kode: barang.kode,
      nama: barang.nama,
      jenis: jenisTransaksi,
      jumlah,
      satuan: barang.satuan,
      keterangan
    };

    try {
      simpanData(dataBaru, [...riwayatTransaksi, catatan]);
    } catch (error) {
      pesan.textContent = "Gagal menyimpan. Stok belum berubah.";
      console.error(error);
      return;
    }

    ambil("jumlah-transaksi").value = "";
    ambil("keterangan-transaksi").value = "";
    perbaruiTampilan();

    pesan.textContent =
      "Tersimpan. Stok " + barang.nama + " sekarang " +
      angka(stokBaru) + " " + barang.satuan + ".";
  });

  // EKSPOR EXCEL
  function pastikanExcel() {
    if (typeof XLSX === "undefined") {
      throw new Error(
        "Pustaka Excel belum terbaca. Periksa xlsx.full.min.js."
      );
    }
  }

  function eksporExcel(pakaiFilter) {
    try {
      pastikanExcel();

      if (pakaiFilter && rentangTanggalSalah()) {
        throw new Error("Perbaiki rentang tanggal terlebih dahulu.");
      }

      const riwayat = pakaiFilter
        ? ambilRiwayatTerfilter()
        : urutkanRiwayat(riwayatTransaksi);

      const dataStok = [
        ["Kode / Barcode", "Nama Barang", "Satuan", "Stok"],
        ...daftarBarang.map(function (barang) {
          return [
            String(barang.kode),
            barang.nama,
            barang.satuan,
            barang.stok
          ];
        })
      ];

      const dataRiwayat = [
        [
          "Tanggal",
          "Kode / Barcode",
          "Nama Barang",
          "Jenis Transaksi",
          "Jumlah",
          "Satuan",
          "Keterangan"
        ],
        ...riwayat.map(function (transaksi) {
          return [
            transaksi.tanggal,
            String(transaksi.kode),
            transaksi.nama,
            transaksi.jenis === "masuk" ? "Masuk" : "Keluar",
            transaksi.jumlah,
            transaksi.satuan,
            transaksi.keterangan
          ];
        })
      ];

      const stokSheet = XLSX.utils.aoa_to_sheet(dataStok);
      const riwayatSheet = XLSX.utils.aoa_to_sheet(dataRiwayat);

      stokSheet["!cols"] = [
        { wch: 24 }, { wch: 35 }, { wch: 12 }, { wch: 15 }
      ];

      riwayatSheet["!cols"] = [
        { wch: 15 }, { wch: 24 }, { wch: 35 }, { wch: 18 },
        { wch: 15 }, { wch: 12 }, { wch: 45 }
      ];

      stokSheet["!autofilter"] = { ref: stokSheet["!ref"] };
      riwayatSheet["!autofilter"] = { ref: riwayatSheet["!ref"] };

      const buku = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(buku, stokSheet, "Stok Barang");
      XLSX.utils.book_append_sheet(buku, riwayatSheet, "Riwayat");

      const penanda = pakaiFilter ? "-Filter-" : "-Semua-";

      XLSX.writeFile(
        buku,
        "DAMAR" + penanda + tanggalHariIni() + ".xlsx"
      );
    } catch (error) {
      console.error(error);
      alert("Ekspor gagal: " + error.message);
    }
  }

  ambil("unduh-excel").addEventListener("click", function () {
    eksporExcel(false);
  });

  ambil("excel-riwayat").addEventListener("click", function () {
    eksporExcel(true);
  });

  // TEMPLATE MASTER
  ambil("template-master").addEventListener("click", function () {
    try {
      pastikanExcel();

      const sheet = XLSX.utils.aoa_to_sheet([
        ["Kode / Barcode", "Nama Barang", "Satuan", "Stok Awal"]
      ]);

      sheet["!cols"] = [
        { wch: 24 }, { wch: 35 }, { wch: 15 }, { wch: 15 }
      ];

      const buku = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(buku, sheet, "Master Barang");
      XLSX.writeFile(buku, "Template-Master-DAMAR.xlsx");
    } catch (error) {
      alert(error.message);
    }
  });

  // IMPOR MASTER
  ambil("file-master").addEventListener("change", async function (event) {
    const input = event.target;
    const file = input.files[0];
    const pesan = ambil("pesan-impor");

    if (!file) return;

    input.disabled = true;
    pesan.textContent = "Membaca Excel...";

    try {
      pastikanExcel();

      if (file.size > 10 * 1024 * 1024) {
        throw new Error("Ukuran file maksimal 10 MB.");
      }

      const buku = XLSX.read(await file.arrayBuffer(), {
        type: "array"
      });

      const namaSheet = buku.SheetNames[0];

      if (!namaSheet) throw new Error("File tidak memiliki sheet.");

      const barisExcel = XLSX.utils.sheet_to_json(
        buku.Sheets[namaSheet],
        {
          header: 1,
          defval: "",
          raw: true,
          blankrows: true
        }
      );

      if (!barisExcel.length) throw new Error("Sheet pertama kosong.");

      const header = barisExcel[0].map(function (isi) {
        return String(isi).trim().toLowerCase();
      });

      const posisi = [
        "kode / barcode", "nama barang", "satuan", "stok awal"
      ].map((judul) => header.indexOf(judul));

      if (posisi.includes(-1)) {
        throw new Error("Judul kolom tidak sesuai. Gunakan template.");
      }

      const kodeTerpakai = new Set(
        daftarBarang.map((barang) => barang.kode.toLowerCase())
      );

      const tambahan = [];
      let dilewati = 0;

      for (let i = 1; i < barisExcel.length; i++) {
        const baris = barisExcel[i] || [];

        if (baris.every((isi) => String(isi).trim() === "")) {
          continue;
        }

        const kode = String(baris[posisi[0]] ?? "").trim();
        const nama = String(baris[posisi[1]] ?? "").trim();
        const satuan = String(baris[posisi[2]] ?? "").trim().toUpperCase();
        const isiStok = baris[posisi[3]];
        const stok = isiStok === "" || isiStok == null ? 0 : isiStok;

        if (!kode) {
          throw new Error("Kode kosong pada baris " + (i + 1) + ".");
        }

        if (kodeTerpakai.has(kode.toLowerCase())) {
          dilewati++;
          continue;
        }

        if (!nama || !satuan) {
          throw new Error(
            "Nama atau satuan kosong pada baris " + (i + 1) + "."
          );
        }

        if (
          typeof stok !== "number" ||
          !Number.isFinite(stok) ||
          stok < 0
        ) {
          throw new Error(
            "Stok baris " + (i + 1) + " harus angka Excel minimal nol."
          );
        }

        tambahan.push({ kode, nama, satuan, stok });
        kodeTerpakai.add(kode.toLowerCase());
      }

      if (!tambahan.length) {
        pesan.textContent =
          "Tidak ada barang baru. " + dilewati + " kode dilewati.";
        return;
      }

      simpanData([...daftarBarang, ...tambahan]);
      ambil("cari-barang").value = "";
      perbaruiTampilan();

      pesan.textContent =
        "Berhasil! " + tambahan.length + " barang ditambahkan. " +
        dilewati + " kode dilewati.";
    } catch (error) {
      pesan.textContent = "Impor gagal: " + error.message;
      console.error(error);
    } finally {
      input.disabled = false;
      input.value = "";
    }
  });

  // ==========================================
  // IMPORT TRANSAKSI MASSAL DARI EXCEL
  // ==========================================

  let dataImporTransaksi = [];

  function tanggalDariExcel(nilai) {
    if (nilai instanceof Date && !isNaN(nilai)) {
      return [
        nilai.getFullYear(),
        String(nilai.getMonth() + 1).padStart(2, "0"),
        String(nilai.getDate()).padStart(2, "0")
      ].join("-");
    }

    if (typeof nilai === "number") {
      const t = XLSX.SSF.parse_date_code(nilai);
      if (!t) return "";
      return [
        t.y,
        String(t.m).padStart(2, "0"),
        String(t.d).padStart(2, "0")
      ].join("-");
    }

    const teks = String(nilai ?? "").trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(teks)) {
      return tanggalValid(teks) ? teks : "";
    }

    const cocok = teks.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);

    if (cocok) {
      const tanggal =
        cocok[3] + "-" +
        cocok[2].padStart(2, "0") + "-" +
        cocok[1].padStart(2, "0");

      return tanggalValid(tanggal) ? tanggal : "";
    }

    return "";
  }

  function bersihkanPreviewImpor() {
    dataImporTransaksi = [];
    ambil("daftar-pratinjau-impor").replaceChildren();
    ambil("pratinjau-impor").hidden = true;
    ambil("proses-impor-transaksi").disabled = true;
    ambil("file-transaksi").value = "";
  }

  // DOWNLOAD TEMPLATE
  ambil("template-transaksi").addEventListener("click", function () {
    try {
      pastikanExcel();

      const sheet = XLSX.utils.aoa_to_sheet([
        ["Tanggal", "Kode / Barcode", "Jumlah", "Keterangan"],
        ["2026-11-12", "BRG001", 10, "Pembelian supplier"],
        ["2026-11-12", "BRG002", 5, "Nomor dokumen 001"]
      ]);

      sheet["!cols"] = [
        { wch: 18 },
        { wch: 24 },
        { wch: 15 },
        { wch: 35 }
      ];

      const buku = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(buku, sheet, "Transaksi");

      XLSX.writeFile(
        buku,
        "Template-Transaksi-DAMAR.xlsx"
      );
    } catch (error) {
      alert("Gagal membuat template: " + error.message);
    }
  });

  // BACA FILE EXCEL DAN TAMPILKAN PREVIEW
  ambil("file-transaksi").addEventListener(
    "change",
    async function (event) {
      const input = event.target;
      const file = input.files[0];
      const pesan = ambil("pesan-impor-transaksi");

      bersihkanPreviewImpor();

      if (!file) return;

      input.disabled = true;
      pesan.textContent = "Memeriksa file Excel...";

      try {
        pastikanExcel();

        if (file.size > 10 * 1024 * 1024) {
          throw new Error("Ukuran file maksimal 10 MB.");
        }

        const buku = XLSX.read(await file.arrayBuffer(), {
          type: "array",
          cellDates: true
        });

        const namaSheet = buku.SheetNames[0];

        if (!namaSheet) {
          throw new Error("Sheet Excel tidak ditemukan.");
        }

        const baris = XLSX.utils.sheet_to_json(
          buku.Sheets[namaSheet],
          {
            header: 1,
            defval: "",
            raw: true,
            blankrows: false
          }
        );

        if (baris.length < 2) {
          throw new Error("Tidak ada transaksi di dalam Excel.");
        }

        if (baris.length - 1 > 5000) {
          throw new Error("Maksimal 5.000 transaksi sekali impor.");
        }

        const header = baris[0].map(x =>
          String(x).trim().toLowerCase()
        );

        const kolom = [
          "tanggal",
          "kode / barcode",
          "jumlah",
          "keterangan"
        ].map(x => header.indexOf(x));

        if (kolom.some(x => x < 0)) {
          throw new Error(
            "Judul kolom tidak sesuai. Silakan unduh template."
          );
        }

        const hasil = [];

        for (let i = 1; i < baris.length; i++) {
          const row = baris[i];

          const tanggal = tanggalDariExcel(row[kolom[0]]);
          const kode = String(row[kolom[1]] ?? "").trim();
          const jumlah = Number(row[kolom[2]]);
          const keterangan = String(row[kolom[3]] ?? "").trim();

          if (!tanggal || !kode || !Number.isFinite(jumlah) || jumlah <= 0) {
            hasil.push({
              baris: i + 1,
              tanggal: tanggal || "-",
              kode: kode || "-",
              nama: "-",
              jumlah: Number.isFinite(jumlah) ? jumlah : 0,
              keterangan,
              valid: false,
              status: "Data tidak valid"
            });
            continue;
          }

          const barang = daftarBarang.find(
            x => x.kode.toLowerCase() === kode.toLowerCase()
          );

          if (!barang) {
            hasil.push({
              baris: i + 1,
              tanggal,
              kode,
              nama: "-",
              jumlah,
              keterangan,
              valid: false,
              status: "Kode barang tidak ditemukan"
            });
            continue;
          }

          hasil.push({
            baris: i + 1,
            tanggal,
            kode: barang.kode,
            nama: barang.nama,
            jumlah,
            satuan: barang.satuan,
            keterangan,
            valid: true,
            status: "Siap diimpor"
          });
        }

        // Periksa total barang keluar agar stok tidak minus.
        if (jenisTransaksi === "keluar") {
          const totalKeluar = {};

          hasil.forEach(x => {
            if (x.valid) {
              totalKeluar[x.kode] =
                (totalKeluar[x.kode] || 0) + x.jumlah;
            }
          });

          hasil.forEach(x => {
            if (
              x.valid &&
              totalKeluar[x.kode] >
                daftarBarang.find(b => b.kode === x.kode).stok
            ) {
              x.valid = false;
              x.status = "Total keluar melebihi stok";
            }
          });
        }

        dataImporTransaksi = hasil;

        const tabel = ambil("daftar-pratinjau-impor");
        tabel.replaceChildren();

        hasil.forEach(x => {
          const tr = tabel.insertRow();

          [
            x.baris,
            x.tanggal,
            x.kode,
            x.nama,
            angka(x.jumlah),
            x.keterangan || "-",
            x.status
          ].forEach((nilai, index) => {
            const td = tr.insertCell();
            td.textContent = nilai;

            if (index === 4) td.className = "angka";
          });
        });

        const berhasil = hasil.filter(x => x.valid).length;
        const gagal = hasil.length - berhasil;

        ambil("ringkasan-impor").textContent =
          hasil.length + " transaksi dibaca. " +
          berhasil + " valid, " + gagal + " bermasalah.";

        ambil("pratinjau-impor").hidden = false;
        ambil("proses-impor-transaksi").disabled =
          gagal > 0 || berhasil === 0;

        pesan.textContent = gagal > 0
          ? "Perbaiki baris yang bermasalah di Excel, lalu unggah kembali."
          : "Semua transaksi valid dan siap disimpan.";

      } catch (error) {
        pesan.textContent = "Impor gagal: " + error.message;
        console.error(error);
        bersihkanPreviewImpor();
      } finally {
        input.disabled = false;
      }
    }
  );

  // SIMPAN SEMUA TRANSAKSI SEKALIGUS
  ambil("proses-impor-transaksi").addEventListener(
    "click",
    function () {
      const pesan = ambil("pesan-impor-transaksi");

      if (
        dataImporTransaksi.length === 0 ||
        dataImporTransaksi.some(x => !x.valid)
      ) {
        pesan.textContent = "Periksa kembali data Excel.";
        return;
      }

      try {
        const perubahanStok = {};

        dataImporTransaksi.forEach(x => {
          const perubahan =
            jenisTransaksi === "masuk" ? x.jumlah : -x.jumlah;

          perubahanStok[x.kode] =
            (perubahanStok[x.kode] || 0) + perubahan;
        });

        const barangBaru = daftarBarang.map(barang => {
          const perubahan = perubahanStok[barang.kode] || 0;

          return {
            ...barang,
            stok: Math.round(
              (barang.stok + perubahan) * 1000
            ) / 1000
          };
        });

        const riwayatBaru = [
          ...riwayatTransaksi,
          ...dataImporTransaksi.map(x => ({
            tanggal: x.tanggal,
            kode: x.kode,
            nama: x.nama,
            jenis: jenisTransaksi,
            jumlah: x.jumlah,
            satuan: x.satuan,
            keterangan: x.keterangan
          }))
        ];

        // Simpan seluruh transaksi dalam satu proses.
        simpanData(barangBaru, riwayatBaru);

        const jumlahBerhasil = dataImporTransaksi.length;

        bersihkanPreviewImpor();
        perbaruiTampilan();

        pesan.textContent =
          "Berhasil mengimpor " + jumlahBerhasil +
          " transaksi " +
          (jenisTransaksi === "masuk" ? "masuk." : "keluar.");

      } catch (error) {
        pesan.textContent =
          "Gagal menyimpan transaksi: " + error.message;
        console.error(error);
      }
    }
  );

  // BATAL IMPORT
  ambil("batal-impor-transaksi").addEventListener(
    "click",
    function () {
      bersihkanPreviewImpor();
      ambil("pesan-impor-transaksi").textContent =
        "Impor dibatalkan.";
    }
  );


  // CADANGKAN DATA
  ambil("cadangkan-data").addEventListener("click", function () {
    const sekarang = new Date();

    const cadangan = {
      // Identitas ini dipertahankan agar cadangan lama tetap cocok.
      aplikasi: "Damar Stok",
      versi: 1,
      dibuatPada: sekarang.toISOString(),
      barang: daftarBarang,
      riwayat: riwayatTransaksi
    };

    const file = new Blob(
      [JSON.stringify(cadangan, null, 2)],
      { type: "application/json" }
    );

    const alamat = URL.createObjectURL(file);
    const tautan = document.createElement("a");

    const jam = String(sekarang.getHours()).padStart(2, "0");
    const menit = String(sekarang.getMinutes()).padStart(2, "0");
    const detik = String(sekarang.getSeconds()).padStart(2, "0");

    tautan.href = alamat;
    tautan.download =
      "Cadangan-DAMAR-" + tanggalHariIni() +
      "-" + jam + menit + detik + ".json";

    document.body.appendChild(tautan);
    tautan.click();
    tautan.remove();

    setTimeout(function () {
      URL.revokeObjectURL(alamat);
    }, 1000);
  });

  // PULIHKAN DATA
  ambil("file-cadangan").addEventListener("change", async function (event) {
    const input = event.target;
    const file = input.files[0];
    const pesan = ambil("pesan-pemulihan");

    if (!file) return;

    input.disabled = true;
    pesan.textContent = "Memeriksa cadangan...";

    try {
      if (file.size > 20 * 1024 * 1024) {
        throw new Error("Ukuran cadangan maksimal 20 MB.");
      }

      const cadangan = JSON.parse(await file.text());

      if (
        !cadangan ||
        cadangan.aplikasi !== "Damar Stok" ||
        cadangan.versi !== 1
      ) {
        throw new Error("Bukan cadangan aplikasi yang sesuai.");
      }

      validasiData(cadangan.barang, cadangan.riwayat);

      const lanjut = confirm(
        "Cadangan berisi " + cadangan.barang.length + " barang dan " +
        cadangan.riwayat.length + " transaksi.\n\n" +
        "Seluruh data saat ini akan DIGANTI.\n" +
        "Pastikan sudah menyimpan cadangan terbaru.\n\nLanjutkan?"
      );

      if (!lanjut) {
        pesan.textContent = "Dibatalkan. Data tidak berubah.";
        return;
      }

      simpanData(cadangan.barang, cadangan.riwayat);
    } catch (error) {
      pesan.textContent =
        "Pemulihan gagal. Data tidak diganti. " + error.message;
      console.error(error);
      return;
    } finally {
      input.disabled = false;
      input.value = "";
    }

    alert("Data berhasil dipulihkan.");
    window.location.reload();
  });

  // TAMPILAN AWAL
  perbaruiTampilan();
  bukaMenu("stok");
});