-- Lets the Lab correct/override state names the @countrystatecity CDN
-- returns for the Location field (src/lib/locationData.js), without a code
-- change + deploy for every mismatch found. Replaces the old hardcoded
-- STATE_ALIASES object in that file - seeded below with the two entries it
-- used to hold, so existing behavior/stored submissions don't change.
-- Same admin-uid RLS pattern as `templates`/`legal_pages`/`subprocessors`
-- (see src/adminAccount.js) - only the one admin account can write.
create table if not exists public.location_state_overrides (
  id uuid primary key default gen_random_uuid(),
  country text not null,
  source_name text not null,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (country, source_name)
);

alter table public.location_state_overrides enable row level security;

drop policy if exists "Admin manages location state overrides" on public.location_state_overrides;
create policy "Admin manages location state overrides"
on public.location_state_overrides for all
to authenticated
using (auth.uid() = '7d91d04c-d223-4ef1-a94d-382aa2d31bfe')
with check (auth.uid() = '7d91d04c-d223-4ef1-a94d-382aa2d31bfe');

-- Every signed-in user's browser reads this table directly (see
-- loadStateOverrides in locationData.js) to render the Location field's
-- state dropdown, so it needs a public read policy alongside the
-- admin-only write policy above.
drop policy if exists "Anyone can read location state overrides" on public.location_state_overrides;
create policy "Anyone can read location state overrides"
on public.location_state_overrides for select
to authenticated, anon
using (true);

insert into public.location_state_overrides (country, source_name, display_name) values
  ('Nigeria', 'Abuja Federal Capital Territory', 'Abuja (FCT)'),
  ('Nigeria', 'Nassarawa', 'Nasarawa')
on conflict (country, source_name) do nothing;
