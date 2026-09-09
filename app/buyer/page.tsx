import Salvage from '@/app/salvage';
import {account} from '@/lib/account';
import {redirect} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Buyer(){const {user,profile}=await account();if(!user)redirect('/login');if(!profile)redirect('/signup');if(profile.role!=='buyer')redirect('/contractor');return <Salvage mode="buyer" initialAccount={{...profile,emailVerified:!!user.emailVerified}}/>;}
