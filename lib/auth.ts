import {configured,sessionClient} from '@/lib/supabase/server';
export async function getUser(){if(!configured())return null;const s=await sessionClient();const {data:{user},error}=await s.auth.getUser();if(error||!user)return null;return {userId:user.id,email:user.email||'',fullName:user.user_metadata.name||null,role:user.user_metadata.role,emailVerified:!!user.email_confirmed_at};}
