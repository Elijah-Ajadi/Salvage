alter table users add column blocked_until timestamptz;
alter table users add column reservation_cooldown_until timestamptz;
alter table listings add column functionality text not null default 'Untested' check(functionality in ('Working — tested','Untested','Not working / parts only'));
alter table listings add column evidence_note text not null default '';
alter table listings add column evidence_photo text;
alter table listings add column under_review boolean not null default false;
alter table listings drop constraint listings_status_check;
alter table listings add constraint listings_status_check check(status in ('available','reserved','claimed','donated'));

create table pickup_reservations (
 id uuid primary key default gen_random_uuid(), listing_id uuid not null references listings(id),
 buyer_id uuid not null references users(id), contractor_id uuid not null references users(id),
 status text not null check(status in ('checkout','reserved','accepting','accepted','collected','cancelled','expired','declined')),
 pickup_start timestamptz not null, pickup_end timestamptz not null, deadline timestamptz not null,
 amount_cents bigint not null check(amount_cents>=0), item_title text not null, item_functionality text not null,
 created_at timestamptz not null default now(), buyer_accepted_at timestamptz, collected_at timestamptz,
 ended_at timestamptz, end_reason text, reminder_sent_at timestamptz,
 requested_end timestamptz, extension_status text check(extension_status in ('pending','approved','declined')),
 check(pickup_end>pickup_start)
);
create unique index one_active_pickup on pickup_reservations(listing_id) where status in ('checkout','reserved','accepting','accepted');
create index pickups_buyer on pickup_reservations(buyer_id,created_at desc);
create index pickups_deadline on pickup_reservations(deadline) where status in ('checkout','reserved');
alter table payment_orders add column reservation_id uuid unique references pickup_reservations(id);
alter table payment_orders add column capture_before timestamptz;
alter table payment_orders add column hold_released_at timestamptz;
alter table payment_orders add column earnings_released boolean not null default true;
alter table payment_orders drop constraint payment_orders_status_check;
alter table payment_orders add constraint payment_orders_status_check check(status in ('pending','authorized','expired','paid','refund_required','refunded'));

create table pickup_waitlist (
 id uuid primary key default gen_random_uuid(), listing_id uuid not null references listings(id),
 buyer_id uuid not null references users(id), created_at timestamptz not null default now(),
 notified_at timestamptz, unique(listing_id,buyer_id)
);
create table safety_reports (
 id uuid primary key default gen_random_uuid(), reporter_id uuid not null references users(id),
 target_id uuid not null references users(id), listing_id uuid not null references listings(id),
 reservation_id uuid references pickup_reservations(id),
 reason text not null check(reason in ('missing_item','misrepresented','unsafe','no_show','other')),
 details text not null check(length(details) between 10 and 2000),
 status text not null default 'open' check(status in ('open','upheld','dismissed')),
 created_at timestamptz not null default now(), reviewed_at timestamptz, reviewed_by uuid references users(id),
 resolution text, appeal text, appealed_at timestamptz
);
create table pickup_reviews (
 reservation_id uuid not null references pickup_reservations(id), author_id uuid not null references users(id),
 target_id uuid not null references users(id), rating integer not null check(rating between 1 and 5),
 comment text not null check(length(comment)<=1000), created_at timestamptz not null default now(),
 primary key(reservation_id,author_id)
);
alter table pickup_reservations enable row level security;
alter table pickup_waitlist enable row level security;
alter table safety_reports enable row level security;
alter table pickup_reviews enable row level security;
revoke all on pickup_reservations,pickup_waitlist,safety_reports,pickup_reviews from public,anon,authenticated;
grant all on pickup_reservations,pickup_waitlist,safety_reports,pickup_reviews to service_role;

create function notify_pickup(p pickup_reservations,message text) returns void language sql set search_path=public as $$
 insert into notifications(user_id,listing_id,message) values(p.buyer_id,p.listing_id,message),(p.contractor_id,p.listing_id,message);
$$;

create function end_pickup(p_id uuid,p_actor uuid,p_reason text) returns pickup_reservations language plpgsql set search_path=public as $$
declare p pickup_reservations; next_buyer uuid;
begin
 select * into p from pickup_reservations where id=p_id for update;
 if not found then raise exception 'Reservation not found'; end if;
 if p_actor is not null and p_actor not in (p.buyer_id,p.contractor_id) then raise exception 'Not your reservation'; end if;
 if p.status in ('cancelled','expired','declined') then return p; end if;
 if p.status not in ('checkout','reserved') then raise exception 'Payment or handover has started. Report the issue for review'; end if;
 if p_reason not in ('cancelled','expired','declined') then raise exception 'Invalid cancellation'; end if;
 if p_reason='expired' and p_actor is not null then raise exception 'Expiry is automatic'; end if;
 update pickup_reservations set status=p_reason,ended_at=now(),end_reason=case when status='checkout' then 'checkout_incomplete' else p_reason end where id=p_id returning * into p;
 update payment_orders set status='expired' where reservation_id=p_id and status in ('pending','authorized');
 update listings set status='available',claimed_by=null,claimed_at=null where id=p.listing_id and status='reserved' and claimed_by=p.buyer_id;
 perform notify_pickup(p,p.item_title||': reservation '||p_reason||'. Check your pickup receipt for the latest status.');
 -- Notify the next waiting buyer without giving them an indefinite exclusive hold.
 select buyer_id into next_buyer from pickup_waitlist where listing_id=p.listing_id and notified_at is null order by created_at limit 1 for update skip locked;
 if next_buyer is not null then
  update pickup_waitlist set notified_at=now() where listing_id=p.listing_id and buyer_id=next_buyer;
  insert into notifications(user_id,listing_id,message) values(next_buyer,p.listing_id,p.item_title||' is available again. Choose a pickup window to reserve it.');
 end if;
 return p;
end $$;

create function expire_pickups() returns integer language plpgsql set search_path=public as $$
declare p pickup_reservations; n integer:=0;
begin
 for p in select * from pickup_reservations where status in ('checkout','reserved') and deadline<=now() order by deadline limit 200 for update skip locked loop
  perform end_pickup(p.id,null,'expired');n:=n+1;
 end loop;
 for p in select * from pickup_reservations where status='reserved' and reminder_sent_at is null and pickup_start<=now()+interval '1 hour' and deadline>now() limit 200 for update skip locked loop
  perform notify_pickup(p,p.item_title||': pickup is due soon. Open your receipt to confirm, cancel, or request more time.');
  update pickup_reservations set reminder_sent_at=now() where id=p.id;
 end loop;
 return n;
end $$;

create function reserve_pickup(p_listing uuid,p_buyer uuid,p_start timestamptz,p_end timestamptz,p_live boolean) returns pickup_reservations language plpgsql set search_path=public as $$
declare item listings; buyer users; p pickup_reservations;
begin
 -- Serialize reservation limits for each buyer before locking a listing.
 select * into buyer from users where id=p_buyer and role='buyer' for update;
 if not found then raise exception 'A buyer account is required'; end if;
 if buyer.blocked_until>now() or buyer.reservation_cooldown_until>now() then raise exception 'Reservations are temporarily restricted. Check your reports and appeals'; end if;
 if p_start is null or p_end is null or not isfinite(p_start) or not isfinite(p_end) or p_start<now()-interval '5 minutes' or p_start>now()+interval '72 hours' or p_end<=p_start or p_end>p_start+interval '4 hours' then raise exception 'Choose a future pickup window within 72 hours, lasting at most 4 hours'; end if;
 select * into item from listings where id=p_listing for update;
 if not found or item.posted_by=p_buyer or item.under_review or exists(select 1 from users where id=item.posted_by and blocked_until>now()) then raise exception 'Listing unavailable'; end if;
 select * into p from pickup_reservations where listing_id=p_listing and status in ('checkout','reserved','accepting','accepted');
 if found then
  if p.buyer_id=p_buyer then return p; end if;
  raise exception 'Another buyer has reserved this item. Join the waitlist';
 end if;
 if item.status<>'available' then raise exception 'Listing unavailable'; end if;
 if (select count(*) from pickup_reservations where buyer_id=p_buyer and status in ('checkout','reserved','accepting','accepted'))>=2 then raise exception 'You can hold two active reservations. Complete or cancel one first'; end if;
 if exists(select 1 from payment_orders where listing_id=p_listing and status='pending' and expires_at>now()) then raise exception 'Checkout already in progress'; end if;
 insert into pickup_reservations(listing_id,buyer_id,contractor_id,status,pickup_start,pickup_end,deadline,amount_cents,item_title,item_functionality)
 values(p_listing,p_buyer,item.posted_by,case when coalesce(item.price,0)>0 then 'checkout' else 'reserved' end,p_start,p_end,
 case when coalesce(item.price,0)>0 then now()+interval '40 minutes' else p_end+interval '30 minutes' end,round(coalesce(item.price,0)*100)::bigint,item.title,item.functionality) returning * into p;
 update listings set status='reserved',claimed_by=p_buyer where id=p_listing;
 if p.amount_cents>0 then
  insert into payment_orders(listing_id,buyer_id,contractor_id,amount_cents,livemode,reservation_id,earnings_released)
  values(p_listing,p_buyer,item.posted_by,p.amount_cents,p_live,p.id,false);
 end if;
 perform notify_pickup(p,item.title||': pickup reserved. Open the receipt to see the pickup window.');
 return p;
end $$;

create function sync_pickup_payment(p_order uuid,p_session text,p_intent text,p_amount bigint,p_currency text,p_live boolean,p_state text,p_capture_before timestamptz,p_paid_at timestamptz,p_refunded bigint default 0)
returns payment_orders language plpgsql set search_path=public as $$
declare o payment_orders; p pickup_reservations;
begin
 select * into o from payment_orders where id=p_order;
 if not found or o.reservation_id is null then raise exception 'Unknown reservation payment'; end if;
 perform 1 from users where id=o.contractor_id for update;
 select * into p from pickup_reservations where id=o.reservation_id for update;
 select * into o from payment_orders where id=p_order for update;
 if o.amount_cents<>p_amount or o.currency<>p_currency or o.livemode<>p_live or (o.stripe_session_id is not null and o.stripe_session_id<>p_session) or (o.payment_intent_id is not null and o.payment_intent_id<>p_intent) then raise exception 'Payment does not match reservation'; end if;
 if o.status in ('paid','refunded','refund_required') then return o; end if;
 update payment_orders set stripe_session_id=p_session,payment_intent_id=p_intent where id=p_order;
 if p_state='requires_capture' then
  if p.status not in ('checkout','reserved','accepting') or p.deadline<=now() or p_capture_before is null or p_capture_before<=now()+interval '5 minutes' then return o; end if;
  update payment_orders set status='authorized',capture_before=p_capture_before where id=p_order returning * into o;
  update pickup_reservations set status=case when status='accepting' then status else 'reserved' end,
   deadline=least(pickup_end+interval '30 minutes',p_capture_before-interval '5 minutes') where id=p.id;
 elsif p_state='succeeded' then
  if p.buyer_accepted_at is null or p.status not in ('accepting','accepted','collected') then
   update payment_orders set status='refund_required',paid_at=p_paid_at where id=p_order returning * into o;return o;
  end if;
  update payment_orders set status=case when p_refunded>=amount_cents then 'refunded' else 'paid' end,paid_at=p_paid_at,refunded_cents=least(amount_cents,greatest(0,p_refunded)) where id=p_order returning * into o;
  if p.status='accepting' then
   update pickup_reservations set status='accepted' where id=p.id;
   perform notify_pickup(p,p.item_title||': payment confirmed. Contractor can now confirm handover on the receipt.');
  end if;
 elsif p_state='canceled' then
  update payment_orders set status='expired' where id=p_order returning * into o;
  if p.status='accepting' then update pickup_reservations set status='reserved',buyer_accepted_at=null where id=p.id; end if;
  if p.status in ('checkout','reserved','accepting') then perform end_pickup(p.id,null,'expired'); end if;
 end if;
 return o;
end $$;

create function accept_pickup(p_id uuid,p_buyer uuid) returns pickup_reservations language plpgsql set search_path=public as $$
declare p pickup_reservations;
begin
 select * into p from pickup_reservations where id=p_id and buyer_id=p_buyer for update;
 if not found then raise exception 'Not your receipt'; end if;
 if p.status in ('accepting','accepted','collected') then return p; end if;
 if p.status<>'reserved' or p.deadline<=now() or now()<p.pickup_start-interval '15 minutes' then raise exception 'Accept the item during the pickup window after inspecting it'; end if;
 if p.amount_cents>0 and not exists(select 1 from payment_orders where reservation_id=p_id and status='authorized' and capture_before>now()+interval '5 minutes') then raise exception 'Card authorization unavailable or expired'; end if;
 update pickup_reservations set buyer_accepted_at=now(),status=case when amount_cents>0 then 'accepting' else 'accepted' end where id=p_id returning * into p;
 if p.amount_cents=0 then perform notify_pickup(p,p.item_title||': buyer accepted the item. Confirm handover on the receipt.');end if;
 return p;
end $$;

create function collect_pickup(p_id uuid,p_contractor uuid) returns pickup_reservations language plpgsql set search_path=public as $$
declare p pickup_reservations;
begin
 perform 1 from users where id=p_contractor for update;
 select * into p from pickup_reservations where id=p_id and contractor_id=p_contractor for update;
 if not found then raise exception 'Not your receipt'; end if;
 if p.status='collected' then return p; end if;
 if p.status<>'accepted' or p.buyer_accepted_at is null then raise exception 'Wait for the buyer to inspect and accept the item'; end if;
 if p.amount_cents>0 and not exists(select 1 from payment_orders where reservation_id=p_id and status='paid' and refunded_cents=0) then raise exception 'Payment is not confirmed'; end if;
 update pickup_reservations set status='collected',collected_at=now() where id=p_id returning * into p;
 update listings set status='claimed',claimed_by=p.buyer_id,claimed_at=(extract(epoch from now())*1000)::bigint where id=p.listing_id;
 update payment_orders set earnings_released=true where reservation_id=p_id;
 perform notify_pickup(p,p.item_title||': collection completed. Your receipt now records the handover.');
 return p;
end $$;

create function extend_pickup(p_id uuid,p_actor uuid,p_end timestamptz,p_approve boolean default null) returns pickup_reservations language plpgsql set search_path=public as $$
declare p pickup_reservations; auth_end timestamptz;
begin
 select * into p from pickup_reservations where id=p_id for update;
 if not found or p.status<>'reserved' or p.deadline<=now() then raise exception 'Reservation cannot be extended'; end if;
 if p_approve is null then
  if p_actor<>p.buyer_id or p_end is null or not isfinite(p_end) or p_end<=p.pickup_end or p_end>p.created_at+interval '76 hours' then raise exception 'Choose an extension within three days of reserving'; end if;
  select capture_before into auth_end from payment_orders where reservation_id=p_id;
  if auth_end is not null and p_end+interval '30 minutes'>auth_end-interval '5 minutes' then raise exception 'Extension would exceed the card authorization'; end if;
  update pickup_reservations set requested_end=p_end,extension_status='pending' where id=p_id returning * into p;
 else
  if p_actor<>p.contractor_id or p.extension_status<>'pending' then raise exception 'Only the contractor can decide this extension'; end if;
  select capture_before into auth_end from payment_orders where reservation_id=p_id;
  if p_approve and (p.requested_end<=now() or (auth_end is not null and p.requested_end+interval '30 minutes'>auth_end-interval '5 minutes')) then raise exception 'Extension is no longer possible'; end if;
  update pickup_reservations set extension_status=case when p_approve then 'approved' else 'declined' end,
   pickup_end=case when p_approve then requested_end else pickup_end end,
   deadline=case when p_approve then requested_end+interval '30 minutes' else deadline end,
   reminder_sent_at=case when p_approve then null else reminder_sent_at end where id=p_id returning * into p;
 end if;
 perform notify_pickup(p,p.item_title||': pickup extension '||p.extension_status||'. Check the receipt.');return p;
end $$;

-- Old clients must not bypass pickup windows and limits.
create or replace function claim_listing(listing_id uuid,buyer_id uuid) returns listings language plpgsql as $$ begin raise exception 'Choose a pickup window to reserve this item'; end $$;
create or replace function reserve_checkout(p_listing uuid,p_buyer uuid,p_live boolean) returns payment_orders language plpgsql as $$ begin raise exception 'Choose a pickup window to reserve this item'; end $$;
create or replace function protect_purchase() returns trigger language plpgsql set search_path=public as $$
begin
 if new.status='donated' and (old.status='reserved' or exists(select 1 from payment_orders where listing_id=old.id and status in ('paid','authorized'))) then raise exception 'Reserved or purchased items cannot be donated';end if;return new;
end $$;

-- Keep unsettled handovers out of withdrawable earnings, including at the database boundary.
do $$ declare definition text; begin
 select pg_get_functiondef('public.request_withdrawal(uuid,numeric,text,text,text,uuid,boolean)'::regprocedure) into definition;
 definition:=replace(definition,'and status=''paid'' and livemode=p_live','and status=''paid'' and earnings_released and livemode=p_live');
 execute definition;
end $$;

create function review_safety_report(p_id uuid,p_admin uuid,p_decision text,p_resolution text) returns void language plpgsql set search_path=public as $$
declare r safety_reports; strikes integer;
begin
 if p_decision not in ('upheld','dismissed') or length(trim(p_resolution))<5 then raise exception 'Add a decision and explanation';end if;
 select * into r from safety_reports where id=p_id for update;
 if not found then raise exception 'Report not found';end if;
 if p_admin in (r.reporter_id,r.target_id) then raise exception 'You cannot review your own dispute';end if;
 update safety_reports set status=p_decision,resolution=left(p_resolution,2000),reviewed_at=now(),reviewed_by=p_admin where id=p_id;
 select count(distinct reservation_id) into strikes from safety_reports where target_id=r.target_id and reason='no_show' and status='upheld' and created_at>now()-interval '30 days';
 update users set reservation_cooldown_until=case when strikes>=2 then now()+interval '48 hours' else null end where id=r.target_id;
 if r.reason in ('missing_item','misrepresented','unsafe') then
  update listings set under_review=exists(select 1 from safety_reports where listing_id=r.listing_id and status='upheld' and reason in ('missing_item','misrepresented','unsafe')) where id=r.listing_id;
 end if;
 insert into notifications(user_id,listing_id,message) values(r.reporter_id,r.listing_id,'Report reviewed: '||p_decision||'. View reports for the explanation.'),(r.target_id,r.listing_id,'A report involving your account was reviewed. You can view the explanation and appeal.');
end $$;

revoke all on function notify_pickup(pickup_reservations,text),end_pickup(uuid,uuid,text),expire_pickups(),reserve_pickup(uuid,uuid,timestamptz,timestamptz,boolean),sync_pickup_payment(uuid,text,text,bigint,text,boolean,text,timestamptz,timestamptz,bigint),accept_pickup(uuid,uuid),collect_pickup(uuid,uuid),extend_pickup(uuid,uuid,timestamptz,boolean),review_safety_report(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function notify_pickup(pickup_reservations,text),end_pickup(uuid,uuid,text),expire_pickups(),reserve_pickup(uuid,uuid,timestamptz,timestamptz,boolean),sync_pickup_payment(uuid,text,text,bigint,text,boolean,text,timestamptz,timestamptz,bigint),accept_pickup(uuid,uuid),collect_pickup(uuid,uuid),extend_pickup(uuid,uuid,timestamptz,boolean),review_safety_report(uuid,uuid,text,text) to service_role;
