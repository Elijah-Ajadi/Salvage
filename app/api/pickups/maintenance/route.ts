import {maintainPickups} from '@/lib/pickups';
import {timingSafeEqual} from 'node:crypto';
export const runtime='nodejs';
export const maxDuration=60;
export async function GET(req:Request){
 const expected=process.env.CRON_SECRET?`Bearer ${process.env.CRON_SECRET}`:'';
 const received=req.headers.get('authorization')||'';
 if(!expected||received.length!==expected.length||!timingSafeEqual(Buffer.from(received),Buffer.from(expected)))return Response.json({error:'Unauthorized'},{status:401});
 try{await maintainPickups();return Response.json({ok:true});}catch{return Response.json({error:'Maintenance will retry.'},{status:503});}
}
