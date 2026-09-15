alter table public.listings add column visibility_radius integer not null default 20 check (visibility_radius between 1 and 100);
update public.listings l set visibility_radius=u.radius from public.users u where u.id=l.posted_by;

create or replace function public.notify_matching_buyers() returns trigger language plpgsql set search_path=public as $$
begin
 if not exists(select 1 from public.users where id=new.posted_by and role='contractor') then raise exception 'Only contractors can list materials'; end if;
 insert into public.notifications(user_id,listing_id,message)
 select id,new.id,'New nearby: '||new.title||'. Available for pickup.' from public.users u
 where u.role='buyer' and u.id<>new.posted_by and u.preferences ? new.category
 and u.lat is not null and u.lng is not null
 and 3958.8*acos(least(1.0,greatest(-1.0,sin(radians(u.lat))*sin(radians(new.lat))+cos(radians(u.lat))*cos(radians(new.lat))*cos(radians(new.lng-u.lng))))) <= least(new.visibility_radius,u.radius);
 return new;
end $$;

create function public.local_listings(p_user uuid,p_lat double precision,p_lng double precision) returns setof public.listings language sql stable set search_path=public as $$
 select l.* from listings l where
 l.posted_by=p_user or l.claimed_by=p_user or
 (l.status in ('available','reserved') and not l.under_review and p_lat between -90 and 90 and p_lng between -180 and 180 and
 3958.8*acos(least(1.0,greatest(-1.0,sin(radians(p_lat))*sin(radians(l.lat))+cos(radians(p_lat))*cos(radians(l.lat))*cos(radians(l.lng-p_lng))))) <= l.visibility_radius)
 order by l.created_at desc limit 500;
$$;
revoke all on function public.local_listings(uuid,double precision,double precision) from public,anon,authenticated;
grant execute on function public.local_listings(uuid,double precision,double precision) to service_role;
