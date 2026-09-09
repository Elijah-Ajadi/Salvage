import {getUser} from '@/lib/auth';
import {admin} from '@/lib/supabase/server';
import {stripeClient,paymentMode,appOrigin,fulfillCheckout,receiptFor} from '@/lib/payments';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=60;
const fail=(error:string,status=400)=>Response.json({error},{status});
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export async function GET(req:Request){try{
 const user=await getUser();if(!user)return fail('Log in to continue.',401);
 const db=admin(),type=new URL(req.url).searchParams.get('type');
 if(type==='receipt'){
  const id=new URL(req.url).searchParams.get('listingId');
  if(!uuid(id))return fail('Invalid listing.');
  return Response.json({receipt:await receiptFor(id,user.userId)});
 }
 if(type==='earnings'){
  const {data:profile,error}=await db.from('users').select('role').eq('id',user.userId).maybeSingle();
  if(error)throw error;if(profile?.role!=='contractor')return fail('Contractor access only.',403);
  const live=paymentMode();
  const [o,p]=await Promise.all([
   db.from('payment_orders').select('*,listing:listings(id,title,category,material,condition),buyer:users!payment_orders_buyer_id_fkey(name,email)').eq('contractor_id',user.userId).eq('livemode',live).eq('status','paid'),
   db.from('payout_requests').select('*').eq('contractor_id',user.userId).eq('livemode',live).order('created_at',{ascending:false})
  ]);
  if(o.error||p.error)throw Error('Could not load earnings.');
  const totalEarned=(o.data||[]).reduce((s,o)=>s+(Number(o.amount_cents)-Number(o.refunded_cents))/100,0);
  const totalWithdrawn=(p.data||[]).filter(p=>p.status==='paid').reduce((s,p)=>s+Number(p.amount),0);
  const pendingWithdrawal=(p.data||[]).filter(p=>['pending','approved'].includes(p.status)).reduce((s,p)=>s+Number(p.amount),0);
  return Response.json({totalEarned,totalWithdrawn,pendingWithdrawal,availableBalance:Math.max(0,Math.round((totalEarned-totalWithdrawn-pendingWithdrawal)*100)/100),
   testMode:!live,sales:(o.data||[]).map(o=>({...o.listing,price:(Number(o.amount_cents)-Number(o.refunded_cents))/100,created_at:Date.parse(o.paid_at),buyer:o.buyer})),payouts:p.data||[]});
 }
 if(type==='buyer-history'){
  const {data,error}=await db.from('listings').select('id,title,category,material,condition,price,address,created_at,claimed_at,posted_by,stripe_session_id,seller:users!listings_posted_by_fkey(name,email,phone)').eq('claimed_by',user.userId).order('claimed_at',{ascending:false});
  if(error)throw error;return Response.json({history:data||[]});
 }
 return fail('Invalid history type.');
}catch{return fail('Could not load payment information. Please try again.',503);}}

export async function POST(req:Request){try{
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return fail('Invalid request origin.',403);
 const user=await getUser();if(!user)return fail('Log in to continue.',401);
 const body=await req.json(),db=admin();
 if(body.action==='create-checkout'){
  if(!uuid(body.listingId))return fail('Invalid listing.');
  if(!user.emailVerified)return fail('Verify your email before purchasing.',403);
  if(!process.env.STRIPE_WEBHOOK_SECRET)return fail('Payments are being configured. Please try again shortly.',503);
  const stripe=stripeClient(),base=appOrigin();
  const {data:order,error}=await db.rpc('reserve_checkout',{p_listing:body.listingId,p_buyer:user.userId,p_live:paymentMode()});
  if(error)return fail('This listing is unavailable or another buyer is checking out. Please try again later.',409);
  if(order.stripe_session_id){
   const existing=await stripe.checkout.sessions.retrieve(order.stripe_session_id);
   if(existing.status==='open')return Response.json({url:existing.url});
   if(existing.payment_status==='paid')return Response.json({url:`${base}/buyer?payment=success&session=${existing.id}`});
   const updated=await db.from('payment_orders').update({status:'expired'}).eq('id',order.id).eq('status','pending');
   if(updated.error)throw updated.error;
   return fail('Checkout expired. Tap Buy again to start a new checkout.',409);
  }
  const {data:item,error:itemError}=await db.from('listings').select('title').eq('id',body.listingId).single();
  if(itemError)throw itemError;
  const expires=Math.floor(Date.parse(order.expires_at)/1000)-300;
  if(expires<Date.now()/1000+1800)return fail('Checkout is being prepared or has expired. Please try again after this reservation ends.',409);
  const session=await stripe.checkout.sessions.create({mode:'payment',payment_method_types:['card'],
   line_items:[{price_data:{currency:'usd',product_data:{name:item.title},unit_amount:Number(order.amount_cents)},quantity:1}],
   metadata:{orderId:order.id,listingId:body.listingId,buyerId:user.userId},expires_at:expires,
   success_url:`${base}/buyer?payment=success&session={CHECKOUT_SESSION_ID}`,cancel_url:`${base}/buyer?payment=cancelled&order=${order.id}`,
   customer_email:user.email},{idempotencyKey:`salvage-checkout-${order.id}`});
  const saved=await db.from('payment_orders').update({stripe_session_id:session.id}).eq('id',order.id).eq('status','pending');
  if(saved.error)throw saved.error;
  return Response.json({url:session.url});
 }
 if(body.action==='cancel-checkout'){
  if(!uuid(body.orderId))return fail('Invalid checkout.');
  const {data:order,error}=await db.from('payment_orders').select('stripe_session_id').eq('id',body.orderId).eq('buyer_id',user.userId).single();
  if(error||!order.stripe_session_id)return fail('Checkout not found.',404);
  const stripe=stripeClient(),session=await stripe.checkout.sessions.retrieve(order.stripe_session_id);
  if(session.metadata?.buyerId!==user.userId)return fail('This checkout belongs to another account.',403);
  if(session.status==='open')await stripe.checkout.sessions.expire(session.id);
  if(session.payment_status==='paid')return fail('Payment completed. Open your payment history.',409);
  const updated=await db.from('payment_orders').update({status:'expired'}).eq('stripe_session_id',session.id).eq('buyer_id',user.userId).eq('status','pending');
  if(updated.error)throw updated.error;return Response.json({ok:true});
 }
 if(body.action==='verify-payment'){
  if(typeof body.sessionId!=='string'||!body.sessionId.startsWith('cs_'))return fail('Invalid session.');
  const order=await fulfillCheckout(body.sessionId,user.userId);
  if(order.status!=='paid')return fail('This purchase could not be assigned to you. Your payment has been refunded or is awaiting refund.',409);
  return Response.json({ok:true,receipt:await receiptFor(order.listing_id,user.userId)});
 }
 if(body.action==='request-payout'){
  const {amount,paymentMethod,accountDetails,notes,requestKey}=body;
  if(!user.emailVerified)return fail('Verify your email before requesting a withdrawal.',403);
  if(!uuid(requestKey)||!Number.isFinite(Number(amount))||Number(amount)<=0||typeof paymentMethod!=='string'||!paymentMethod.trim()||typeof accountDetails!=='string'||!accountDetails.trim())return fail('Enter a valid amount and withdrawal details.');
  const {data:payout,error}=await db.rpc('request_withdrawal',{p_contractor:user.userId,p_amount:Number(amount),p_method:paymentMethod.trim().slice(0,100),p_details:accountDetails.trim().slice(0,500),p_notes:typeof notes==='string'?notes.slice(0,500):'',p_key:requestKey,p_live:paymentMode()});
  if(error)return fail('Withdrawal could not be submitted. Check your available balance and enter an amount with at most two decimal places.',409);
  return Response.json({ok:true,payout,testMode:!payout.livemode});
 }
 return fail('Unknown action.');
}catch{return fail('Could not complete the payment request. Please try again.',503);}}
