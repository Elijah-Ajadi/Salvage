import {getUser} from '@/lib/auth';
import {redirect} from 'next/navigation';
import PickupUI from '@/app/pickup-ui';
export default async function Page({params}:{params:Promise<{id:string}>}){if(!await getUser())redirect('/login');const {id}=await params;return <PickupUI id={id}/>;}
