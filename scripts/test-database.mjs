import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite();
try{
 await db.exec(`create schema auth; create table auth.users(id uuid primary key); create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create role anon; create role authenticated; create role service_role;`);
 await db.exec(await readFile('supabase/migrations/202609090001_salvage.sql','utf8'));
 await db.exec(await readFile('supabase/migrations/202609090002_optional_profile_coordinates.sql','utf8'));
 const ids=Array.from({length:5},()=>crypto.randomUUID());
 for(const [n,id] of ids.entries()){
  await db.query('insert into auth.users values($1)',[id]);
  await db.query('insert into public.users values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[id,n===0?'contractor':'buyer','Person '+n,`person${n}@example.test`,'','Austin',n===4?40:30,-97,20,JSON.stringify(n===3?['Fixtures']:['Doors'])]);
 }
 const listing=crypto.randomUUID();
 await db.query('update public.users set lat=null,lng=null where id=$1',[ids[4]]);
 assert.equal((await db.query('select lat from public.users where id=$1',[ids[4]])).rows[0].lat,null,'Profiles can save when address lookup is unavailable');
 await assert.rejects(db.query('update public.users set lat=30 where id=$1',[ids[4]]),/users_coordinates_pair/);
 await db.query(`insert into public.listings(id,photo,category,material,condition,title,description,address,lat,lng,posted_by) values($1,'photo','Doors','Wood','Good','Door','A door','Private address',30,-97,$2)`,[listing,ids[0]]);
 assert.equal((await db.query('select count(*)::int n from notifications')).rows[0].n,2,'Only nearby buyers with matching preferences are alerted');
 await assert.rejects(db.query("update public.users set role='buyer' where id=$1",[ids[0]]),/roles cannot be changed/);
 const claimed=await db.query('select * from public.claim_listing($1,$2)',[listing,ids[1]]);
 assert.equal(claimed.rows[0].claimed_by,ids[1]);
 await assert.rejects(db.query('select * from public.claim_listing($1,$2)',[listing,ids[2]]),/already been claimed/);
 await assert.rejects(db.query('select * from public.claim_listing($1,$2)',[listing,ids[0]]),/buyer account/);
 assert.equal((await db.query('select count(*)::int n from notifications where user_id=$1',[ids[0]])).rows[0].n,1);
 assert.equal((await db.query("select count(*)::int n from listings where status='available'")).rows[0].n,0);
 await db.exec('set role authenticated');
 await assert.rejects(db.query('select address from public.listings'),/permission denied/);
 await assert.rejects(db.query('select * from public.claim_listing($1,$2)',[listing,ids[2]]),/permission denied/);
 await db.exec('reset role');
 assert.equal((await db.query("select public from storage.buckets where id='listing-photos'")).rows[0].public,false);
 console.log('PASS: migration, immutable roles, category/radius matching, single-winner claims, atomic alerts, direct-data denial, private photo bucket.');
}finally{await db.close();}
