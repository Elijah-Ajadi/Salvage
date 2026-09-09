import {sessionClient} from '@/lib/supabase/server';
import {NextResponse} from 'next/server';
export async function GET(req:Request){const u=new URL(req.url);const code=u.searchParams.get('code');if(code){try{const s=await sessionClient();const {error}=await s.auth.exchangeCodeForSession(code);if(!error)return NextResponse.redirect(new URL(u.searchParams.get('next')==='/reset-password?update=1'?'/reset-password?update=1':'/dashboard',u.origin));}catch{}}return NextResponse.redirect(new URL('/login?error=confirmation',u.origin));}

