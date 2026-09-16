-- Keep historical receipts and safety evidence, while removing deleted listings
-- from discovery and the contractor's inventory.
alter table listings drop constraint listings_status_check;
alter table listings add constraint listings_status_check check(status in ('available','reserved','claimed','donated','deleted'));

create function protect_listing_deletion() returns trigger language plpgsql set search_path=public as $$
begin
 if old.status='deleted' and new.status<>'deleted' then raise exception 'Deleted listings cannot be reopened'; end if;
 if new.status='deleted' and old.status<>'deleted' then
  if old.status not in ('available','donated') or old.claimed_by is not null or old.claimed_at is not null
   or exists(select 1 from pickup_reservations where listing_id=old.id and (status in ('checkout','reserved','accepting','accepted','collected') or buyer_accepted_at is not null))
   or exists(select 1 from payment_orders where listing_id=old.id and (status in ('authorized','paid','refund_required') or (status='pending' and expires_at>now())))
  then raise exception 'Reserved or claimed listings cannot be deleted'; end if;
 end if;
 return new;
end $$;
create trigger listing_deletion_guard before update on listings for each row execute function protect_listing_deletion();

create function delete_listing(p_listing uuid,p_contractor uuid) returns void language plpgsql set search_path=public as $$
declare item listings;
begin
 -- Reservation creation locks the same row, so deletion and reservation cannot both succeed.
 select * into item from listings where id=p_listing and posted_by=p_contractor for update;
 if not found or not exists(select 1 from users where id=p_contractor and role='contractor') then
  raise exception 'Only the listing owner can delete this listing';
 end if;
 if item.status='deleted' then return; end if;
 update listings set status='deleted' where id=p_listing;
 delete from notifications where listing_id=p_listing;
 delete from pickup_waitlist where listing_id=p_listing;
end $$;

create or replace function local_listings(p_user uuid,p_lat double precision,p_lng double precision) returns setof listings language sql stable set search_path=public as $$
 select l.* from listings l where l.status<>'deleted' and (
 l.posted_by=p_user or l.claimed_by=p_user or
 (l.status in ('available','reserved') and not l.under_review and p_lat between -90 and 90 and p_lng between -180 and 180 and
 3958.8*acos(least(1.0,greatest(-1.0,sin(radians(p_lat))*sin(radians(l.lat))+cos(radians(p_lat))*cos(radians(l.lat))*cos(radians(l.lng-p_lng))))) <= l.visibility_radius))
 order by l.created_at desc limit 500;
$$;
revoke all on function delete_listing(uuid,uuid),protect_listing_deletion() from public,anon,authenticated;
grant execute on function delete_listing(uuid,uuid),protect_listing_deletion() to service_role;
