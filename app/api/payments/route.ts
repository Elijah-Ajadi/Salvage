import {getUser} from '@/lib/auth';
import {admin} from '@/lib/supabase/server';
import {bindings} from '@/lib/server';
import Stripe from 'stripe';

export const dynamic='force-dynamic';
export const runtime='nodejs';
function fail(message:string,status=400){return Response.json({error:message},{status});}

function stripe(){
  const key=bindings().STRIPE_SECRET_KEY;
  if(!key)throw new Error('Stripe is not configured.');
  return new Stripe(key,{apiVersion:'2026-08-26.dahlia'});
}

export async function GET(req:Request){
  try{
    const user=await getUser();
    if(!user)return fail('Log in to continue.',401);
    const db=admin();
    const {searchParams}=new URL(req.url);
    const type=searchParams.get('type');

    // Contractor earnings & payouts summary
    if(type==='earnings'){
      const {data:profile}=await db.from('users').select('role').eq('id',user.userId).maybeSingle();
      if(profile?.role!=='contractor')return fail('Contractor access only.',403);

      // Sold listings: posted by contractor, status is claimed, price > 0
      const {data:soldListings,error:sErr}=await db.from('listings')
        .select('id,title,category,material,condition,price,created_at,claimed_by,stripe_session_id')
        .eq('posted_by',user.userId)
        .eq('status','claimed');

      if(sErr)return fail('Could not load earnings data.',503);

      const paidListings=(soldListings||[]).filter(l=>Number(l.price)>0);
      const totalEarned=paidListings.reduce((sum,l)=>sum+Number(l.price||0),0);

      // Fetch payout requests
      const {data:payouts,error:pErr}=await db.from('payout_requests')
        .select('*')
        .eq('contractor_id',user.userId)
        .order('created_at',{ascending:false});

      if(pErr)return fail('Could not load payout requests.',503);

      const totalWithdrawn=(payouts||[])
        .filter(p=>p.status==='paid'||p.status==='approved')
        .reduce((sum,p)=>sum+Number(p.amount||0),0);

      const pendingWithdrawal=(payouts||[])
        .filter(p=>p.status==='pending')
        .reduce((sum,p)=>sum+Number(p.amount||0),0);

      const availableBalance=Math.max(0,Math.round((totalEarned-totalWithdrawn-pendingWithdrawal)*100)/100);

      // Attach buyer names to paid listings for history
      const buyerIds=[...new Set(paidListings.map(l=>l.claimed_by).filter(Boolean))];
      let buyersMap:Record<string,{name:string;email:string}>={};
      if(buyerIds.length){
        const {data:bData}=await db.from('users').select('id,name,email').in('id',buyerIds);
        (bData||[]).forEach(b=>{buyersMap[b.id]=b;});
      }

      const sales=paidListings.map(l=>({
        ...l,
        buyer:buyersMap[l.claimed_by]||{name:'Buyer',email:''}
      }));

      return Response.json({
        totalEarned,
        totalWithdrawn,
        pendingWithdrawal,
        availableBalance,
        sales,
        payouts:payouts||[]
      });
    }

    // Buyer payment & claim history
    if(type==='buyer-history'){
      const {data:claimed,error}=await db.from('listings')
        .select('id,title,category,material,condition,price,address,created_at,posted_by,stripe_session_id')
        .eq('claimed_by',user.userId)
        .order('created_at',{ascending:false});

      if(error)return fail('Could not load order history.',503);

      const contractorIds=[...new Set((claimed||[]).map(l=>l.posted_by).filter(Boolean))];
      let contractorsMap:Record<string,{name:string;email:string;phone:string}>={};
      if(contractorIds.length){
        const {data:cData}=await db.from('users').select('id,name,email,phone').in('id',contractorIds);
        (cData||[]).forEach(c=>{contractorsMap[c.id]=c;});
      }

      const history=(claimed||[]).map(l=>({
        ...l,
        seller:contractorsMap[l.posted_by]||{name:'Contractor',email:'',phone:''}
      }));

      return Response.json({history});
    }

    return fail('Invalid history type.');
  }catch(e:any){
    console.error('Payments GET error:',e);
    return fail(e.message||'Failed to load payment information.',500);
  }
}

export async function POST(req:Request){
  try{
    const user=await getUser();
    if(!user)return fail('Log in to continue.',401);
    const body=await req.json();
    const {action}=body;
    const db=admin();

    if(action==='create-checkout'){
      const {listingId}=body;
      if(!listingId||typeof listingId!=='string')return fail('Invalid listing.');

      // Fetch listing
      const {data:listing,error}=await db.from('listings').select('*').eq('id',listingId).eq('status','available').maybeSingle();
      if(error||!listing)return fail('Listing not found or already claimed.',404);
      if(listing.posted_by===user.userId)return fail('You cannot purchase your own listing.');
      const price=Number(listing.price)||0;
      if(price<=0)return fail('This listing is free — use the claim action instead.');

      // Fetch buyer profile
      const {data:buyer}=await db.from('users').select('name,email,role').eq('id',user.userId).maybeSingle();
      if(!buyer||buyer.role!=='buyer')return fail('A buyer account is required.',403);
      if(!user.emailVerified)return fail('Please verify your email address before purchasing.',403);

      const appUrl=process.env.NEXT_PUBLIC_APP_URL||'http://localhost:3000';
      const stripeClient=stripe();
      const session=await stripeClient.checkout.sessions.create({
        mode:'payment',
        payment_method_types:['card'],
        line_items:[{
          price_data:{
            currency:'usd',
            product_data:{
              name:listing.title,
              description:`${listing.category} · ${listing.condition} condition · Salvage material`,
              metadata:{listingId},
            },
            unit_amount:Math.round(price*100),
          },
          quantity:1,
        }],
        metadata:{listingId,buyerId:user.userId},
        success_url:`${appUrl}/buyer?payment=success&session={CHECKOUT_SESSION_ID}`,
        cancel_url:`${appUrl}/buyer?payment=cancelled`,
        customer_email:buyer.email,
      });

      // Store session id on listing temporarily
      await db.from('listings').update({stripe_session_id:session.id}).eq('id',listingId);
      return Response.json({url:session.url});
    }

    if(action==='verify-payment'){
      const {sessionId}=body;
      if(!sessionId||typeof sessionId!=='string')return fail('Invalid session.');
      const stripeClient=stripe();
      const session=await stripeClient.checkout.sessions.retrieve(sessionId);
      if(session.payment_status!=='paid')return fail('Payment not completed.',402);
      const listingId=session.metadata?.listingId;
      const buyerId=session.metadata?.buyerId;
      if(!listingId||!buyerId)return fail('Session metadata missing.',500);
      if(buyerId!==user.userId)return fail('Session mismatch.',403);

      // Check if already claimed
      const {data:existing}=await db.from('listings').select('*,posted_by').eq('id',listingId).maybeSingle();
      if(!existing)return fail('Listing not found.',404);
      
      let itemRecord=existing;
      if(existing.status==='available'){
        const {data,error}=await db.rpc('claim_listing',{listing_id:listingId,buyer_id:user.userId});
        if(error)return fail('Could not complete the claim.',409);
        itemRecord=data;
      }

      // Fetch seller info for receipt
      const {data:seller}=await db.from('users').select('name,email,phone').eq('id',existing.posted_by).maybeSingle();
      const {data:buyer}=await db.from('users').select('name,email,phone').eq('id',user.userId).maybeSingle();

      return Response.json({
        ok:true,
        item:itemRecord,
        receipt:{
          receiptNumber:`REC-${sessionId.slice(-8).toUpperCase()}`,
          type:'purchase',
          date:new Date().toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'}),
          item:{
            id:existing.id,
            title:existing.title,
            category:existing.category,
            material:existing.material,
            condition:existing.condition,
            address:existing.address
          },
          buyer:{
            name:buyer?.name||'Buyer',
            email:buyer?.email||user.email,
            phone:buyer?.phone||''
          },
          seller:{
            name:seller?.name||'Contractor',
            email:seller?.email||'',
            phone:seller?.phone||''
          },
          payment:{
            amount:Number(existing.price)||0,
            currency:'usd',
            method:'Credit / Debit Card (Stripe)',
            transactionId:sessionId,
            status:'Completed'
          }
        }
      });
    }

    // Contractor withdrawal request
    if(action==='request-payout'){
      const {amount,paymentMethod,accountDetails,notes}=body;
      const parsedAmount=Number(amount);
      if(!Number.isFinite(parsedAmount)||parsedAmount<=0){
        return fail('Please enter a valid withdrawal amount.');
      }
      if(!paymentMethod||typeof paymentMethod!=='string'||!paymentMethod.trim()){
        return fail('Please choose a withdrawal method (e.g., Bank Transfer, Stripe Payout, PayPal).');
      }
      if(!accountDetails||typeof accountDetails!=='string'||!accountDetails.trim()){
        return fail('Please enter your account details for withdrawal.');
      }

      // Verify contractor role
      const {data:contractor}=await db.from('users').select('role').eq('id',user.userId).maybeSingle();
      if(contractor?.role!=='contractor')return fail('Contractor accounts only.',403);

      // Verify available balance
      const {data:sold}=await db.from('listings').select('price').eq('posted_by',user.userId).eq('status','claimed');
      const totalEarned=(sold||[]).reduce((sum,l)=>sum+Number(l.price||0),0);

      const {data:payouts}=await db.from('payout_requests').select('amount,status').eq('contractor_id',user.userId);
      const withdrawnOrPending=(payouts||[])
        .filter(p=>p.status==='paid'||p.status==='approved'||p.status==='pending')
        .reduce((sum,p)=>sum+Number(p.amount||0),0);

      const availableBalance=Math.max(0,Math.round((totalEarned-withdrawnOrPending)*100)/100);

      if(parsedAmount>availableBalance){
        return fail(`Requested amount ($${parsedAmount.toFixed(2)}) exceeds available balance ($${availableBalance.toFixed(2)}).`);
      }

      const {data:payout,error:pErr}=await db.from('payout_requests').insert({
        contractor_id:user.userId,
        amount:parsedAmount,
        payment_method:paymentMethod.trim().slice(0,100),
        account_details:accountDetails.trim().slice(0,500),
        notes:typeof notes==='string'?notes.slice(0,500):null,
        status:'pending'
      }).select().single();

      if(pErr){
        console.error('Payout request error:',pErr);
        return fail('Failed to submit withdrawal request.',503);
      }

      return Response.json({ok:true,payout});
    }

    return fail('Unknown action.');
  }catch(e:any){
    console.error('Payments error:',e);
    return fail(e.message||'Payment processing failed. Please try again.',500);
  }
}
