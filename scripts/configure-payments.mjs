import Stripe from 'stripe';
import {readFile,writeFile} from 'node:fs/promises';
const key=process.env.STRIPE_SECRET_KEY;
if(!key)throw Error('STRIPE_SECRET_KEY is missing.');
if(!/^sk_test_|^rk_test_/.test(key))throw Error('This hackathon setup script only configures Stripe test mode.');
const origin=new URL(process.argv[2]||process.env.NEXT_PUBLIC_APP_URL||'https://salvage-six.vercel.app').origin;
if(!origin.startsWith('https://'))throw Error('Use your HTTPS deployment URL.');
const stripe=new Stripe(key,{maxNetworkRetries:2,timeout:15000});
const events=['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.expired','charge.refunded'];
try{
 const list=await stripe.webhookEndpoints.list({limit:100});
 const existing=list.data.find(e=>e.url===origin+'/api/payments/webhook');
 let secret=process.env.STRIPE_WEBHOOK_SECRET;
 if(existing){
  if(!secret)throw Error('Endpoint already exists. Copy its signing secret from Stripe into STRIPE_WEBHOOK_SECRET in .env, then rerun.');
  await stripe.webhookEndpoints.update(existing.id,{enabled_events:events,status:'enabled'});
 }else{
  const endpoint=await stripe.webhookEndpoints.create({url:origin+'/api/payments/webhook',enabled_events:events,description:'Salvage verified checkout and refunds'});
  secret=endpoint.secret;
 }
 if(!secret)throw Error('No signing secret was returned.');
 let env=await readFile('.env','utf8');
 for(const [name,value] of [['STRIPE_WEBHOOK_SECRET',secret],['NEXT_PUBLIC_APP_URL',origin]]){
  const pattern=new RegExp('^'+name+'=.*$','m');
  env=pattern.test(env)?env.replace(pattern,`${name}=${value}`):env+`\n${name}=${value}\n`;
 }
 await writeFile('.env',env);
 console.log('Stripe test webhook configured. Signing secret saved to .env without displaying it.');
 console.log('Add STRIPE_WEBHOOK_SECRET and NEXT_PUBLIC_APP_URL from .env to Vercel, then redeploy.');
}catch(e){console.error(e.message?.includes('Endpoint already exists')?e.message:'Stripe webhook setup failed. Check Stripe access and connectivity.');process.exitCode=1;}
