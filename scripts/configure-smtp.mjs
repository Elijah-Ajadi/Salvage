// Configuration only: this script never sends email or prints credentials.
const required=['NEXT_PUBLIC_SUPABASE_URL','EMAIL_HOST','EMAIL_PORT','EMAIL_HOST_USER','EMAIL_HOST_PASSWORD','DEFAULT_FROM_EMAIL'];
const missing=required.filter(k=>!process.env[k]?.trim());
if(missing.length){console.error('Missing settings: '+missing.join(', '));process.exit(1);}
const url=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
if(!/^[a-z0-9]+\.supabase\.co$/.test(url.hostname)||url.protocol!=='https:'){console.error('Use the original Supabase project HTTPS URL for this setup command.');process.exit(1);}
const port=Number(process.env.EMAIL_PORT);
if(process.env.EMAIL_HOST!=='smtp.gmail.com'||![465,587].includes(port)){console.error('Gmail requires smtp.gmail.com with port 465 or 587.');process.exit(1);}
const rawFrom=process.env.DEFAULT_FROM_EMAIL.trim();
const from=rawFrom.match(/<([^<>]+)>$/)?.[1]||rawFrom;
if(!/^\S+@\S+\.\S+$/.test(from)){console.error('DEFAULT_FROM_EMAIL must contain a valid email address.');process.exit(1);}
const values={external_email_enabled:true,mailer_autoconfirm:false,smtp_host:process.env.EMAIL_HOST,smtp_port:String(port),smtp_user:process.env.EMAIL_HOST_USER.trim(),smtp_pass:process.env.EMAIL_HOST_PASSWORD.replace(/\s/g,''),smtp_admin_email:from,smtp_sender_name:'Salvage'};
if(process.argv.includes('--check')){console.log('Gmail SMTP settings are present and valid in shape. Remote settings and delivery have not been tested.');process.exit(0);}
const token=process.env.SUPABASE_ACCESS_TOKEN;
if(!token){console.error('Add SUPABASE_ACCESS_TOKEN to your ignored .env file to apply Gmail settings. Create one at https://supabase.com/dashboard/account/tokens. This is separate from the service-role key.');process.exit(1);}
try{
 const endpoint='https://api.supabase.com/v1/projects/'+url.hostname.split('.')[0]+'/config/auth';
 const response=await fetch(endpoint,{method:'PATCH',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(values),signal:AbortSignal.timeout(20000)});
 if(!response.ok){let detail=await response.text();for(const value of [token,...Object.values(values)]){if(typeof value==='string'&&value.length>3)detail=detail.split(value).join('[redacted]');}console.error('SMTP configuration failed with HTTP '+response.status+': '+detail.slice(0,1500));process.exit(1);}
 const verified=await fetch(endpoint,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(20000)});
 if(!verified.ok){console.error('Settings were submitted but verification failed. Check the Supabase SMTP settings.');process.exit(1);}
 const data=await verified.json();
 if(data.smtp_host!==values.smtp_host||Number(data.smtp_port)!==port||data.smtp_user!==values.smtp_user||data.smtp_admin_email!==from||data.mailer_autoconfirm!==false){console.error('Saved configuration did not match the expected settings. Check Supabase SMTP settings.');process.exit(1);}
 console.log('Gmail SMTP saved in Supabase; email confirmation remains enabled. No test email was sent.');
}catch{console.error('Could not connect to the Supabase Management API. No credentials were printed.');process.exit(1);}

