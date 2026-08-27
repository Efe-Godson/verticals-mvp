-- Locations as a first-class payroll dimension (Staff Payments design doc
-- addendum). A location is a real branch/site an employee is assigned to, so
-- payroll can be viewed and run per branch. Scoped by payroll_form_id like
-- every other payroll table; the app-wide "location" concept (a cloned form
-- under a template, see src/locations.js) is unrelated.

create table payroll_locations (
  id uuid primary key default gen_random_uuid(),
  payroll_form_id uuid not null references forms(id) on delete cascade,
  name text not null,
  code text,
  address text,
  city text,
  state text,
  country text default 'Nigeria',
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now()
);

create index idx_payroll_locations_form on payroll_locations (payroll_form_id) where status = 'active';

alter table payroll_employees add column primary_location_id uuid references payroll_locations(id) on delete set null;
alter table payroll_payment_batches add column location_id uuid references payroll_locations(id) on delete set null;

create index idx_payroll_employees_location on payroll_employees (primary_location_id) where deleted_at is null;

alter table payroll_locations enable row level security;

create policy "Owners manage payroll locations" on payroll_locations for all to authenticated
using (exists (select 1 from forms where forms.id = payroll_locations.payroll_form_id and forms.user_id = auth.uid()))
with check (exists (select 1 from forms where forms.id = payroll_locations.payroll_form_id and forms.user_id = auth.uid()));
