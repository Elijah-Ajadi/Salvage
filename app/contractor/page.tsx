import Salvage from '@/app/salvage';
import {account} from '@/lib/account';
import {redirect} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Contractor(){const {user,profile}=await account();if(!user)redirect('/login');if(!profile)redirect('/signup');if(profile.role!=='contractor')redirect('/buyer');return <Salvage mode="contractor" initialAccount={profile}/>;}
