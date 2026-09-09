import Auth from '@/app/auth-screen';
import {account} from '@/lib/account';
import {redirect} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Login(){const {user,profile}=await account();if(profile)redirect(profile.role==='buyer'?'/buyer':'/contractor');return <Auth signup={false} incompleteAccount={!!user}/>;}
