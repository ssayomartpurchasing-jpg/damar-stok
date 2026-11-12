import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {execute,snapshot} from '../server/inventory.mjs';
import {createHandler} from '../netlify/functions/inventory.mjs';
const item={kode:'00123',nama:'Susu',satuan:'PCS',stok:10};
const row=(kode='00123',jumlah=2,jenis='keluar')=>({kode,nama:'Susu',satuan:'PCS',jumlah,jenis,tanggal:'2026-11-12',keterangan:''});
async function setup(){const db=new PGlite();await db.exec(await readFile('netlify/database/migrations/20261112140000_create_inventory.sql','utf8'));return db;}
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
