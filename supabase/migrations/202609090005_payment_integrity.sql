-- Payment records are authoritative; legacy claimed listings are not proof of payment.
create table public.payment_orders (
 id uuid primary key default gen_random_uuid(),
 listing_id uuid not null references public.listings(id),
 buyer_id uuid not null references public.users(id),
 contractor_id uuid not null references public.users(id),
 amount_cents bigint not null check(amount_cents > 0), currency text not null default 'usd' check(currency='usd'),
 livemode boolean not null,
 status text not null default 'pending' check(status in ('pending','expired','paid','refund_required','refunded')),
 stripe_session_id text unique, payment_intent_id text unique,
 refunded_cents bigint not null default 0 check(refunded_cents >= 0 and refunded_cents <= amount_cents),
 created_at timestamptz not null default now(), expires_at timestamptz not null default (now()+interval '40 minutes'),
 paid_at timestamptz
);
create unique index one_pending_checkout on public.payment_orders(listing_id) where status='pending';
create index payment_orders_seller on public.payment_orders(contractor_id);
alter table public.payment_orders enable row level security;
revoke all on public.payment_orders from public,anon,authenticated;
grant all on public.payment_orders to service_role;
alter table public.payout_requests add column livemode boolean not null default true;
alter table public.payout_requests add column request_key uuid unique;
alter table public.listings add column claimed_at bigint;

create or replace function public.claim_listing(listing_id uuid,buyer_id uuid) returns public.listings language plpgsql set search_path=public as $$
declare claimed public.listings; buyer public.users;
begin
 select * into buyer from users where id=buyer_id and role='buyer';
 if not found then raise exception 'A buyer account is required'; end if;
 update listings set status='claimed',claimed_by=buyer_id,claimed_at=(extract(epoch from clock_timestamp())*1000)::bigint
 where id=listing_id and status='available' and coalesce(price,0)=0 and posted_by<>buyer_id returning * into claimed;
 if not found then raise exception 'This item requires payment, has already been claimed or is unavailable'; end if;
 insert into notifications(user_id,listing_id,message) values(claimed.posted_by,claimed.id,buyer.name||' claimed '||claimed.title||'. Contact: '||buyer.email||' '||buyer.phone);
 return claimed;
end $$;

create function public.reserve_checkout(p_listing uuid,p_buyer uuid,p_live boolean) returns public.payment_orders language plpgsql set search_path=public as $$
declare item listings; reservation payment_orders;
begin
 if not exists(select 1 from users where id=p_buyer and role='buyer') then raise exception 'A buyer account is required'; end if;
 select * into item from listings where id=p_listing for update;
 if not found or item.status<>'available' or coalesce(item.price,0)<=0 or item.posted_by=p_buyer then raise exception 'Listing unavailable for purchase'; end if;
 update payment_orders set status='expired' where listing_id=p_listing and status='pending' and expires_at<=now();
 select * into reservation from payment_orders where listing_id=p_listing and status='pending';
 if found then
  if reservation.buyer_id=p_buyer and reservation.livemode=p_live then return reservation; end if;
  raise exception 'Another buyer is checking out. Please try again later';
 end if;
 insert into payment_orders(listing_id,buyer_id,contractor_id,amount_cents,livemode)
 values(p_listing,p_buyer,item.posted_by,round(item.price*100)::bigint,p_live) returning * into reservation;
 return reservation;
end $$;

create function public.settle_checkout(p_order uuid,p_session text,p_intent text,p_amount bigint,p_currency text,p_buyer uuid,p_live boolean,p_paid_at timestamptz,p_refunded bigint default 0)
returns public.payment_orders language plpgsql set search_path=public as $$
declare entry payment_orders; item listings; seller uuid; buyer users;
begin
 select contractor_id into seller from payment_orders where id=p_order;
 perform 1 from users where id=seller for update;
 select * into entry from payment_orders where id=p_order;
 if not found then raise exception 'Unknown payment order'; end if;
 select * into item from listings where id=entry.listing_id for update;
 select * into entry from payment_orders where id=p_order for update;
 if entry.buyer_id<>p_buyer or entry.amount_cents<>p_amount or entry.currency<>p_currency or entry.livemode<>p_live
 or (entry.stripe_session_id is not null and entry.stripe_session_id<>p_session)
 or (entry.payment_intent_id is not null and entry.payment_intent_id<>p_intent) then raise exception 'Payment does not match order'; end if;
 if entry.status in ('paid','refunded','refund_required') then return entry; end if;
 if p_refunded>=p_amount then
  update payment_orders set status='refunded',stripe_session_id=p_session,payment_intent_id=p_intent,paid_at=p_paid_at,refunded_cents=amount_cents where id=p_order returning * into entry;
  return entry;
 end if;
 -- A delayed payment may only win if its reservation is still current.
 if entry.status<>'pending' or item.status<>'available' then
  update payment_orders set status='refund_required',stripe_session_id=p_session,payment_intent_id=p_intent,paid_at=p_paid_at where id=p_order returning * into entry;
  return entry;
 end if;
 update payment_orders set status='paid',stripe_session_id=p_session,payment_intent_id=p_intent,paid_at=p_paid_at,refunded_cents=greatest(0,p_refunded) where id=p_order returning * into entry;
 update listings set status='claimed',claimed_by=p_buyer,stripe_session_id=p_session,claimed_at=(extract(epoch from p_paid_at)*1000)::bigint where id=item.id;
 select * into buyer from users where id=p_buyer;
 insert into notifications(user_id,listing_id,message) values(item.posted_by,item.id,buyer.name||' purchased '||item.title||'. Contact: '||buyer.email||' '||buyer.phone);
 return entry;
end $$;

create function public.record_refund(p_intent text,p_refunded bigint) returns void language plpgsql set search_path=public as $$
declare entry payment_orders;
begin
 select * into entry from payment_orders where payment_intent_id=p_intent;
 if not found then return; end if;
 perform 1 from users where id=entry.contractor_id for update;
 update payment_orders set refunded_cents=greatest(refunded_cents,least(p_refunded,amount_cents)),
 status=case when p_refunded>=amount_cents then 'refunded' else status end where id=entry.id;
end $$;

create function public.request_withdrawal(p_contractor uuid,p_amount numeric,p_method text,p_details text,p_notes text,p_key uuid,p_live boolean)
returns public.payout_requests language plpgsql set search_path=public as $$
declare earned numeric; reserved numeric; result payout_requests;
begin
 perform 1 from users where id=p_contractor and role='contractor' for update;
 if not found then raise exception 'Contractor accounts only'; end if;
 select * into result from payout_requests where request_key=p_key;
 if found then
  if result.contractor_id<>p_contractor then raise exception 'Invalid request key'; end if;
  return result;
 end if;
 if p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2) or p_amount::text in ('NaN','Infinity','-Infinity') then raise exception 'Enter a valid amount with at most two decimal places'; end if;
 select coalesce(sum(amount_cents-refunded_cents),0)/100.0 into earned from payment_orders where contractor_id=p_contractor and status='paid' and livemode=p_live;
 select coalesce(sum(amount),0) into reserved from payout_requests where contractor_id=p_contractor and status in ('pending','approved','paid') and livemode=p_live;
 if p_amount>earned-reserved then raise exception 'Requested amount exceeds available balance'; end if;
 insert into payout_requests(contractor_id,amount,payment_method,account_details,notes,status,request_key,livemode,processed_at)
 values(p_contractor,p_amount,p_method,p_details,p_notes,case when p_live then 'pending' else 'paid' end,p_key,p_live,
 case when p_live then null else (extract(epoch from clock_timestamp())*1000)::bigint end) returning * into result;
 return result;
end $$;

create function public.protect_purchase() returns trigger language plpgsql set search_path=public as $$
begin
 if new.status='donated' and exists(select 1 from payment_orders where listing_id=old.id and (status='paid' or (status='pending' and expires_at>now()))) then
  raise exception 'This item is reserved or purchased and cannot be donated';
 end if;
 return new;
end $$;
create trigger protect_purchase before update on public.listings for each row execute function public.protect_purchase();

revoke all on function public.reserve_checkout(uuid,uuid,boolean),public.settle_checkout(uuid,text,text,bigint,text,uuid,boolean,timestamptz,bigint),public.record_refund(text,bigint),public.request_withdrawal(uuid,numeric,text,text,text,uuid,boolean),public.protect_purchase() from public,anon,authenticated;
grant execute on function public.reserve_checkout(uuid,uuid,boolean),public.settle_checkout(uuid,text,text,bigint,text,uuid,boolean,timestamptz,bigint),public.record_refund(text,bigint),public.request_withdrawal(uuid,numeric,text,text,text,uuid,boolean) to service_role;
