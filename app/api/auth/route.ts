import {sessionClient} from '@/lib/supabase/server';
import {handleAuth} from '@/lib/auth-actions';
import {cookies} from 'next/headers';
export async function POST(req:Request){
 try{
  if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Invalid request.'},{status:403});
  const body=await req.json();
  if(body.action==='logout'){
   const jar=await cookies();
   const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
   const prefix=url?`sb-${new URL(url).hostname.split('.')[0]}-auth-token`:null;
   // Expire every chunk even when a stale session cannot be revoked upstream.
   try{await handleAuth(body,await sessionClient(),new URL(req.url).origin);}catch{}
   if(prefix)for(const {name} of jar.getAll())if(name===prefix||name.startsWith(prefix+'.')||name.startsWith(prefix+'-'))jar.set(name,'',{path:'/',maxAge:0});
   return Response.json({redirect:'/login'},{headers:{'Cache-Control':'no-store'}});
  }
  return await handleAuth(body,await sessionClient(),new URL(req.url).origin);
 }catch{return Response.json({error:'Account service is temporarily unavailable. Please try again.'},{status:503});}
}
