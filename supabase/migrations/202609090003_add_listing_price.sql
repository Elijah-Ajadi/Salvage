-- Add optional price to listings table
alter table public.listings add column if not exists price numeric default 0 check (price >= 0);
alter table public.listings add column if not exists stripe_session_id text;
