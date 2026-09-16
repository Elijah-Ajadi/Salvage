// Opt-in service integration test. Creates and removes only its own test fixtures.
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import Stripe from 'stripe';
import {createRequire} from 'node:module';
import path from 'node:path';
if(!process.argv.includes('--run'))throw Error('Use --run to authorize temporary test fixtures in the configured Supabase project.');
if(!/^sk_test_|^rk_test_/.test(process.env.STRIPE_SECRET_KEY||''))throw Error('Integration tests require Stripe test mode.');
const base=process.env.TEST_APP_URL||'http://localhost:3001';
if(new URL(base).hostname!=='localhost')throw Error('Run against a local production build.');
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const stripe=new Stripe(process.env.STRIPE_SECRET_KEY,{maxNetworkRetries:2});
const users=[],listings=[],sessions=[];
const tag=crypto.randomUUID();
async function call(jar,route,body){
 const response=await fetch(base+route,{method:body?'POST':'GET',headers:{origin:base,'Content-Type':'application/json',cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')},body:body?JSON.stringify(body):undefined,redirect:'manual'});
 for(const c of response.headers.getSetCookie()){const pair=c.split(';')[0],i=pair.indexOf('=');jar.set(pair.slice(0,i),pair.slice(i+1));}
 const text=await response.text();let data;try{data=JSON.parse(text);}catch{data={};}
 return {status:response.status,data,redirect:response.headers.get('location')};
}
async function account(role,confirmed=true){
 const email=`salvage-test-${tag}-${users.length}@example.test`,password=crypto.randomUUID()+'Aa1!';
 const created=await db.auth.admin.createUser({email,password,email_confirm:confirmed,user_metadata:{role}});
 if(created.error)throw Error('Test account setup failed: '+created.error.code);
 users.push(created.data.user.id);const jar=new Map();
 const login=await call(jar,'/api/auth',{action:'login',email,password});
 if(!confirmed){assert.equal(login.status,401);assert.equal(login.data.verificationRequired,true);return;}
 assert.equal(login.status,200,'Normal verified login succeeds');
 const profile=await call(jar,'/api/salvage',{action:'profile',profile:{role,name:'Integration test',email,phone:'',address:'Test pickup',locatedAddress:'Test pickup',lat:30,lng:-97,radius:20,preferences:['Doors']}});
 assert.equal(profile.status,200,'Profile saves');return jar;
}
try{
 const seller=await account('contractor'),buyer=await account('buyer'),other=await account('buyer');await account('buyer',false);
 assert.equal((await call(new Map(),'/api/salvage')).status,200);
 assert.equal((await call(new Map(),'/api/pickups')).status,401);
 assert.equal((await call(buyer,'/contractor')).redirect,'/buyer');
 const require=createRequire(import.meta.url);
 const sharp=require(require.resolve('sharp',{paths:[path.dirname(require.resolve('next/package.json'))]}));
 const photo='data:image/jpeg;base64,'+(await sharp({create:{width:10,height:10,channels:3,background:'#385b2b'}}).jpeg().toBuffer()).toString('base64');
 async function publish(price){
  const result=await call(seller,'/api/salvage',{action:'publish',listing:{title:'Integration fixture '+tag,description:'Temporary automated test',category:'Doors',condition:'Good',material:'Wood',address:'Test pickup',locatedAddress:'Test pickup',lat:30,lng:-97,photo,price}});
  assert.equal(result.status,200,'Publish succeeds: '+JSON.stringify(result.data));listings.push(result.data.id);return result.data.id;
 }
 const reserve=async(jar,id)=>{const result=await call(jar,'/api/pickups',{action:'reserve',listingId:id,start:new Date(Date.now()+300000).toISOString(),end:new Date(Date.now()+3600000).toISOString()});assert.equal(result.status,200,'Reserve: '+JSON.stringify(result.data));return result.data.pickup;};
 const free=await publish(0),pickup=await reserve(buyer,free);
 assert.equal(pickup.status,'reserved');
 assert.equal((await call(other,'/api/pickups',{action:'reserve',listingId:free,start:pickup.pickup_start,end:pickup.pickup_end})).status,409);
 assert.equal((await call(other,'/api/pickups',{action:'waitlist',listingId:free})).status,200);
 assert.equal((await call(seller,'/api/pickups',{action:'collect',id:pickup.id})).status,409);
 assert.equal((await call(other,'/api/pickups',{action:'accept',id:pickup.id,inspected:true})).status,409);
 assert.equal((await call(buyer,'/api/pickups',{action:'accept',id:pickup.id,inspected:true})).status,409);
 assert.equal((await call(other,'/api/pickups',{action:'confirm-window',id:pickup.id})).status,409);
 assert.equal((await call(seller,'/api/pickups',{action:'confirm-window',id:pickup.id})).status,200);
 assert.equal((await call(buyer,'/api/pickups',{action:'accept',id:pickup.id,inspected:true})).status,200);
 assert.equal((await call(seller,'/api/pickups',{action:'collect',id:pickup.id})).status,200);
 const receipt=await call(buyer,'/api/payments?type=receipt&listingId='+free);assert.equal(receipt.status,200);assert.ok(receipt.data.receiptUrl);
 const outsider=await call(other,'/api/pickups?id='+pickup.id);assert.equal(outsider.data.pickups.length,0);
 assert.equal((await call(buyer,'/api/pickups',{action:'review',id:pickup.id,rating:5,comment:'Completed test pickup'})).status,200);
 assert.equal((await call(other,'/api/pickups',{action:'review',id:pickup.id,rating:1,comment:'Not participant'})).status,403);
 const paid=await publish(15);assert.equal((await call(buyer,'/api/salvage',{action:'claim',id:paid})).status,409);
 const paidPickup=await reserve(buyer,paid);
 const checkout=await call(buyer,'/api/payments',{action:'create-checkout',reservationId:paidPickup.id});assert.equal(checkout.status,200,'Checkout: '+JSON.stringify(checkout.data));assert.ok(checkout.data.url.startsWith('https://checkout.stripe.com/'));
 const {data:order,error}=await db.from('payment_orders').select('*').eq('reservation_id',paidPickup.id).single();if(error)throw error;sessions.push(order.stripe_session_id);
 const resumed=await call(buyer,'/api/payments',{action:'create-checkout',reservationId:paidPickup.id});assert.equal(resumed.data.url,checkout.data.url);
 assert.equal((await call(other,'/api/payments',{action:'create-checkout',reservationId:paidPickup.id})).status,409);
 assert.notEqual((await call(buyer,'/api/payments',{action:'verify-payment',sessionId:order.stripe_session_id})).status,200);
 assert.equal((await call(buyer,'/api/pickups',{action:'cancel',id:paidPickup.id})).status,200);
 assert.equal((await stripe.checkout.sessions.retrieve(order.stripe_session_id)).status,'expired');
 const next=await reserve(other,paid);assert.equal(next.status,'checkout');await call(other,'/api/pickups',{action:'cancel',id:next.id});
 assert.equal((await call(buyer,'/api/pickups',{action:'report',listingId:paid,reason:'misrepresented',details:'Test evidence of a listing mismatch'})).status,200);
 assert.equal((await call(buyer,'/api/pickups?reports=1')).data.admin,false);
 assert.equal((await call(buyer,'/api/pickups',{action:'review-report',id:crypto.randomUUID(),decision:'upheld',resolution:'Unauthorized test review'})).status,403);
 const earnings=await call(seller,'/api/payments?type=earnings');assert.equal(earnings.status,200);assert.equal(earnings.data.totalEarned,0);assert.equal(earnings.data.testMode,true);
 assert.equal((await call(seller,'/api/payments',{action:'request-payout',amount:15,paymentMethod:'Test',accountDetails:'Sample only',requestKey:crypto.randomUUID()})).status,409);
 const feed=await call(buyer,'/api/salvage');assert.ok(feed.data.items.some(i=>i.id===paid),'Nearby available listing reaches buyer feed');
 const signedOut=await call(buyer,'/api/auth',{action:'logout'});assert.equal(signedOut.status,200);
 assert.equal((await call(buyer,'/api/pickups')).status,401,'Logout removes authenticated access');
 assert.equal((await call(buyer,'/buyer')).redirect,'/login','Protected page redirects after logout');
 assert.equal((await call(buyer,'/login')).status,200,'Login page stays accessible after logout');
 console.log('PASS: auth/profile/photo storage, nearby feed, reservations, receipts, verified reviews, Stripe test checkout/cancellation, reporting, ledger protection, and logout/access removal.');
}catch(e){console.error('FAIL:',e.message);process.exitCode=1;}
finally{
 for(const id of sessions){try{const s=await stripe.checkout.sessions.retrieve(id);if(s.status==='open')await stripe.checkout.sessions.expire(id);}catch{}}
 let cleanupFailed=false;
 if(listings.length){
  const {data:pickups}=await db.from('pickup_reservations').select('id').in('listing_id',listings);if(pickups?.length){const {error}=await db.from('pickup_reviews').delete().in('reservation_id',pickups.map(p=>p.id));if(error)cleanupFailed=true;}
  for(const table of ['notifications','safety_reports','pickup_waitlist','payment_orders','pickup_reservations']){const {error}=await db.from(table).delete().in('listing_id',listings);if(error)cleanupFailed=true;}
  if((await db.from('listings').delete().in('id',listings)).error)cleanupFailed=true;
  if((await db.storage.from('listing-photos').remove(listings.map(id=>id+'.jpg'))).error)cleanupFailed=true;
 }
 for(const id of users){if((await db.auth.admin.deleteUser(id)).error)cleanupFailed=true;}
 if(cleanupFailed){console.error('Some temporary test fixtures need cleanup.');process.exitCode=1;}else console.log('Temporary test accounts, listings, and photos removed.');
}
