import { createHash } from 'node:crypto';
export class InputError extends Error { constructor(message, status=400) { super(message); this.status=status; } }
const fail = message => { throw new InputError(message); };
const text = (v, max=200) => typeof v === 'string' && v.trim() && v.trim().length <= max ? v.trim() : fail('Teks kosong atau terlalu panjang.');
const qty = (v, zero=false) => typeof v === 'number' && Number.isFinite(v) && v >= (zero ? 0 : .001) && v <= 999999999999 && Math.abs(v*1000-Math.round(v*1000)) < .0001 ? v : fail('Jumlah harus angka dengan maksimal 3 desimal.');
export function normalize(body) {
 const mode=body.mode;
 if (!['items','transactions','migration'].includes(mode)) fail('Operasi tidak valid.');
 const array=(v,max=5000) => Array.isArray(v) && v.length <= max ? v : fail('Data terlalu banyak atau tidak valid.');
 const items=mode==='transactions' ? [] : array(body.barang).map(x=>({kode:text(x.kode),nama:text(x.nama),satuan:text(x.satuan),stok:qty(x.stok,true)}));
 const seen=new Set();
 for(const x of items) { const k=x.kode.toLowerCase(); if(seen.has(k)) fail('Barcode ganda: '+x.kode); seen.add(k); }
 const rows=mode==='items' ? [] : array(body.riwayat,mode==='migration'?50000:5000).map(x=>{
  const tanggal=text(x.tanggal,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(tanggal) || !Number.isFinite(Date.parse(tanggal+'T00:00:00Z')) || new Date(tanggal+'T00:00:00Z').toISOString().slice(0,10)!==tanggal) fail('Tanggal tidak valid.');
  if(!['masuk','keluar'].includes(x.jenis)) fail('Jenis tidak valid.');
  return {kode:text(x.kode),nama:text(x.nama),satuan:text(x.satuan),tanggal,jenis:x.jenis,jumlah:qty(x.jumlah),keterangan:typeof x.keterangan==='string' && x.keterangan.length<=250 ? x.keterangan : fail('Keterangan tidak valid.')};
 });
 if(!items.length && !rows.length) fail('Data kosong.');
 // Sort canonical content so changing filename or row order cannot bypass import protection.
 const sort=a=>a.sort((x,y)=>JSON.stringify(x).localeCompare(JSON.stringify(y)));
 const content={mode,barang:sort(items),riwayat:sort(rows)};
 // Manual retries retain their key; Excel and migration use server-calculated content hashes.
 if(body.manual) content.requestId=text(body.requestId);
 return {...content,fingerprint:createHash('sha256').update(JSON.stringify(content)).digest('hex')};
}
export async function snapshot(client) {
 const barang=(await client.query('SELECT kode,nama,satuan,stok FROM damar_items ORDER BY kode')).rows.map(x=>({...x,stok:Number(x.stok)}));
 const riwayat=(await client.query("SELECT kode,nama,satuan,to_char(tanggal,'YYYY-MM-DD') AS tanggal,jenis,jumlah,keterangan FROM damar_history ORDER BY id")).rows.map(x=>({...x,jumlah:Number(x.jumlah)}));
 return {barang,riwayat};
}
export async function execute(client, body, actor, preview=false) {
 const data=normalize(body);
 await client.query('BEGIN');
 try {
  // Serializes all inventory writes, including initial migration and concurrent sales.
  await client.query('LOCK TABLE damar_items IN EXCLUSIVE MODE');
  if((await client.query('SELECT 1 FROM damar_batches WHERE fingerprint=$1',[data.fingerprint])).rows.length) throw new InputError('Impor/transaksi yang sama sudah tersimpan. Muat ulang data.',409);
  if(data.mode==='migration' && (await client.query('SELECT 1 FROM damar_items LIMIT 1')).rows.length) throw new InputError('Migrasi hanya untuk database kosong. Data yang ada tidak ditimpa.',409);
  await client.query('INSERT INTO damar_batches(fingerprint,actor) VALUES ($1,$2)',[data.fingerprint,actor]);
  for(const x of data.barang) await client.query('INSERT INTO damar_items(kode,nama,satuan,stok) VALUES ($1,$2,$3,$4)',[x.kode,x.nama,x.satuan,x.stok]);
  for(const x of data.riwayat) {
   const item=(await client.query('SELECT * FROM damar_items WHERE lower(kode)=lower($1) FOR UPDATE',[x.kode])).rows[0];
   if(!item) fail('Barcode tidak ditemukan: '+x.kode);
   if(item.satuan.toLowerCase()!==x.satuan.toLowerCase()) fail('Satuan berbeda: '+x.kode);
   if(data.mode!=='migration') {
    const result=await client.query('UPDATE damar_items SET stok=stok+$1 WHERE kode=$2 AND stok+$1>=0 RETURNING stok',[x.jenis==='masuk'?x.jumlah:-x.jumlah,item.kode]);
    if(!result.rows.length) fail('Stok tidak cukup: '+item.kode);
   }
   await client.query('INSERT INTO damar_history(kode,nama,satuan,tanggal,jenis,jumlah,keterangan,actor,batch) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',[item.kode,item.nama,item.satuan,x.tanggal,x.jenis,x.jumlah,x.keterangan,actor,data.fingerprint]);
  }
  const state=await snapshot(client);
  await client.query(preview?'ROLLBACK':'COMMIT');
  return {...state,preview,fingerprint:data.fingerprint};
 } catch(error) { await client.query('ROLLBACK'); if(error.code==='23505') throw new InputError('Barcode atau impor sudah terdaftar.',409); throw error; }
}
