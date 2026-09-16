import {getUser} from '@/lib/auth';
import {admin} from '@/lib/supabase/server';
import {paymentMode} from '@/lib/payments';
import {rpc,validId,isAdmin,captureAcceptedPickup,maintainPickups} from '@/lib/pickups';
export const runtime='nodejs';
export const maxDuration=60;
const fail=(error:string,status=400)=>Response.json({error},{status});

export async function GET(req:Request){try{
 const user=await getUser();if(!user)return fail('Log in to view pickup receipts.',401);
 await rpc('expire_pickups');
 const db=admin(),query=new URL(req.url).searchParams;
 if(query.get('reports')==='1'){
  let q=db.from('safety_reports').select('*').order('created_at',{ascending:false}).limit(100);
  if(!isAdmin(user.userId))q=q.or(`reporter_id.eq.${user.userId},target_id.eq.${user.userId}`);
  const {data,error}=await q;if(error)throw error;return Response.json({reports:data,userId:user.userId,admin:isAdmin(user.userId)});
 }
 let q=db.from('pickup_reservations').select('*,item:listings(title,description,photo,functionality,evidence_note,evidence_photo,address),buyer:users!pickup_reservations_buyer_id_fkey(name,email,phone),contractor:users!pickup_reservations_contractor_id_fkey(name,email,phone),payment:payment_orders(status,amount_cents,currency,livemode,refunded_cents,capture_before)').or(`buyer_id.eq.${user.userId},contractor_id.eq.${user.userId}`).order('created_at',{ascending:false}).limit(100);
 if(query.has('id')){if(!validId(query.get('id')))return fail('Invalid receipt.');q=q.eq('id',query.get('id'));}
 const {data,error}=await q;if(error)throw error;
 const {data:reviews,error:reviewError}=await db.from('pickup_reviews').select('*').eq('author_id',user.userId);if(reviewError)throw reviewError;
 return Response.json({pickups:(data||[]).map(p=>({...p,item:{...p.item,address:['cancelled','expired','declined'].includes(p.status)?undefined:p.item.address},review:reviews?.find(r=>r.reservation_id===p.id)})),userId:user.userId,admin:isAdmin(user.userId)});
}catch{return fail('Could not load pickup records. Please try again.',503);}}

export async function POST(req:Request){try{
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return fail('Invalid origin.',403);
 const user=await getUser();if(!user)return fail('Log in to continue.',401);
 if(!user.emailVerified)return fail('Confirm your email before continuing.',403);
 const b=await req.json(),db=admin();
 await rpc('expire_pickups');
 if(b.action==='reserve'){
  if(!validId(b.listingId)||!Number.isFinite(Date.parse(b.start))||!Number.isFinite(Date.parse(b.end)))return fail('Choose a valid pickup window.');
  const p=await rpc('reserve_pickup',{p_listing:b.listingId,p_buyer:user.userId,p_start:b.start,p_end:b.end,p_live:paymentMode()});
  return Response.json({pickup:p,receiptUrl:`/receipts/${p.id}`});
 }
 if(b.action==='waitlist'||b.action==='leave-waitlist'){
  if(!validId(b.listingId))return fail('Invalid listing.');
  const {data:profile}=await db.from('users').select('role,blocked_until,reservation_cooldown_until').eq('id',user.userId).single();
  if(profile?.role!=='buyer'||Date.parse(profile.blocked_until)>Date.now())return fail('Buyer access required.',403);
  if(b.action==='leave-waitlist'){const {error}=await db.from('pickup_waitlist').delete().eq('listing_id',b.listingId).eq('buyer_id',user.userId);if(error)throw error;return Response.json({ok:true});}
  const {data:item}=await db.from('listings').select('status,claimed_by,under_review').eq('id',b.listingId).single();
  if(item?.status!=='reserved'||item.claimed_by===user.userId||item.under_review)return fail('This item is not available for a waitlist.');
  const {error}=await db.from('pickup_waitlist').upsert({listing_id:b.listingId,buyer_id:user.userId},{onConflict:'listing_id,buyer_id',ignoreDuplicates:true});if(error)throw error;return Response.json({ok:true});
 }
 if(b.action==='report'){
  if(!validId(b.listingId)||typeof b.details!=='string'||b.details.trim().length<10||b.details.length>2000||!['missing_item','misrepresented','unsafe','no_show','other'].includes(b.reason))return fail('Choose a reason and describe what happened (10–2000 characters).');
  const {data:item}=await db.from('listings').select('posted_by').eq('id',b.listingId).single();if(!item)return fail('Listing not found.',404);
  let target=item.posted_by;let reservation:any=null;
  if(b.reservationId){
   if(!validId(b.reservationId))return fail('Invalid receipt.');
   const {data:p}=await db.from('pickup_reservations').select('*').eq('id',b.reservationId).eq('listing_id',b.listingId).single();
   if(!p||![p.buyer_id,p.contractor_id].includes(user.userId))return fail('Not your receipt.',403);
   reservation=p;target=p.buyer_id===user.userId?p.contractor_id:p.buyer_id;
  }
  if(target===user.userId)return fail('You cannot report yourself.');
  if(b.reason==='no_show'&&(!reservation||!reservation.contractor_confirmed_at||reservation.contractor_id!==user.userId||reservation.status!=='expired'||reservation.end_reason==='checkout_incomplete'||Date.parse(reservation.pickup_end)>Date.now()))return fail('No-shows require a confirmed pickup window and can be reported by the contractor after it expires.');
  const {data:existing}=await db.from('safety_reports').select('id').eq('reporter_id',user.userId).eq('listing_id',b.listingId).eq('reason',b.reason).in('status',['open','upheld']).limit(1);
  if(existing?.length)return fail('You already have an active report for this issue.');
  const {error}=await db.from('safety_reports').insert({reporter_id:user.userId,target_id:target,listing_id:b.listingId,reservation_id:reservation?.id||null,reason:b.reason,details:b.details.trim()});if(error)throw error;
  return Response.json({ok:true});
 }
 if(b.action==='review-report'){
  if(!isAdmin(user.userId))return fail('Admin access required.',403);
  if(!validId(b.id)||typeof b.resolution!=='string')return fail('Invalid review.');
  await rpc('review_safety_report',{p_id:b.id,p_admin:user.userId,p_decision:b.decision,p_resolution:b.resolution});return Response.json({ok:true});
 }
 if(b.action==='appeal'){
  if(!validId(b.id)||typeof b.details!=='string'||b.details.trim().length<10||b.details.length>2000)return fail('Explain your appeal (10–2000 characters).');
  const {data,error}=await db.from('safety_reports').update({appeal:b.details.trim(),appealed_at:new Date().toISOString(),status:'open'}).eq('id',b.id).eq('target_id',user.userId).eq('status','upheld').select('id').maybeSingle();
  if(error||!data)return fail('This report cannot be appealed.',409);return Response.json({ok:true});
 }
 if(!validId(b.id))return fail('Invalid receipt.');
 if(b.action==='confirm-window'){await rpc('confirm_pickup_window',{p_id:b.id,p_contractor:user.userId});return Response.json({ok:true});}
 if(b.action==='accept'){
  if(b.inspected!==true)return fail('Confirm that you inspected and accept the item.');
  const p=await rpc('accept_pickup',{p_id:b.id,p_buyer:user.userId});
  if(p.amount_cents)await captureAcceptedPickup(p.id);
  return Response.json({ok:true});
 }
 if(b.action==='collect'){await rpc('collect_pickup',{p_id:b.id,p_contractor:user.userId});return Response.json({ok:true});}
 if(b.action==='cancel'||b.action==='decline'){
  const p=await rpc('end_pickup',{p_id:b.id,p_actor:user.userId,p_reason:b.action==='decline'?'declined':'cancelled'});
  // State is durable even if Stripe is temporarily unavailable; the maintenance worker retries release.
  try{await maintainPickups();}catch{console.error('Card hold release queued for retry.');}
  return Response.json({ok:true,pickup:p});
 }
 if(b.action==='extend'||b.action==='decide-extension'){
  if(b.action==='extend'&&!Number.isFinite(Date.parse(b.end)))return fail('Choose a valid extension time.');
  if(b.action==='decide-extension'&&typeof b.approve!=='boolean')return fail('Choose approve or decline.');
  await rpc('extend_pickup',{p_id:b.id,p_actor:user.userId,p_end:b.action==='extend'?b.end:null,p_approve:b.action==='extend'?null:b.approve});return Response.json({ok:true});
 }
 if(b.action==='review'){
  if(!Number.isInteger(b.rating)||b.rating<1||b.rating>5||typeof b.comment!=='string'||b.comment.length>1000)return fail('Choose a rating and a comment under 1000 characters.');
  const {data:p}=await db.from('pickup_reservations').select('*').eq('id',b.id).single();
  if(!p||p.status!=='collected'||![p.buyer_id,p.contractor_id].includes(user.userId))return fail('Only completed pickup participants can leave reviews.',403);
  const {error}=await db.from('pickup_reviews').insert({reservation_id:p.id,author_id:user.userId,target_id:user.userId===p.buyer_id?p.contractor_id:p.buyer_id,rating:b.rating,comment:b.comment});
  if(error)return fail('You already reviewed this pickup or it could not be saved.',409);return Response.json({ok:true});
 }
 return fail('Unknown action.');
}catch(e){return fail(e instanceof Error?e.message:'Could not complete the pickup request.',409);}}
