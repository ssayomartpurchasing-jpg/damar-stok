import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('public',{recursive:true});
for(const file of ['index.html','app.js','style.css','xlsx.full.min.js']) await copyFile(file,'public/'+file);
