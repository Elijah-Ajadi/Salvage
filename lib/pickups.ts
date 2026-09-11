import 'server-only';
import type Stripe from 'stripe';
import {admin} from './supabase/server';
import {stripeClient} from './payments';

export const isAdmin=(id:string)=>(process.env.ADMIN_USER_IDS||'').split(',').map(s=>s.trim()).includes(id);
export const validId=(id:unknown):id is string=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
export async function rpc(name:string,args:Record<string,unknown>={}){
 const {data,error}=await admin().rpc(name,args);
 if(error)throw Error(error.code==='P0001'?error.message:'The pickup service is temporarily unavailable.');return data;
}
export async function syncReservationSession(session:Stripe.Checkout.Session){
 const stripe=stripeClient(),db=admin();
 const {data:order,error}=await db.from('payment_orders').select('*').eq('id',session.metadata?.orderId).single();
 if(error||!order.reservation_id||order.reservation_id!==session.metadata?.reservationId||order.buyer_id!==session.metadata?.buyerId)throw Error('Payment does not match the reservation.');
 const intent=typeof session.payment_intent==='string'?await stripe.paymentIntents.retrieve(session.payment_intent,{expand:['latest_charge']}):session.payment_intent;
 if(!intent)throw Error('Finish authorizing your card first.');
 const charge=intent.latest_charge as Stripe.Charge|null;
 const expiry=charge?.payment_method_details?.card?.capture_before;
 const updated=await rpc('sync_pickup_payment',{
  p_order:order.id,p_session:session.id,p_intent:intent.id,p_amount:intent.amount,p_currency:intent.currency,p_live:intent.livemode,
  p_state:intent.status,p_capture_before:expiry?new Date(expiry*1000).toISOString():null,
  p_paid_at:new Date((charge?.created||intent.created)*1000).toISOString(),p_refunded:charge?.amount_refunded||0
 });
 if(updated.status==='refund_required'){
  const refund=await stripe.refunds.create({payment_intent:intent.id},{idempotencyKey:`salvage-pickup-refund-${order.id}`});
  if(refund.status==='succeeded')await rpc('record_refund',{p_intent:intent.id,p_refunded:intent.amount});
 }
 if(charge?.amount_refunded)await rpc('record_refund',{p_intent:intent.id,p_refunded:charge.amount_refunded});
 const {data:p}=await db.from('pickup_reservations').select('*').eq('id',order.reservation_id).single();
 if(intent.status==='requires_capture'&&(!p||!['reserved','accepting'].includes(p.status)||Date.parse(p.deadline)<=Date.now())){
  await stripe.paymentIntents.cancel(intent.id,{}, {idempotencyKey:`salvage-release-${order.id}`});
  if(p&&['reserved','checkout'].includes(p.status))await rpc('end_pickup',{p_id:p.id,p_actor:null,p_reason:'expired'});
  const expired=await db.from('payment_orders').update({status:'expired',hold_released_at:new Date().toISOString()}).eq('id',order.id).in('status',['pending','authorized','expired']);if(expired.error)throw expired.error;
 }
 return {...updated,reservation_id:order.reservation_id};
}

export async function captureAcceptedPickup(id:string){
 const db=admin(),stripe=stripeClient();
 const {data:p,error}=await db.from('pickup_reservations').select('*').eq('id',id).single();
 if(error||!p.buyer_accepted_at||!['accepting','accepted','collected'].includes(p.status))throw Error('Inspect and accept the item first.');
 if(!p.amount_cents)return;
 const {data:o,error:oError}=await db.from('payment_orders').select('*').eq('reservation_id',id).single();
 if(oError||!o.stripe_session_id||!o.payment_intent_id)throw Error('Payment authorization is unavailable.');
 let intent=await stripe.paymentIntents.retrieve(o.payment_intent_id);
 if(intent.status==='requires_capture'){
  if(Date.parse(o.capture_before)<=Date.now()){
   await stripe.paymentIntents.cancel(intent.id);
  }else{
   intent=await stripe.paymentIntents.capture(intent.id,{amount_to_capture:Number(o.amount_cents)},{idempotencyKey:`salvage-inspected-${id}`});
  }
 }
 const session=await stripe.checkout.sessions.retrieve(o.stripe_session_id,{expand:['payment_intent.latest_charge']});
 await syncReservationSession(session);
}

export async function maintainPickups(){
 await rpc('expire_pickups');
 const db=admin();
 const {data:orders,error}=await db.from('payment_orders').select('*,pickup:pickup_reservations!inner(status)').not('reservation_id','is',null).is('hold_released_at',null).in('status',['pending','authorized','expired','refund_required']).in('pickup.status',['accepting','expired','cancelled','declined']).order('created_at').limit(30);
 if(error)throw Error('Could not reconcile reservations.');
 // Only reconcile work that needs an external payment action. Database expiry runs separately.
 for(const o of orders||[]){
  if(!o.stripe_session_id)continue;
  if(o.pickup.status==='accepting'){await captureAcceptedPickup(o.reservation_id);continue;}
  if(!['expired','cancelled','declined'].includes(o.pickup.status))continue;
  const stripe=stripeClient(),session=await stripe.checkout.sessions.retrieve(o.stripe_session_id,{expand:['payment_intent.latest_charge']});
  if(session.status==='open')await stripe.checkout.sessions.expire(session.id);
  const intent=session.payment_intent as Stripe.PaymentIntent|null;
  if(intent?.status==='requires_capture')await stripe.paymentIntents.cancel(intent.id,{}, {idempotencyKey:`salvage-release-${o.id}`});
  else if(intent?.status==='succeeded'){await syncReservationSession(session);continue;}
  const result=await db.from('payment_orders').update({status:'expired',hold_released_at:new Date().toISOString()}).eq('id',o.id).in('status',['pending','authorized','expired']);if(result.error)throw result.error;
 }
}
