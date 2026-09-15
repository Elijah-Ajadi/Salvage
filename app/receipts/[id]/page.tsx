import RecordsWorkspace from '@/app/records-workspace';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <RecordsWorkspace id={id}/>;}
