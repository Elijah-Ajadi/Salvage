-- Existing reservations retain their agreed windows; new requests need confirmation.
alter table pickup_reservations add column contractor_confirmed_at timestamptz;
update pickup_reservations set contractor_confirmed_at=created_at;

create function confirm_pickup_window(p_id uuid,p_contractor uuid) returns pickup_reservations
language plpgsql set search_path=public as $$
declare p pickup_reservations;
begin
 select * into p from pickup_reservations where id=p_id and contractor_id=p_contractor for update;
 if not found then raise exception 'Only the contractor can confirm this pickup window'; end if;
 if p.status not in ('checkout','reserved') or p.deadline<=now() then raise exception 'This pickup window can no longer be confirmed'; end if;
 if p.contractor_confirmed_at is not null then return p; end if;
 update pickup_reservations set contractor_confirmed_at=now() where id=p_id returning * into p;
 perform notify_pickup(p,p.item_title||': contractor confirmed the pickup window. Check your receipt before travelling.');
 return p;
end $$;

-- Enforce confirmation even for older API clients calling accept_pickup.
create function require_confirmed_pickup() returns trigger language plpgsql set search_path=public as $$
begin
 if new.status in ('accepting','accepted','collected') and new.contractor_confirmed_at is null then
  raise exception 'Wait for the contractor to confirm your pickup window';
 end if;
 return new;
end $$;
create trigger pickup_confirmation_guard before insert or update on pickup_reservations
for each row execute function require_confirmed_pickup();

create or replace function extend_pickup(p_id uuid,p_actor uuid,p_end timestamptz,p_approve boolean default null) returns pickup_reservations language plpgsql set search_path=public as $$
declare p pickup_reservations; auth_end timestamptz;
begin
 select * into p from pickup_reservations where id=p_id for update;
 if not found or p.status<>'reserved' or p.deadline<=now() then raise exception 'Reservation cannot be extended'; end if;
 select capture_before into auth_end from payment_orders where reservation_id=p_id;
 if p_approve is null then
  if p_actor not in (p.buyer_id,p.contractor_id) or p_end is null or not isfinite(p_end) or p_end<=p.pickup_end or p_end>p.created_at+interval '76 hours' then raise exception 'Choose an extension within three days of reserving'; end if;
  if auth_end is not null and p_end+interval '30 minutes'>auth_end-interval '5 minutes' then raise exception 'Extension would exceed the card authorization'; end if;
  if p_actor=p.contractor_id then
   -- Only the end moves later: the buyer's original arrival time stays valid.
   update pickup_reservations set requested_end=p_end,extension_status='approved',pickup_end=p_end,
    deadline=p_end+interval '30 minutes',reminder_sent_at=null,contractor_confirmed_at=coalesce(contractor_confirmed_at,now())
    where id=p_id returning * into p;
  else
   update pickup_reservations set requested_end=p_end,extension_status='pending' where id=p_id returning * into p;
  end if;
 else
  if p_actor<>p.contractor_id or p.extension_status<>'pending' then raise exception 'Only the contractor can decide this extension'; end if;
  if p_approve and (p.requested_end<=now() or (auth_end is not null and p.requested_end+interval '30 minutes'>auth_end-interval '5 minutes')) then raise exception 'Extension is no longer possible'; end if;
  update pickup_reservations set extension_status=case when p_approve then 'approved' else 'declined' end,
   pickup_end=case when p_approve then requested_end else pickup_end end,
   deadline=case when p_approve then requested_end+interval '30 minutes' else deadline end,
   reminder_sent_at=case when p_approve then null else reminder_sent_at end,
   contractor_confirmed_at=case when p_approve then coalesce(contractor_confirmed_at,now()) else contractor_confirmed_at end
   where id=p_id returning * into p;
 end if;
 perform notify_pickup(p,p.item_title||': pickup extension '||p.extension_status||'. Check the receipt.');return p;
end $$;

-- An unconfirmed window is not evidence of a buyer no-show.
create function validate_no_show_confirmation() returns trigger language plpgsql set search_path=public as $$
begin
 if new.reason='no_show' and not exists(select 1 from pickup_reservations p where p.id=new.reservation_id and p.contractor_confirmed_at is not null) then
  raise exception 'No-show reports require a contractor-confirmed pickup window';
 end if;
 return new;
end $$;
create trigger no_show_confirmation_guard before insert or update on safety_reports
for each row execute function validate_no_show_confirmation();

revoke all on function confirm_pickup_window(uuid,uuid),require_confirmed_pickup(),validate_no_show_confirmation() from public,anon,authenticated;
grant execute on function confirm_pickup_window(uuid,uuid),require_confirmed_pickup(),validate_no_show_confirmation() to service_role;
