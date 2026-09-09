import {redirect} from 'next/navigation';
import {account} from '@/lib/account';
export const dynamic='force-dynamic';
export default async function Dashboard(){const {user,profile}=await account();redirect(!user?'/login':!profile?'/signup':profile.role==='contractor'?'/contractor':'/buyer');}
