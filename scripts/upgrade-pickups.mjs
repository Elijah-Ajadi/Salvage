import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
const project=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL),token=process.env.SUPABASE_ACCESS_TOKEN;
if(!token||!project.hostname.endsWith('.supabase.co'))throw Error('Supabase configuration is missing.');
const endpoint=`https://api.supabase.com/v1/projects/${project.hostname.split('.')[0]}/database/query`;
async function query(sql,read_only=false){
 const r=await fetch(endpoint,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql,read_only}),signal:AbortSignal.timeout(45000)});
 if(!r.ok){const detail=await r.json().catch(()=>({}));console.error('Database error code:',detail.code||r.status);throw Error('Database request failed. No credentials were displayed.');}return r.json();
}
const rows=await query("select to_regclass('public.pickup_reservations') is not null as upgraded,to_regclass('public.payment_orders') is not null as payments",true);
if(!rows[0].payments)throw Error('Apply the payment integrity migration first.');
if(process.argv.includes('--check')){console.log('Pickup protection migration: '+(rows[0].upgraded?'installed':'pending'));}
else{
 const adminEmail=process.argv[process.argv.indexOf('--admin-email')+1];
 if(process.argv.includes('--admin-email')){
  if(!adminEmail||!/^\S+@\S+\.\S+$/.test(adminEmail))throw Error('Enter the administrator account email.');
  const emailLiteral="'"+adminEmail.toLowerCase().replaceAll("'","''")+"'";
  const accounts=await query(`select u.id from auth.users u join public.users p on p.id=u.id where lower(u.email)=${emailLiteral}`,true);
  if(accounts.length!==1)throw Error('That email must belong to one registered Salvage profile before it can be an admin.');
  let env=await readFile('.env','utf8');const value='ADMIN_USER_IDS='+accounts[0].id;
  env=/^ADMIN_USER_IDS=.*$/m.test(env)?env.replace(/^ADMIN_USER_IDS=.*$/m,value):env+'\n'+value+'\n';
  await writeFile('.env',env);console.log('Requested administrator configured in .env. Add ADMIN_USER_IDS to Vercel.');
 }
 if(!rows[0].upgraded){await query('BEGIN;\n'+await readFile('supabase/migrations/202609110006_pickup_protection.sql','utf8')+"\nNOTIFY pgrst, 'reload schema'; COMMIT;");console.log('Pickup protection migration applied. Existing records preserved.');}
 // Expiry is a database task, independent of browser visits or Vercel plan limits.
 await query("create extension if not exists pg_cron with schema pg_catalog; select cron.schedule('salvage-pickup-expiry','* * * * *','select public.expire_pickups();');");
 console.log('Automatic expiry and in-app reminders scheduled every minute.');
 let secret=process.env.CRON_SECRET;
 if(!secret){secret=randomBytes(32).toString('hex');let env=await readFile('.env','utf8');env+=`\nCRON_SECRET=${secret}\n`;await writeFile('.env',env);console.log('CRON_SECRET generated and saved to .env without displaying it.');}
 if(process.argv.includes('--schedule-payments')){
  const origin=new URL(process.env.NEXT_PUBLIC_APP_URL).origin;
  if(!origin.startsWith('https://'))throw Error('Use the production HTTPS app URL.');
  const literal=s=>"'"+s.replaceAll("'","''")+"'";
  await query(`create extension if not exists pg_net;\nDO $setup$ DECLARE existing uuid; BEGIN select id into existing from vault.secrets where name='salvage_cron_secret'; if existing is null then perform vault.create_secret(${literal(secret)},'salvage_cron_secret'); else perform vault.update_secret(existing,${literal(secret)}); end if; END $setup$;\nselect cron.schedule('salvage-hold-maintenance','*/5 * * * *',$job$ select net.http_get(url := ${literal(origin+'/api/pickups/maintenance')}, headers := jsonb_build_object('Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='salvage_cron_secret')),timeout_milliseconds := 55000); $job$);`);
  console.log('Card-hold cleanup scheduled every five minutes. Set CRON_SECRET in Vercel before enabling real reservations.');
 }
}
