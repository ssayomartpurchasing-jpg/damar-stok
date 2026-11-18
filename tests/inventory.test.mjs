import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {execute,snapshot} from '../server/inventory.mjs';
import {createHandler} from '../netlify/functions/inventory.mjs';
const item={kode:'00123',nama:'Susu',satuan:'PCS',stok:10};
const row=(kode='00123',jumlah=2,jenis='keluar')=>({kode,nama:'Susu',satuan:'PCS',jumlah,jenis,tanggal:'2026-11-12',keterangan:''});
async function setup(){const db=new PGlite();for(const file of (await readdir('netlify/database/migrations')).sort()) await db.exec(await readFile('netlify/database/migrations/'+file,'utf8'));return db;}
test('manual masuk, penjualan, barcode teks dan stok tidak cukup',async()=>{
 const db=await setup();try {
 await execute(db,{mode:'items',barang:[item]},'u');
 await execute(db,{mode:'transactions',manual:true,requestId:'a',riwayat:[row('00123',4,'masuk')]},'u');
 await execute(db,{mode:'transactions',manual:true,requestId:'b',riwayat:[row()]},'u');
 assert.equal((await snapshot(db)).barang[0].stok,12);
 await assert.rejects(execute(db,{mode:'transactions',riwayat:[row('00123',13)]},'u'),/Stok tidak cukup/);
 assert.equal((await snapshot(db)).barang[0].kode,'00123');
 assert.equal((await snapshot(db)).riwayat.length,2);
 }finally{await db.close();}
});
test('bulk atomik, preview rollback, duplikat, retry manual',async()=>{
 const db=await setup();try{
 await execute(db,{mode:'items',barang:[item,{...item,kode:'00999'}]},'u');
 const body={mode:'transactions',riwayat:[row('00123',3),row('00999',4)]};
 await execute(db,body,'u',true);
 assert.equal((await snapshot(db)).riwayat.length,0);
 await execute(db,body,'u');
 await assert.rejects(execute(db,{...body,riwayat:[...body.riwayat].reverse()},'u'),/sudah tersimpan/);
 const before=await snapshot(db);
 await assert.rejects(execute(db,{mode:'transactions',riwayat:[row('00123',1),row('00999',99)]},'u'),/Stok tidak cukup/);
 assert.deepEqual(await snapshot(db),before);
 const retry={mode:'transactions',manual:true,requestId:'retry',riwayat:[row()]};
 await execute(db,retry,'u'); await assert.rejects(execute(db,retry,'u'),/sudah tersimpan/);
 }finally{await db.close();}
});
test('migrasi preview, stok tidak dihitung ulang, database tidak ditimpa',async()=>{
 const db=await setup();try{
 const body={mode:'migration',barang:[item],riwayat:[row()]};
 await execute(db,body,'u',true); assert.equal((await snapshot(db)).barang.length,0);
 await execute(db,body,'u');assert.equal((await snapshot(db)).barang[0].stok,10);
 await assert.rejects(execute(db,{mode:'migration',barang:[{...item,kode:'new'}],riwayat:[]},'u'),/database kosong/);
 }finally{await db.close();}
});
test('endpoint publik membaca dan menulis tanpa cookie atau Authorization; data lama dipertahankan',async()=>{
 const db=await setup();
 try {
  await execute(db,{mode:'items',barang:[{...item,kode:'existing'}]},'legacy-user');
  const handler=createHandler(async()=>({query:(...args)=>db.query(...args),release(){}}));
  const request=body=>new Request('https://example.test/api/inventory',body?{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://example.test'},body:JSON.stringify(body)}:{});
  let response=await handler(request());assert.equal(response.status,200);
  assert.equal((await response.json()).barang[0].kode,'existing');
  response=await handler(request({mode:'items',barang:[item]}));assert.equal(response.status,200);
  response=await handler(request({mode:'transactions',riwayat:[row()]}));assert.equal(response.status,200);
  let data=await response.json();assert.equal(data.barang.find(x=>x.kode==='00123').stok,8);
  assert.equal(data.barang.find(x=>x.kode==='existing').stok,10);
  const actor=(await db.query('SELECT actor FROM damar_history')).rows[0].actor;assert.equal(actor,'anonymous');
  response=await handler(request({mode:'transactions',riwayat:[row()]}));assert.equal(response.status,409);
  response=await handler(request({mode:'transactions',riwayat:[row('00123',99)]}));assert.equal(response.status,400);
  response=await handler(request());assert.equal(response.status,200);data=await response.json();assert.equal(data.riwayat.length,1);
  assert.equal(response.headers.get('Cache-Control'),'no-store');
 } finally {await db.close();}
});

test('API edit persisten, barcode unik, stok terkunci dan riwayat lama tetap',async()=>{
 const db=await setup();try {
 const handler=createHandler(async()=>({query:(...args)=>db.query(...args),release(){}}));
 const call=async body=>{
  const response=await handler(new Request('https://example.test/api/inventory',body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}));
  return {status:response.status,data:await response.json()};
 };
 await call({mode:'items',barang:[item,{...item,kode:'OTHER',stok:0}]});
 let response=await call({mode:'edit',originalKode:'00123',kode:'00001',nama:'Susu Baru',satuan:'BOX'});
 assert.equal(response.status,200);
 let state=(await call()).data;
 assert.deepEqual(state.barang.find(x=>x.kode==='00001'),{kode:'00001',nama:'Susu Baru',satuan:'BOX',stok:10,aktif:true,memiliki_riwayat:false});
 assert.equal((await call({mode:'edit',originalKode:'00001',kode:'other',nama:'X',satuan:'BOX'})).status,409);
 assert.equal((await call({mode:'edit',originalKode:'00001',kode:'00001',nama:'X',satuan:'BOX',stok:0})).status,400);
 await call({mode:'transactions',riwayat:[{...row('00001',10),satuan:'BOX'}]});
 response=await call({mode:'edit',originalKode:'00001',kode:'00001',nama:'Nama Terbaru',satuan:'BOX'});
 assert.equal(response.status,200);
 state=(await call()).data;
 assert.equal(state.riwayat[0].nama,'Susu Baru');assert.equal(state.barang[0].nama,'Nama Terbaru');
 for(const changes of [{kode:'BARU',satuan:'BOX'},{kode:'00001',satuan:'PCS'}]) {
  assert.equal((await call({mode:'edit',originalKode:'00001',nama:'Nama Terbaru',...changes})).status,400);
 }
 } finally {await db.close();}
});

test('hapus diperiksa server; nonaktif menolak manual/impor secara atomik dan dapat diaktifkan',async()=>{
 const db=await setup();try {
 await execute(db,{mode:'items',barang:[item,{...item,kode:'EMPTY',stok:0},{...item,kode:'WITH_HISTORY',stok:0}]},'u');
 await assert.rejects(execute(db,{mode:'delete',originalKode:'00123'},'u'),/stok harus nol/);
 await assert.rejects(execute(db,{mode:'deactivate',originalKode:'00123'},'u'),/stok harus nol/);
 await execute(db,{mode:'transactions',riwayat:[row('WITH_HISTORY',1,'masuk')]},'u');
 await assert.rejects(execute(db,{mode:'delete',originalKode:'WITH_HISTORY'},'u'),/belum memiliki riwayat/);
 await execute(db,{mode:'transactions',riwayat:[row('WITH_HISTORY',1,'keluar')]},'u');
 await assert.rejects(execute(db,{mode:'delete',originalKode:'WITH_HISTORY'},'u'),/belum memiliki riwayat/);
 await execute(db,{mode:'delete',originalKode:'EMPTY'},'u');
 assert.equal((await snapshot(db)).barang.some(x=>x.kode==='EMPTY'),false);
 await execute(db,{mode:'deactivate',originalKode:'WITH_HISTORY'},'u');
 const before=await snapshot(db);
 assert.equal(before.barang.find(x=>x.kode==='WITH_HISTORY').aktif,false);
 await assert.rejects(execute(db,{mode:'transactions',manual:true,requestId:'inactive',riwayat:[row('WITH_HISTORY',2,'masuk')]},'u'),/nonaktif/);
 const bulk={mode:'transactions',riwayat:[row('00123',1),row('WITH_HISTORY',2,'masuk')]};
 await assert.rejects(execute(db,bulk,'u',true),/nonaktif/);
 await assert.rejects(execute(db,bulk,'u'),/nonaktif/);
 assert.deepEqual(await snapshot(db),before);
 await assert.rejects(execute(db,{mode:'items',barang:[{...item,kode:'with_history'}]},'u'),/terdaftar/);
 await assert.rejects(execute(db,{mode:'edit',originalKode:'00123',kode:'with_history',nama:'X',satuan:'PCS'},'u'),/terdaftar/);
 await execute(db,{mode:'activate',originalKode:'WITH_HISTORY'},'u');
 await execute(db,{mode:'transactions',manual:true,requestId:'reactivated',riwayat:[row('WITH_HISTORY',2,'masuk')]},'u');
 assert.equal((await snapshot(db)).barang.find(x=>x.kode==='WITH_HISTORY').stok,2);
 assert.equal((await snapshot(db)).riwayat.length,3);
 }finally{await db.close();}
});

test('migrasi tambahan mempertahankan data lama dan backup nonaktif dapat dipulihkan',async()=>{
 const legacy=new PGlite();try {
 await legacy.exec(await readFile('netlify/database/migrations/20261112140000_create_inventory.sql','utf8'));
 await legacy.query('INSERT INTO damar_items(kode,nama,satuan,stok) VALUES ($1,$2,$3,$4)',[item.kode,item.nama,item.satuan,item.stok]);
 await legacy.exec(await readFile('netlify/database/migrations/20261118140000_add_item_active.sql','utf8'));
 const state=await snapshot(legacy);assert.equal(state.barang[0].aktif,true);assert.equal(state.barang[0].stok,10);
 }finally{await legacy.close();}
 const db=await setup();try{
 await execute(db,{mode:'migration',barang:[{...item,stok:0,aktif:false}],riwayat:[row('00123',1,'masuk'),row('00123',1,'keluar')]},'u');
 const state=await snapshot(db);assert.equal(state.barang[0].aktif,false);assert.equal(state.riwayat.length,2);
 await assert.rejects(execute(db,{mode:'transactions',riwayat:[row('00123',1,'masuk')]},'u'),/nonaktif/);
 }finally{await db.close();}
});
