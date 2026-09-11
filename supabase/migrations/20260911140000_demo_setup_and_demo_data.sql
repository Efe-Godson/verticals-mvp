-- Lab: Demo & Onboarding Controls (Phase 2 of the entry/onboarding rework,
-- see 20260911120000_onboarding_events_and_demo_seed.sql for Phase 1). Moves
-- each onboarding intent's destination (template/dataset/screen/CTA) from
-- src/onboarding/entryIntents.jsx's hardcoded config into the database, so
-- the Lab's new Demo Setup page can edit it without a redeploy.
--
-- demo_datasets: a named, reusable pointer to a real form+its submissions
-- (the same is_demo=true mechanism the single old "Use as the demo
-- business" toggle already used, just no longer limited to exactly one).
create table demo_datasets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  form_id uuid not null references forms(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- demo_routes: one row per entry_intent (see src/onboarding/entryIntents.jsx
-- for the 7 canonical ids - kept in sync by the check constraint below,
-- deliberately not a foreign key to anything code-defined). destination
-- 'dashboard'/'payroll' are allowed values now even though nothing renders
-- them yet (see the plan this was built from) - so Demo Setup's dropdown
-- can offer them without a second migration once that rendering exists.
create table demo_routes (
  id uuid primary key default gen_random_uuid(),
  entry_intent text not null unique
    check (entry_intent in ('sales', 'expenses', 'payroll', 'data_collection', 'reporting', 'workflow', 'other')),
  template_slug text references templates(slug) on delete set null,
  demo_dataset_id uuid references demo_datasets(id) on delete set null,
  destination text not null default 'form'
    check (destination in ('form', 'records', 'report', 'dashboard', 'payroll')),
  cta_text text not null default 'Create your workspace',
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table demo_datasets enable row level security;
alter table demo_routes enable row level security;

-- Grants first: this project does not auto-grant a brand-new table to
-- anon/authenticated (see 20260911130000_onboarding_events_grants.sql's own
-- note on the same finding) - RLS alone isn't enough without these.
grant select on demo_datasets to anon, authenticated;
grant insert, update, delete on demo_datasets to authenticated;
grant select on demo_routes to anon, authenticated;
grant insert, update, delete on demo_routes to authenticated;

-- Both tables are plain config (names, a form id, an enum) - nothing
-- sensitive, and the anonymous pre-signup onboarding flow needs to read an
-- active route (plus its dataset's form_id) before an account exists, same
-- reasoning as the Phase 1 "Anyone can view templates" policy.
create policy "Anyone can view demo datasets"
on demo_datasets for select
to public
using (true);

create policy "Anyone can view demo routes"
on demo_routes for select
to public
using (true);

-- Same "only the main account curates this" convention as templates.
create policy "Only the main account can manage demo datasets"
on demo_datasets for all
to authenticated
using (auth.uid() = '7d91d04c-d223-4ef1-a94d-382aa2d31bfe')
with check (auth.uid() = '7d91d04c-d223-4ef1-a94d-382aa2d31bfe');

create policy "Only the main account can manage demo routes"
on demo_routes for all
to authenticated
using (auth.uid() = '7d91d04c-d223-4ef1-a94d-382aa2d31bfe')
with check (auth.uid() = '7d91d04c-d223-4ef1-a94d-382aa2d31bfe');

-- Seed: reproduces Phase 1's hardcoded mapping exactly, so shipping this
-- migration changes nothing a user sees - only the admin now has a screen
-- to change it. The Mama's Kitchen form from the Phase 1 seed becomes the
-- first (only, for now) demo dataset.
insert into demo_datasets (id, name, form_id)
values ('22222222-2222-4222-8222-222222222222', 'Mama''s Kitchen Demo', '11111111-1111-4111-8111-111111111111')
on conflict (id) do nothing;

insert into demo_routes (entry_intent, template_slug, demo_dataset_id, destination) values
  ('sales', null, '22222222-2222-4222-8222-222222222222', 'report'),
  ('reporting', null, '22222222-2222-4222-8222-222222222222', 'report'),
  ('expenses', 'expenses', null, 'form'),
  ('payroll', 'payroll', null, 'form'),
  ('data_collection', 'forms', null, 'form'),
  ('workflow', 'forms', null, 'form'),
  ('other', 'forms', null, 'form')
on conflict (entry_intent) do nothing;
