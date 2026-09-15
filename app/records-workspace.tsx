import {account} from '@/lib/account';
import {redirect} from 'next/navigation';
import Salvage from '@/app/salvage';

export default async function RecordsWorkspace({reports=false,id}:{reports?:boolean;id?:string}){
 const {user,profile}=await account();
 if(!user)redirect('/login');
 if(!profile)redirect('/signup');
 return <Salvage mode={profile.role} initialAccount={{...profile,emailVerified:!!user.emailVerified}} initialView={reports?'Reports & appeals':'My pickups'} receiptId={id}/>;
}
