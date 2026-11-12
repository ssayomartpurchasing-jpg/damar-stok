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

  // Data lama tetap berada di browser dan tidak dimigrasikan otomatis.
  let sedangMenyimpan = false;
  let permintaanTertunda = null;
  async function api(body) {
    const response = await fetch('/api/inventory', {
      method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
      headers: body ? {'Content-Type':'application/json'} : {},
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Server menolak permintaan.');
    return data;
  }
  function terapkan(data) {
    daftarBarang = data.barang; riwayatTransaksi = data.riwayat;
    perbaruiTampilan();
  }
  async function simpanServer(body) {
    if (sedangMenyimpan) throw new Error('Permintaan sebelumnya sedang diproses.');
    sedangMenyimpan = true;
    const signature = JSON.stringify(body);
    if (body.manual) {
      if (!permintaanTertunda || permintaanTertunda.signature !== signature)
        permintaanTertunda = {signature, id: crypto.randomUUID()};
      body = {...body, requestId: permintaanTertunda.id};
    }
    ambil('status-server').textContent = 'Menyimpan ke server...';
    try {
      const data = await api(body);
      terapkan(data); permintaanTertunda = null;
      ambil('status-server').textContent = 'Data telah tersimpan di server.';
    } catch(error) {
      ambil('status-server').textContent = 'Belum ada konfirmasi penyimpanan. ' + error.message + ' Muat ulang data sebelum mencoba kembali.';
      throw error;
    } finally {sedangMenyimpan = false;}
  }
  async function muatServer() {
    try {
      terapkan(await api());
      document.querySelector('main').hidden = false;
      document.querySelector('nav').hidden = false;
      ambil('status-server').textContent = 'Terhubung ke database.';
    } catch(error) {
      document.querySelector('main').hidden = true;
      document.querySelector('nav').hidden = true;
      ambil('status-server').textContent = error.message;
    }
  }
  ambil('muat-server').onclick = muatServer;
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
      bersihkanPreviewImpor();
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
  ambil("form-barang").addEventListener("submit", async function (event) {
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
      await simpanServer({mode:"items", manual:true, barang:[{kode,nama,satuan,stok}]});
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
  ambil("form-transaksi").addEventListener("submit", async function (event) {
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
      await simpanServer({mode:"transactions", manual:true, riwayat:[catatan]});
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
      angka(daftarBarang.find(x=>x.kode===kode).stok) + " " + barang.satuan + ".";
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

  // Excel: judul di baris pertama, empat kolom di baris kedua.
  let dataImporTransaksi = [];
  let imporDisiapkan = null;
  function bersihkanPreviewImpor() {
    dataImporTransaksi = []; imporDisiapkan = null;
    ambil('pratinjau-impor').hidden = true;
    ambil('proses-impor-transaksi').disabled = true;
  }
  function template(id,nama) {
    ambil(id).onclick=()=>{
      const sheet=XLSX.utils.aoa_to_sheet([[nama],['BARCODE','NAMA ITEM','QTY','SATUAN'],['001234','Contoh barang',1,'PCS']]);
      sheet['!cols']=[{wch:24},{wch:35},{wch:16},{wch:16}];
      const book=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book,sheet,'Data');
      XLSX.writeFile(book,'Template-'+nama+'.xlsx');
    };
  }
  template('template-master','Master DAMAR'); template('template-transaksi','Transaksi DAMAR');
  async function bacaExcel(file,master) {
    if(file.size>10*1024*1024) throw new Error('File maksimal 10 MB.');
    const book=XLSX.read(await file.arrayBuffer(),{type:'array'});
    const sheet=book.Sheets[book.SheetNames[0]];
    const rows=XLSX.utils.sheet_to_json(sheet,{header:1,raw:true,defval:'',blankrows:true});
    if(!rows[0]?.some(x=>String(x).trim())) throw new Error('Judul baris pertama wajib diisi.');
    const headers=(rows[1]||[]).map(x=>String(x).trim().toUpperCase());
    const cols=['BARCODE','NAMA ITEM','QTY','SATUAN'].map(x=>headers.indexOf(x));
    if(cols.includes(-1)) throw new Error('Baris kedua harus BARCODE, NAMA ITEM, QTY, SATUAN.');
    const hasil=[];
    for(let i=2;i<rows.length;i++) {
      const row=rows[i]; if(row.every(x=>String(x).trim()==='')) continue;
      const cell=sheet[XLSX.utils.encode_cell({r:i,c:cols[0]})];
      const kode=String(cell?.w ?? cell?.v ?? '').trim();
      const nama=String(row[cols[1]]).trim(); const jumlah=row[cols[2]];
      const satuan=String(row[cols[3]]).trim();
      const barang=daftarBarang.find(x=>x.kode.toLowerCase()===kode.toLowerCase());
      if(!kode||!nama||!satuan||typeof jumlah!=='number'||!Number.isFinite(jumlah)||jumlah<(master?0:.001)) throw new Error('Baris '+(i+1)+': barcode, nama, QTY atau satuan tidak valid.');
      if(!master && !barang) throw new Error('Baris '+(i+1)+': barcode tidak ditemukan: '+kode);
      if(!master && barang.satuan.toLowerCase()!==satuan.toLowerCase()) throw new Error('Baris '+(i+1)+': satuan berbeda dengan master.');
      hasil.push(master?{kode,nama,satuan,stok:jumlah}:{kode:barang.kode,nama:barang.nama,satuan:barang.satuan,jumlah,tanggal:ambil('tanggal-transaksi').value,jenis:jenisTransaksi,keterangan:'Impor Excel'});
    }
    if(!hasil.length) throw new Error('Tidak ada baris data.');
    return master?{mode:'items',barang:hasil}:{mode:'transactions',riwayat:hasil};
  }
  function tampilPreview(target,body) {
    target.replaceChildren();
    const rows=body.barang||body.riwayat;
    for(const x of rows) {
      const tr=target.insertRow();
      for(const v of [x.kode,x.nama,x.stok??x.jumlah,x.satuan]) tr.insertCell().textContent=v;
    }
  }
  for(const master of [true,false]) {
    const input=ambil(master?'file-master':'file-transaksi');
    const pesan=ambil(master?'pesan-impor':'pesan-impor-transaksi');
    input.onchange=async()=>{
      const file=input.files[0]; if(!file)return;
      input.disabled=true; pesan.textContent='Memvalidasi seluruh impor di server...';
      if(master) {ambil('preview-master').hidden=true; masterSiap=null;} else bersihkanPreviewImpor();
      try {
        const body=await bacaExcel(file,master);
        await api({...body,preview:true});
        if(master) {
          masterSiap=body; tampilPreview(ambil('baris-master'),body); ambil('preview-master').hidden=false;
        } else {
          imporDisiapkan=body; dataImporTransaksi=body.riwayat;
          // Existing preview uses seven columns.
          const table=ambil('daftar-pratinjau-impor'); table.replaceChildren();
          body.riwayat.forEach((x,i)=>{const tr=table.insertRow(); [i+3,x.tanggal,x.kode,x.nama,x.jumlah,x.satuan,'Valid'].forEach(v=>tr.insertCell().textContent=v);});
          ambil('pratinjau-impor').hidden=false; ambil('proses-impor-transaksi').disabled=false;
          ambil('ringkasan-impor').textContent=body.riwayat.length+' transaksi valid. Jenis: '+jenisTransaksi;
        }
        pesan.textContent='Seluruh data valid. Periksa pratinjau lalu konfirmasi penyimpanan.';
      } catch(e) {pesan.textContent='Impor belum tersimpan: '+e.message;}
      finally {input.disabled=false;input.value='';}
    };
  }
  let masterSiap=null;
  ambil('proses-master').onclick=async()=>{
    if(!masterSiap)return;
    try {await simpanServer(masterSiap); masterSiap=null; ambil('preview-master').hidden=true; ambil('pesan-impor').textContent='Master tersimpan.';}
    catch(e){ambil('pesan-impor').textContent='Belum tersimpan: '+e.message;}
  };
  ambil('proses-impor-transaksi').onclick=async()=>{
    if(!imporDisiapkan)return;
    try {await simpanServer(imporDisiapkan);bersihkanPreviewImpor();ambil('pesan-impor-transaksi').textContent='Seluruh transaksi tersimpan.';}
    catch(e){ambil('pesan-impor-transaksi').textContent='Belum tersimpan: '+e.message;}
  };
  ambil('batal-impor-transaksi').onclick=bersihkanPreviewImpor;

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

  // Migrasi eksplisit, tanpa mengubah localStorage dan tanpa menimpa database.
  let migrasiSiap=null;
  ambil('file-cadangan').onchange=async event=>{
    migrasiSiap=null; ambil('preview-migrasi').hidden=true;
    const file=event.target.files[0]; if(!file)return;
    try {
      if(file.size>5*1024*1024)throw new Error('Cadangan maksimal 5 MB.');
      const data=JSON.parse(await file.text());
      if(data.aplikasi!=='Damar Stok'||data.versi!==1)throw new Error('Format cadangan tidak sesuai.');
      validasiData(data.barang,data.riwayat);
      const body={mode:'migration',barang:data.barang,riwayat:data.riwayat};
      await api({...body,preview:true}); migrasiSiap=body;
      tampilPreview(ambil('baris-migrasi'),body);
      ambil('ringkasan-migrasi').textContent=data.barang.length+' barang, '+data.riwayat.length+' riwayat. Stok cadangan dipertahankan; riwayat tidak dihitung ulang.';
      ambil('preview-migrasi').hidden=false;
      ambil('pesan-pemulihan').textContent='Pratinjau valid. Konfirmasi untuk mengisi database kosong.';
    } catch(e){ambil('pesan-pemulihan').textContent='Migrasi belum tersimpan: '+e.message;}
    finally {event.target.value='';}
  };
  ambil('konfirmasi-migrasi').onclick=async()=>{
    if(!migrasiSiap || !confirm('Simpan cadangan ini ke database kosong?'))return;
    try {await simpanServer(migrasiSiap);migrasiSiap=null;ambil('preview-migrasi').hidden=true;ambil('pesan-pemulihan').textContent='Migrasi tersimpan di database.';}
    catch(e){ambil('pesan-pemulihan').textContent='Migrasi belum tersimpan: '+e.message;}
  };
  ambil('ekspor-lokal').onclick=()=>{
    const lama=localStorage.getItem(KUNCI_DATA);
    if(!lama){alert('Tidak ada data lama di browser ini.');return;}
    try {
      const data=JSON.parse(lama);const barang=Array.isArray(data)?data:data.barang;const riwayat=Array.isArray(data)?[]:data.riwayat;
      validasiData(barang,riwayat);
      const url=URL.createObjectURL(new Blob([JSON.stringify({aplikasi:'Damar Stok',versi:1,barang,riwayat})],{type:'application/json'}));
      const a=document.createElement('a');a.href=url;a.download='Cadangan-DAMAR-lokal.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    } catch(e){alert('Cadangan lokal tidak dapat dibaca: '+e.message);}
  };
  // TAMPILAN AWAL
  perbaruiTampilan();
  bukaMenu("stok");
  muatServer();
});