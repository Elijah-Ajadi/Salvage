import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite();
try{
 await db.exec('create schema auth; create table auth.users(id uuid primary key); create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create role anon; create role authenticated; create role service_role;');
 for(const file of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')&&f<'202609110006').sort())await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
 const seller=crypto.randomUUID(),buyer=crypto.randomUUID(),other=crypto.randomUUID();
 for(const [id,role] of [[seller,'contractor'],[buyer,'buyer'],[other,'buyer']]){
  await db.query('insert into auth.users values($1)',[id]);
  await db.query("insert into users(id,role,name,email,address,lat,lng,radius) values($1,$2,'Test','test@example.test','Test',30,-97,20)",[id,role]);
 }
 const one=async(sql,args)=>(await db.query(sql,args)).rows[0];
 async function listing(price=150){const id=crypto.randomUUID();await db.query("insert into listings(id,photo,category,material,condition,title,description,address,lat,lng,posted_by,price) values($1,'photo','Doors','Wood','Good','Test','Test','Test',30,-97,$2,$3)",[id,seller,price]);return id;}
 const reserve=(id,b=buyer,live=false)=>one('select * from reserve_checkout($1,$2,$3)',[id,b,live]);
 const settle=(order,amount=15000,b=buyer)=>one('select * from settle_checkout($1,$2,$3,$4,$5,$6,$7,$8)',[order.id,'cs_'+order.id,'pi_'+order.id,amount,'usd',b,false,new Date().toISOString()]);
 const withdraw=(amount,key=crypto.randomUUID(),live=false)=>one('select * from request_withdrawal($1,$2,$3,$4,$5,$6,$7)',[seller,amount,'Demo','Sample account','',key,live]);
 const item=await listing();
 await assert.rejects(db.query('select * from claim_listing($1,$2)',[item,buyer]),/requires payment/);
 const attempts=await Promise.allSettled([reserve(item),reserve(item,other)]);
 assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1,'Only one competing checkout wins');
 const order=attempts[0].value;
 assert.equal((await reserve(item)).id,order.id,'Same buyer resumes same reservation');
 await assert.rejects(db.query("update listings set status='donated' where id=$1",[item]),/reserved or purchased/);
 await assert.rejects(settle(order,1),/does not match/);
 await assert.rejects(settle(order,15000,other),/does not match/);
 assert.equal((await settle(order)).status,'paid');
 assert.equal((await settle(order)).status,'paid');
 assert.equal((await one('select count(*)::int n from notifications where user_id=$1',[seller])).n,1,'Duplicate settlement sends one notification');
 await assert.rejects(db.query("update listings set status='donated' where id=$1",[item]),/reserved or purchased/);
 const withdrawalKey=crypto.randomUUID();
 assert.equal((await withdraw(80,withdrawalKey)).status,'paid','Test withdrawal completes as simulated');
 assert.equal((await withdraw(80,withdrawalKey)).request_key,withdrawalKey,'Withdrawal retry is idempotent');
 const withdrawals=await Promise.allSettled([withdraw(60),withdraw(60)]);
 assert.equal(withdrawals.filter(r=>r.status==='fulfilled').length,1,'Cannot spend the same balance twice');
 await assert.rejects(withdraw(1,crypto.randomUUID(),true),/exceeds/,'Test funds cannot fund live withdrawals');
 await assert.rejects(withdraw(0.001),/two decimal/);
 await db.query('select record_refund($1,$2)',['pi_'+order.id,5000]);
 await db.query('select record_refund($1,$2)',['pi_'+order.id,1000]);
 assert.equal(Number((await one('select refunded_cents from payment_orders where id=$1',[order.id])).refunded_cents),5000,'Out of order refunds cannot restore funds');
 await assert.rejects(withdraw(1),/exceeds/,'Refunds reduce spendable earnings');
 const next=await listing();const expired=await reserve(next);
 await db.query("update payment_orders set expires_at=now()-interval '1 second' where id=$1",[expired.id]);
 const replacement=await reserve(next,other);
 assert.notEqual(replacement.id,expired.id);
 assert.equal((await settle(expired)).status,'refund_required','Late payment must be refunded');
 assert.equal((await one('select status from listings where id=$1',[next])).status,'available');
 const free=await listing(0);
 assert.equal((await one('select * from claim_listing($1,$2)',[free,buyer])).status,'claimed');
 await assert.rejects(reserve(await listing(0)),/unavailable/);
 await db.exec('set role authenticated');
 await assert.rejects(db.query('select * from payment_orders'),/permission denied/);
 await assert.rejects(db.query('select * from request_withdrawal($1,1,$2,$3,$4,$5,false)',[seller,'test','test','',crypto.randomUUID()]),/permission denied/);
 await db.exec('reset role');
 console.log('PASS: all migrations, paid-claim prevention, competing/resumed/expired checkout, amount and buyer verification, duplicate settlement, donation guard, refund balances, withdrawal retries and overspending, separate test/live balances, private ledger.');
}catch(e){console.error(e.message);process.exitCode=1;}finally{await db.close();}
