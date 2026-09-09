-- Saving an account must not depend on the availability of geocoding.
alter table public.users alter column lat drop not null;
alter table public.users alter column lng drop not null;
alter table public.users add constraint users_coordinates_pair check ((lat is null) = (lng is null));
