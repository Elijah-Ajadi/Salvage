import {createClient} from '@supabase/supabase-js';
const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
// GET with zero rows exposes schema/permission errors reliably; HEAD can hide them.
for(const table of ['users','listings','notifications']){
 const {error}=await client.from(table).select('id').limit(0);
 console.log(`${table}: ${error?'FAILED ('+error.code+')':'OK'}`);
 if(error)process.exitCode=1;
}
const {error}=await client.from('users').select('*').eq('id','00000000-0000-0000-0000-000000000000').maybeSingle();
console.log('New-account profile lookup: '+(error?'FAILED ('+error.code+')':'OK'));
if(error)process.exitCode=1;
