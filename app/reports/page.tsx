import {getUser} from '@/lib/auth';
import {redirect} from 'next/navigation';
import PickupUI from '@/app/pickup-ui';
export default async function Page(){if(!await getUser())redirect('/login');return <PickupUI reportsOnly/>;}
