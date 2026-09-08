import Auth from '@/app/auth-screen';
import {account} from '@/lib/account';
import {redirect} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Signup({searchParams}:{searchParams:Promise<{role?:string}>}){const {user,profile}=await account();if(profile)redirect(profile.role==='buyer'?'/buyer':'/contractor');const {role}=await searchParams;return <Auth signup user={user?{name:user.fullName||'',email:user.email}:undefined} preferredRole={role==='contractor'?'contractor':'buyer'}/>;}
