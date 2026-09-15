import {readFile} from 'node:fs/promises';
const project=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL),token=process.env.SUPABASE_ACCESS_TOKEN;
if(!token||!project.hostname.endsWith('.supabase.co'))throw Error('Supabase configuration is missing.');
async function query(sql){
 const r=await fetch(`https://api.supabase.com/v1/projects/${project.hostname.split('.')[0]}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql}),signal:AbortSignal.timeout(45000)});
 if(!r.ok)throw Error(`Database update failed (${r.status}).`);
 return r.json();
}
const check=await query("select to_regprocedure('public.local_listings(uuid,double precision,double precision)') is not null as installed");
if(check[0].installed)console.log('Listing radius migration is already installed.');
else{
 await query('BEGIN;\n'+await readFile('supabase/migrations/202609150007_listing_radius.sql','utf8')+"\nNOTIFY pgrst, 'reload schema'; COMMIT;");
 console.log('Listing radius migration applied. Existing listings inherit their contractor’s saved radius.');
}
