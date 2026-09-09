import {getUser} from '@/lib/auth';
import {admin} from '@/lib/supabase/server';
export async function account(){const user=await getUser();if(!user)return {user:null,profile:null};const {data:profile,error}=await admin().from('users').select('*').eq('id',user.userId).maybeSingle();if(error){console.error('Salvage profile lookup failed',{code:error.code});throw Error(error.code==='PGRST205'?'Salvage database tables are missing. Run the database setup migration.':'Could not load your account. Please try again.');}return {user,profile};}
