import {readFile} from 'node:fs/promises';

const project=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
const token=process.env.SUPABASE_ACCESS_TOKEN;
if(!token||!/^([a-z0-9]+)\.supabase\.co$/.test(project.hostname))throw Error('Supabase project URL and access token are required.');
async function query(sql){
 const r=await fetch(`https://api.supabase.com/v1/projects/${project.hostname.split('.')[0]}/database/query`,{
  method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql}),signal:AbortSignal.timeout(45000)
 });
 if(!r.ok)throw Error(`Listing deletion migration failed (${r.status}).`);
 return r.json();
}
const [check]=await query("select to_regprocedure('public.delete_listing(uuid,uuid)') is not null as installed");
if(check.installed)console.log('Listing deletion migration is already installed.');
else{
 const migration=await readFile('supabase/migrations/202609160009_delete_listings.sql','utf8');
 await query("BEGIN;\n"+migration+"\nNOTIFY pgrst, 'reload schema';\nCOMMIT;");
 console.log('Listing deletion installed. Deploy the matching app so contractors can delete unclaimed listings.');
}
