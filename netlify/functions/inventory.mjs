import { getDatabase } from '@netlify/database';
import { execute, snapshot, InputError } from '../../server/inventory.mjs';
export function createHandler(connect) {
 return async function handler(req) {
 const headers={'Cache-Control':'no-store','Content-Type':'application/json'};
 const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
 let client;
 try {
  const actor='anonymous';
  if(!['GET','POST'].includes(req.method)) return reply({error:'Metode tidak diizinkan.'},405);
  if(req.method==='POST') {
   const origin=req.headers.get('origin');
   if(origin && origin!==new URL(req.url).origin) throw new InputError('Origin tidak diizinkan.',403);
   if(!req.headers.get('content-type')?.includes('application/json')) throw new InputError('Gunakan JSON.');
  }
  let body;
  if(req.method==='POST') {
   const raw=await req.text();
   if(Buffer.byteLength(raw)>5*1024*1024) throw new InputError('Data maksimal 5 MB.');
   try {body=JSON.parse(raw);} catch {throw new InputError('JSON tidak valid.');}
  }
  client=await connect();
  if(req.method==='GET') {
   await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
   try {const data=await snapshot(client); await client.query('COMMIT'); return reply(data);} catch(e) {await client.query('ROLLBACK'); throw e;}
  }
  return reply(await execute(client,body,actor,body.preview===true));
 } catch(error) {
  return reply({error:error instanceof InputError ? error.message : 'Server tidak dapat menyimpan data. Periksa koneksi dan muat ulang untuk memastikan status.'},error.status||503);
 } finally {client?.release();}
}
}
export default createHandler(() => getDatabase().pool.connect());
export const config={path:'/api/inventory'};
