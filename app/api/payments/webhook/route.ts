import {stripeClient,fulfillCheckout} from '@/lib/payments';
import {admin} from '@/lib/supabase/server';
import type Stripe from 'stripe';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(req:Request){
 const secret=process.env.STRIPE_WEBHOOK_SECRET;
 if(!secret)return Response.json({error:'Webhook not configured.'},{status:503});
 let event:Stripe.Event;
 try{event=stripeClient().webhooks.constructEvent(await req.text(),req.headers.get('stripe-signature')||'',secret);}
 catch{return Response.json({error:'Invalid webhook signature.'},{status:400});}
 try{
  if(event.type==='checkout.session.completed'||event.type==='checkout.session.async_payment_succeeded'){
   const session=event.data.object as Stripe.Checkout.Session;
   if(session.metadata?.orderId&&session.payment_status==='paid')await fulfillCheckout(session.id);
  }else if(event.type==='checkout.session.expired'){
   const session=event.data.object as Stripe.Checkout.Session;
   if(session.metadata?.orderId){
    const {error}=await admin().from('payment_orders').update({status:'expired'}).eq('id',session.metadata.orderId).eq('stripe_session_id',session.id).eq('status','pending');
    if(error)throw error;
   }
  }else if(event.type==='charge.refunded'){
   const charge=event.data.object as Stripe.Charge;
   const intent=typeof charge.payment_intent==='string'?charge.payment_intent:charge.payment_intent?.id;
   if(intent){const {error}=await admin().rpc('record_refund',{p_intent:intent,p_refunded:charge.amount_refunded});if(error)throw error;}
  }
  return Response.json({received:true});
 }catch{
  console.error('Stripe event processing failed; Stripe will retry.',event.id,event.type);
  return Response.json({error:'Please retry this event.'},{status:500});
 }
}
