import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {readFile} from 'node:fs/promises';
const flush=()=>new Promise(r=>setTimeout(r,20));
async function page(fetch){
 const dom=new JSDOM(await readFile('index.html','utf8'),{url:'https://example.test',runScripts:'outside-only'});
 const w=dom.window;
 w.alert=()=>{};w.confirm=()=>true;w.scrollTo=()=>{};w.console.error=()=>{};
 w.fetch=fetch;
 w.eval(await readFile('xlsx.full.min.js','utf8'));
 w.eval(await readFile('app.js','utf8'));
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 await flush();
 return dom;
}
test('UI manual tidak melaporkan sukses sebelum konfirmasi, gagal koneksi mempertahankan input',async()=>{
 const state={barang:[{kode:'001',nama:'Susu',satuan:'PCS',stok:5}],riwayat:[]};
 let complete;
 const dom=await page(async(_url,opts)=>opts.method==='GET'?{ok:true,json:async()=>state}:new Promise(r=>{complete=r;}));
 const w=dom.window;const d=w.document;
 w.localStorage.setItem('damar-stok-barang-v1','data-lama');
 assert.equal(d.getElementById('form-login'),null);
 assert.equal(d.querySelector('main').hidden,false);
 d.getElementById('menu-keluar').click();
 d.getElementById('pilih-barang').value='001';d.getElementById('jumlah-transaksi').value='2';
 d.getElementById('form-transaksi').dispatchEvent(new w.Event('submit',{cancelable:true}));await flush();
 assert.doesNotMatch(d.getElementById('pesan-transaksi').textContent,/Tersimpan/);
 complete({ok:false,json:async()=>({error:'Koneksi gagal'})});await flush();
 assert.match(d.getElementById('pesan-transaksi').textContent,/Gagal/);
 assert.equal(d.getElementById('jumlah-transaksi').value,'2');
 assert.equal(w.localStorage.getItem('damar-stok-barang-v1'),'data-lama');
 dom.window.close();
});
test('Excel judul baris 1, header baris 2, barcode nol depan dan preview sebelum simpan',async()=>{
 const state={barang:[{kode:'00123',nama:'Susu',satuan:'PCS',stok:10}],riwayat:[]};
 const requests=[];
 const dom=await page(async(_url,opts)=>{
  if(opts.method==='POST')requests.push(JSON.parse(opts.body));
  return {ok:true,json:async()=>state};
 });
 const w=dom.window;const d=w.document;
 d.getElementById('menu-keluar').click();
 const sheet=w.XLSX.utils.aoa_to_sheet([['PENJUALAN'],['BARCODE','NAMA ITEM','QTY','SATUAN'],['00123','Susu',2,'PCS']]);
 const book=w.XLSX.utils.book_new();w.XLSX.utils.book_append_sheet(book,sheet,'Data');
 const bytes=w.XLSX.write(book,{type:'array',bookType:'xlsx'});
 const input=d.getElementById('file-transaksi');
 Object.defineProperty(input,'files',{value:[{size:bytes.byteLength,arrayBuffer:async()=>bytes}]});
 input.dispatchEvent(new w.Event('change'));await flush();
 assert.equal(requests.length,1);assert.equal(requests[0].preview,true);
 assert.equal(requests[0].riwayat[0].kode,'00123');
 assert.equal(d.getElementById('proses-impor-transaksi').disabled,false);
 d.getElementById('proses-impor-transaksi').click();await flush();
 assert.equal(requests.length,2);assert.equal(requests[1].preview,undefined);
 assert.match(d.getElementById('pesan-impor-transaksi').textContent,/tersimpan/);
 dom.window.close();
});

test('Edit memuat master, menunggu server, menampilkan gagal, lalu tersimpan setelah muat ulang',async()=>{
 let state={barang:[{kode:'001',nama:'Lama',satuan:'PCS',stok:0,aktif:true,memiliki_riwayat:false}],riwayat:[]};
 let complete;
 const dom=await page(async(_url,opts)=>opts.method==='GET'?{ok:true,json:async()=>state}:new Promise(r=>{complete=r;}));
 const w=dom.window,d=w.document;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 d.querySelector('.aksi-barang button').click();
 assert.equal(d.getElementById('edit-kode').value,'001');
 assert.equal(d.getElementById('edit-nama').value,'Lama');
 assert.match(d.getElementById('edit-stok').textContent,/informasi saja/);
 d.getElementById('edit-nama').value='Baru';
 d.getElementById('form-edit').dispatchEvent(new w.Event('submit',{cancelable:true}));await flush();
 assert.doesNotMatch(d.getElementById('pesan-aksi').textContent,/berhasil/);
 complete({ok:false,json:async()=>({error:'Barcode sudah terdaftar'})});await flush();
 assert.match(d.getElementById('pesan-edit').textContent,/Barcode sudah terdaftar/);
 assert.equal(d.getElementById('dialog-edit').open,true);
 d.getElementById('form-edit').dispatchEvent(new w.Event('submit',{cancelable:true}));await flush();
 state={...state,barang:[{...state.barang[0],nama:'Baru'}]};
 complete({ok:true,json:async()=>state});await flush();
 assert.match(d.getElementById('pesan-aksi').textContent,/berhasil/);
 d.getElementById('muat-server').click();await flush();
 assert.match(d.getElementById('daftar-stok').textContent,/Baru/);
 dom.window.close();
});

test('filter status, aktifkan kembali, konfirmasi hapus, dan Excel nonaktif ditolak',async()=>{
 const state={barang:[{kode:'00123',nama:'Susu',satuan:'PCS',stok:0,aktif:false,memiliki_riwayat:true},{kode:'EMPTY',nama:'Kosong',satuan:'PCS',stok:0,aktif:true,memiliki_riwayat:false}],riwayat:[]};
 const requests=[];
 const dom=await page(async(_url,opts)=>{if(opts.method==='POST')requests.push(JSON.parse(opts.body));return {ok:true,json:async()=>state};});
 const w=dom.window,d=w.document;
 assert.doesNotMatch(d.getElementById('daftar-stok').textContent,/Susu/);
 let confirmation='';w.confirm=message=>{confirmation=message;return false;};
 [...d.querySelectorAll('.aksi-barang button')].find(b=>b.textContent==='Hapus dari Master').click();
 assert.match(confirmation,/Kosong/);assert.match(confirmation,/EMPTY/);assert.equal(requests.length,0);
 d.getElementById('filter-status').value='nonaktif';d.getElementById('filter-status').dispatchEvent(new w.Event('change'));
 assert.match(d.getElementById('daftar-stok').textContent,/Aktifkan kembali/);
 assert.match(d.getElementById('daftar-stok').textContent,/Hapus dari Master/);
 assert.equal([...d.getElementById('pilih-barang').options].some(x=>x.value==='00123'),false);
 d.getElementById('menu-masuk').click();
 const sheet=w.XLSX.utils.aoa_to_sheet([['MASUK'],['BARCODE','NAMA ITEM','QTY','SATUAN'],['00123','Susu',2,'PCS']]);
 const book=w.XLSX.utils.book_new();w.XLSX.utils.book_append_sheet(book,sheet,'Data');
 const bytes=w.XLSX.write(book,{type:'array',bookType:'xlsx'});
 const input=d.getElementById('file-transaksi');Object.defineProperty(input,'files',{value:[{size:bytes.byteLength,arrayBuffer:async()=>bytes}]});
 input.dispatchEvent(new w.Event('change'));await flush();
 assert.match(d.getElementById('pesan-impor-transaksi').textContent,/nonaktif/);
 assert.equal(d.getElementById('proses-impor-transaksi').disabled,true);assert.equal(requests.length,0);
 dom.window.close();
});

test('hapus master ber-riwayat menunggu server, hilang dari semua filter, dan riwayat tetap',async()=>{
 const item={kode:'00123',nama:'Susu',satuan:'PCS',stok:0,aktif:true,memiliki_riwayat:true};
 let state={barang:[item],riwayat:[{kode:'00123',nama:'Susu Lama',satuan:'PCS',tanggal:'2026-11-18',jenis:'keluar',jumlah:10,keterangan:''}],arsip:[]};
 let complete;const requests=[];
 const dom=await page(async(_url,opts)=>{
  if(opts.method==='GET')return {ok:true,json:async()=>state};
  requests.push(JSON.parse(opts.body));return new Promise(r=>complete=r);
 });
 const w=dom.window,d=w.document;
 const remove=()=>[...d.querySelectorAll('.aksi-barang button')].find(b=>b.textContent==='Hapus dari Master');
 let message='';w.confirm=m=>{message=m;return false;};remove().click();await flush();
 assert.match(message,/Riwayat tetap tersimpan/);assert.equal(requests.length,0);
 w.confirm=()=>true;remove().click();await flush();
 assert.match(d.getElementById('daftar-stok').textContent,/Susu/);
 complete({ok:false,json:async()=>({error:'Stok harus nol'})});await flush();
 assert.match(d.getElementById('pesan-aksi').textContent,/Stok harus nol/);
 assert.match(d.getElementById('daftar-stok').textContent,/Susu/);
 remove().click();await flush();
 state={...state,barang:[],arsip:[{...item,aktif:false,dihapus:true}]};
 complete({ok:true,json:async()=>state});await flush();
 assert.equal(requests.at(-1).mode,'delete');
 for(const filter of ['aktif','nonaktif','semua']) {
  d.getElementById('filter-status').value=filter;d.getElementById('filter-status').dispatchEvent(new w.Event('change'));
  assert.doesNotMatch(d.getElementById('daftar-stok').textContent,/Susu/);
 }
 d.getElementById('muat-server').click();await flush();
 assert.doesNotMatch(d.getElementById('daftar-stok').textContent,/Susu/);
 d.getElementById('menu-riwayat').click();assert.match(d.getElementById('daftar-riwayat').textContent,/Susu Lama/);
 // Download includes the hidden record required by history foreign keys on restore.
 let blob;w.URL.createObjectURL=b=>{blob=b;return 'blob:test';};w.URL.revokeObjectURL=()=>{};
 w.HTMLAnchorElement.prototype.click=()=>{};
 d.getElementById('cadangkan-data').click();
 const contents=await new Promise(resolve=>{const reader=new w.FileReader();reader.onload=()=>resolve(reader.result);reader.readAsText(blob);});
 const backup=JSON.parse(contents);assert.equal(backup.barang[0].dihapus,true);assert.equal(backup.riwayat.length,1);
 const input=d.getElementById('file-cadangan');
 Object.defineProperty(input,'files',{value:[{size:contents.length,text:async()=>contents}]});
 input.dispatchEvent(new w.Event('change'));await flush();
 assert.equal(requests.at(-1).mode,'migration');assert.equal(requests.at(-1).barang[0].dihapus,true);
 complete({ok:true,json:async()=>state});await flush();
 assert.equal(d.getElementById('preview-migrasi').hidden,false);
 dom.window.close();
});
