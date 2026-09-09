-- Run once in a new Supabase project's SQL Editor before deploying.
create table public.users (
 id uuid primary key references auth.users(id) on delete cascade,
 role text not null check (role in ('buyer','contractor')),
 name text not null, email text not null, phone text not null default '', address text not null,
 lat double precision not null check(lat between -90 and 90), lng double precision not null check(lng between -180 and 180),
 radius integer not null check(radius between 1 and 100), preferences jsonb not null default '[]'::jsonb
);
create table public.listings (
 id uuid primary key default gen_random_uuid(), photo text not null,
 category text not null check(category in ('Cabinetry','Fixtures','Doors','Appliances','Tile & flooring','Other')),
 material text not null, condition text not null check(condition in ('Excellent','Good','Fair','Poor')),
 title text not null, description text not null, address text not null, lat double precision not null, lng double precision not null,
 status text not null default 'available' check(status in ('available','claimed','donated')),
 posted_by uuid not null references public.users(id), claimed_by uuid references public.users(id),
 created_at bigint not null default (extract(epoch from clock_timestamp())*1000)::bigint,
 nonprofit text, estimated_value numeric check(estimated_value>=0), donated_at bigint
);
create table public.notifications (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.users(id) on delete cascade,
 listing_id uuid not null references public.listings(id) on delete cascade, message text not null,
 created_at bigint not null default (extract(epoch from clock_timestamp())*1000)::bigint, read_at bigint
);
create index listings_available_time on public.listings(status,created_at desc);
create index listings_owner on public.listings(posted_by);
create index listings_claimant on public.listings(claimed_by);
create index notifications_recipient on public.notifications(user_id,created_at desc);
-- Only the authenticated, authorized Next.js server accesses application data.
-- No direct browser access to private addresses, contact details, or storage.
alter table public.users enable row level security;
alter table public.listings enable row level security;
alter table public.notifications enable row level security;
revoke all on public.users,public.listings,public.notifications from anon,authenticated;
grant all on public.users,public.listings,public.notifications to service_role;

create function public.keep_account_role() returns trigger language plpgsql set search_path=public as $$
begin
 if new.role <> old.role then raise exception 'Account roles cannot be changed'; end if;
 return new;
end $$;
create trigger account_role_immutable before update on public.users for each row execute function public.keep_account_role();

create function public.notify_matching_buyers() returns trigger language plpgsql set search_path=public as $$
begin
 if not exists(select 1 from public.users where id=new.posted_by and role='contractor') then raise exception 'Only contractors can list materials'; end if;
 insert into public.notifications(user_id,listing_id,message)
 select id,new.id,'New nearby: '||new.title||'. Free and ready for pickup.' from public.users u
 where u.role='buyer' and u.id<>new.posted_by and u.preferences ? new.category
 and 3958.8*acos(least(1.0,greatest(-1.0,sin(radians(u.lat))*sin(radians(new.lat))+cos(radians(u.lat))*cos(radians(new.lat))*cos(radians(new.lng-u.lng))))) <= u.radius;
 return new;
end $$;
create trigger listing_match_notifications after insert on public.listings for each row execute function public.notify_matching_buyers();

create function public.claim_listing(listing_id uuid,buyer_id uuid) returns public.listings language plpgsql set search_path=public as $$
declare claimed public.listings; buyer public.users;
begin
 select * into buyer from public.users where id=buyer_id and role='buyer';
 if not found then raise exception 'A buyer account is required'; end if;
 update public.listings set status='claimed',claimed_by=buyer_id where id=listing_id and status='available' and posted_by<>buyer_id returning * into claimed;
 if not found then raise exception 'This item has already been claimed or is unavailable'; end if;
 insert into public.notifications(user_id,listing_id,message) values(claimed.posted_by,claimed.id,buyer.name||' claimed '||claimed.title||'. Contact: '||buyer.email||case when buyer.phone<>'' then ' · '||buyer.phone else '' end);
 return claimed;
end $$;
revoke all on function public.claim_listing(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_listing(uuid,uuid) to service_role;
revoke all on function public.keep_account_role(),public.notify_matching_buyers() from public,anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('listing-photos','listing-photos',false,3145728,array['image/jpeg']) on conflict(id) do nothing;
