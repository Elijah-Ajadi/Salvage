import {sessionClient} from '@/lib/supabase/server';
import {handleAuth} from '@/lib/auth-actions';
export async function POST(req:Request){
 try{
  if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Invalid request.'},{status:403});
  return await handleAuth(await req.json(),await sessionClient(),new URL(req.url).origin);
 }catch{return Response.json({error:'Account service is temporarily unavailable. Please try again.'},{status:503});}
}
