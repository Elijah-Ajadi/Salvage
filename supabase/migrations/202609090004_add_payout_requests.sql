-- Add payout_requests table for contractor withdrawals
create table if not exists public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.users(id) on delete cascade,
  amount numeric not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'paid', 'cancelled')),
  payment_method text not null,
  account_details text not null,
  notes text,
  created_at bigint not null default (extract(epoch from clock_timestamp())*1000)::bigint,
  processed_at bigint
);

create index if not exists payout_requests_contractor on public.payout_requests(contractor_id, created_at desc);

alter table public.payout_requests enable row level security;
grant all on public.payout_requests to service_role;
revoke all on public.payout_requests from anon, authenticated;
