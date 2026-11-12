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
