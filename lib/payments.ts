import 'server-only';
import Stripe from 'stripe';
import {admin} from './supabase/server';
import type {ReceiptData} from './receipt';

export function stripeClient() {
 const key=process.env.STRIPE_SECRET_KEY;
 if(!key) throw Error('Payments are not configured.');
 return new Stripe(key,{apiVersion:'2026-08-26.dahlia',maxNetworkRetries:2,timeout:15000});
}
export function paymentMode(){return !/^sk_test_|^rk_test_/.test(process.env.STRIPE_SECRET_KEY||'');}
export function appOrigin(){
 const value=process.env.NEXT_PUBLIC_APP_URL;
 if(!value)throw Error('Set NEXT_PUBLIC_APP_URL before accepting payments.');
 const url=new URL(value);
 if(url.protocol!=='https:'&&url.hostname!=='localhost')throw Error('Payments require an HTTPS app URL.');
 return url.origin;
}

// Webhooks and the authenticated return page share this idempotent path.
export async function fulfillCheckout(sessionId:string,buyerId?:string){
 const stripe=stripeClient(),db=admin();
 const session=await stripe.checkout.sessions.retrieve(sessionId,{expand:['payment_intent.latest_charge']});
 if(buyerId&&session.metadata?.buyerId!==buyerId)throw Error('This payment belongs to another account.');
 if(session.mode!=='payment'||session.payment_status!=='paid'||!session.metadata?.orderId)throw Error('Payment is not complete.');
 const intent=session.payment_intent as Stripe.PaymentIntent;
 if(!intent||typeof intent==='string'||intent.status!=='succeeded')throw Error('Payment is still processing.');
 const charge=intent.latest_charge as Stripe.Charge|null;
 const {data:order,error}=await db.rpc('settle_checkout',{
  p_order:session.metadata.orderId,p_session:session.id,p_intent:intent.id,p_amount:session.amount_total,
  p_currency:session.currency,p_buyer:session.metadata.buyerId,p_live:session.livemode,
  p_paid_at:new Date((charge?.created||intent.created)*1000).toISOString(),p_refunded:charge?.amount_refunded||0
 });
 if(error)throw Error('Could not record payment. Please retry from your payment history.');
 if(order.status==='refund_required'){
  const refund=await stripe.refunds.create({payment_intent:intent.id},{idempotencyKey:`salvage-conflict-${order.id}`});
  if(refund.status==='succeeded'){
   const result=await db.rpc('record_refund',{p_intent:intent.id,p_refunded:order.amount_cents});
   if(result.error)throw Error('Refund was issued; recording it will be retried.');
  }
  return {...order,status:refund.status==='succeeded'?'refunded':'refund_required'};
 }
 // A refund webhook can arrive before checkout completion.
 if(charge&&typeof charge!=='string'&&charge.amount_refunded>0){
  const result=await db.rpc('record_refund',{p_intent:intent.id,p_refunded:charge.amount_refunded});
  if(result.error)throw Error('Could not update the payment record.');
  return {...order,refunded_cents:charge.amount_refunded,status:charge.refunded?'refunded':order.status};
 }
 return order;
}

export async function receiptFor(listingId:string,buyerId:string):Promise<ReceiptData>{
 const db=admin();
 const {data:item,error}=await db.from('listings').select('*').eq('id',listingId).eq('claimed_by',buyerId).maybeSingle();
 if(error||!item)throw Error('This pickup is not assigned to your account.');
 const [{data:buyer,error:bError},{data:seller,error:sError},{data:order,error:oError}]=await Promise.all([
  db.from('users').select('name,email,phone').eq('id',buyerId).single(),
  db.from('users').select('name,email,phone').eq('id',item.posted_by).single(),
  db.from('payment_orders').select('*').eq('listing_id',listingId).eq('buyer_id',buyerId).eq('status','paid').maybeSingle()
 ]);
 if(bError||sError||oError)throw Error('Could not load receipt details.');
 if(Number(item.price)>0&&!order)throw Error('No completed payment exists for this item.');
 const paid=!!order;
 return {
  receiptNumber:paid?`REC-${order.id}`:`CLM-${item.id}`,type:paid?'purchase':'claim',
  date:new Date(order?.paid_at||item.claimed_at||item.created_at).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'}),
  item:{id:item.id,title:item.title,category:item.category,material:item.material,condition:item.condition,address:item.address},
  buyer:buyer!,seller:seller!,payment:{amount:paid?Number(order.amount_cents)/100:0,currency:order?.currency||'usd',
   method:paid?(order.livemode?'Card (Stripe)':'Stripe test payment — no real money'):'Free salvage claim',
   transactionId:order?.stripe_session_id,status:paid?(order.refunded_cents>0?'Partially refunded':order.livemode?'Completed':'Test payment'):'Confirmed',
   refundedAmount:paid?Number(order.refunded_cents)/100:0,test:paid&&!order.livemode}
 };
}
