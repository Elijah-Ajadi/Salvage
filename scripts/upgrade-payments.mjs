import {readFile} from 'node:fs/promises';
const project=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL),token=process.env.SUPABASE_ACCESS_TOKEN;
if(!token||!project.hostname.endsWith('.supabase.co'))throw Error('Supabase configuration is missing.');
const endpoint=`https://api.supabase.com/v1/projects/${project.hostname.split('.')[0]}/database/query`;
async function query(sql,read_only=false){
 const r=await fetch(endpoint,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql,read_only}),signal:AbortSignal.timeout(45000)});
 if(!r.ok)throw Error(`Database request failed (${r.status}). Check Supabase access and project availability.`);
 return r.json();
}
const result=await query("select to_regclass('public.users') is not null as base_exists,to_regclass('public.payment_orders') is not null as upgraded",true);
if(!result[0].base_exists)throw Error('Run the initial database setup first.');
if(result[0].upgraded){console.log('Payment integrity migration is already installed.');}
else if(process.argv.includes('--check'))console.log('Payment integrity migration is pending.');
else{
 let sql='BEGIN;\n';
 for(const file of ['202609090003_add_listing_price.sql','202609090004_add_payout_requests.sql','202609090005_payment_integrity.sql'])sql+=await readFile('supabase/migrations/'+file,'utf8')+'\n';
 await query(sql+"NOTIFY pgrst, 'reload schema'; COMMIT;");
 console.log('Payment integrity migration applied. Existing accounts and listings were preserved.');
}
