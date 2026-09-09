import {readFile} from 'node:fs/promises';
const url=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
const token=process.env.SUPABASE_ACCESS_TOKEN;
if(!token||!/^([a-z0-9]+)\.supabase\.co$/.test(url.hostname))throw Error('Supabase project URL and access token are required.');
const endpoint=`https://api.supabase.com/v1/projects/${url.hostname.split('.')[0]}/database/query`;
async function query(sql,readOnly){const r=await fetch(endpoint,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql,read_only:readOnly}),signal:AbortSignal.timeout(45000)});if(!r.ok){let error=await r.text();error=error.split(token).join('[redacted]');throw Error(`Database setup request failed (${r.status}): ${error.slice(0,500)}`);}return r.json();}
const rows=await query("select tablename from pg_catalog.pg_tables where schemaname='public' and tablename in ('users','listings','notifications')",true);
console.log('Existing application tables:',rows.map(r=>r.tablename).join(', ')||'none');
if(process.argv.includes('--check'))process.exit(0);
if(rows.length){throw Error('Application tables already exist. Stopped without changing existing schema or records.');}
const sql=(await readFile('supabase/migrations/202609090001_salvage.sql','utf8'))+'\n'+(await readFile('supabase/migrations/202609090002_optional_profile_coordinates.sql','utf8'));
await query(`BEGIN;\n${sql}\nNOTIFY pgrst, 'reload schema';\nCOMMIT;`,false);
console.log('Salvage schema installed. Existing authentication accounts and photo bucket were preserved.');

