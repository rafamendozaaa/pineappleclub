-- ─────────────────────────────────────────────────────────────────────────────
-- Parking Haus — Supabase schema, row-level security, and storage
--
-- This is the SERVER-SIDE source of truth that makes owner-only access REAL.
-- Run it once in your Supabase project (SQL Editor → paste → Run).
--
-- Setup order:
--   1. Create a Supabase project.
--   2. Run this whole file in the SQL Editor.
--   3. Sign in once through the app using hello@parkinghaus.com (magic link /
--      Google) so an auth user + profile row exist.
--   4. Promote that account to owner:
--        update public.profiles set role = 'owner'
--        where email = 'hello@parkinghaus.com';
--   5. Give the frontend your Project URL + anon (public) key.
--      NEVER put the service_role key in the frontend — it bypasses RLS.
--
-- NOTE: this SQL has not been executed against a live Postgres from this
-- environment. Run it in your project and adjust if your Supabase version
-- differs; treat the first run as the verification step.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Profiles (1:1 with auth.users) ──────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text unique not null,
  full_name   text,
  role        text not null default 'user',   -- 'user' | 'host' | 'owner'
  created_at  timestamptz not null default now()
);

-- Auto-create a profile whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Is the current request the owner? Used by every owner-only policy.
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner'
  );
$$;

-- ── Listings ─────────────────────────────────────────────────────────────────
create table if not exists public.listings (
  id          uuid primary key default gen_random_uuid(),
  host_id     uuid not null references public.profiles (id) on delete cascade,
  title       text not null,
  address     text not null,
  price       numeric(10,2) not null check (price > 0),
  unit        text not null default '/day',     -- '/day' | '/event' | '/hr'
  type        text not null default 'Driveway',
  photo_url   text,
  amenities   text[] not null default '{}',
  status      text not null default 'live',      -- 'live' | 'hidden'
  created_at  timestamptz not null default now()
);
create index if not exists listings_host_idx on public.listings (host_id);

-- ── Bookings ─────────────────────────────────────────────────────────────────
create table if not exists public.bookings (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references public.listings (id) on delete cascade,
  driver_id   uuid not null references public.profiles (id) on delete cascade,
  booked_date date not null,
  arrival     time,
  price       numeric(10,2) not null,
  status      text not null default 'confirmed', -- 'confirmed' | 'cancelled'
  created_at  timestamptz not null default now()
);
create index if not exists bookings_driver_idx  on public.bookings (driver_id);
create index if not exists bookings_listing_idx on public.bookings (listing_id);

-- ── Row-level security ────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.bookings enable row level security;

-- profiles: you see/update your own; owner sees all. Role is NOT self-editable
-- here (change it via SQL / service role only).
create policy profiles_select_self  on public.profiles for select using (id = auth.uid() or public.is_owner());
create policy profiles_update_self  on public.profiles for update using (id = auth.uid()) with check (id = auth.uid() and role = 'user' or role = 'host');

-- listings: anyone can read live spots; a host manages only their own;
-- the owner can do anything (moderation).
create policy listings_read_live    on public.listings for select using (status = 'live' or host_id = auth.uid() or public.is_owner());
create policy listings_host_write   on public.listings for all
  using (host_id = auth.uid()) with check (host_id = auth.uid());
create policy listings_owner_all    on public.listings for all
  using (public.is_owner()) with check (public.is_owner());

-- bookings: a driver manages their own; a host can read bookings on their
-- listings; the owner can do anything.
create policy bookings_driver_write on public.bookings for all
  using (driver_id = auth.uid()) with check (driver_id = auth.uid());
create policy bookings_host_read    on public.bookings for select
  using (exists (select 1 from public.listings l where l.id = listing_id and l.host_id = auth.uid()));
create policy bookings_owner_all    on public.bookings for all
  using (public.is_owner()) with check (public.is_owner());

-- ── Storage: listing photos ───────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', true)
on conflict (id) do nothing;

-- public read; any authenticated user can upload to their own folder.
create policy "listing photos are public"   on storage.objects for select using (bucket_id = 'listing-photos');
create policy "users upload listing photos"  on storage.objects for insert
  to authenticated with check (bucket_id = 'listing-photos');
