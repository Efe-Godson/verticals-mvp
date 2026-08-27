-- Dedicated Staff Payments / Payroll schema. Replaces the old "Staff Payment
-- Tracker" (two generic forms - Employees + Salary Events - linked via a
-- linked_record field, with payroll math hardcoded to field ids f1..f6) with
-- purpose-built tables. This is a start-fresh replacement, not a data
-- migration: existing Employees/Salary Events submissions are not carried
-- forward, and the old payroll_payments table is left in place, unreferenced,
-- rather than dropped (a DROP against a live table is irreversible and buys
-- nothing here).
--
-- There is no "organizations" concept in this app, so every table is scoped
-- by payroll_form_id -> a real forms row. That forms row is just an
-- anchor/pointer: its fields stay '[]', nothing ever submits against it. It
-- exists because BusinessesHome.jsx's tile grid, NavBar.jsx's Payroll link,
-- and Templates.jsx's bundle-template flow all key off "one forms row per
-- template instance" (see the templates.bundle update at the bottom).
--
-- Table/column shape follows the Staff Payments design doc sections 39-47.

-- Departments (doc section 40) -------------------------------------------------
create table payroll_departments (
  id uuid primary key default gen_random_uuid(),
  payroll_form_id uuid not null references forms(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now()
);

create index idx_payroll_departments_form on payroll_departments (payroll_form_id) where status = 'active';

-- Employees (doc section 39) -------------------------------------------------
-- monthly_salary is kept on the row as the authoritative *current* salary
-- (what calculatePayroll.js reads). payroll_employee_compensation below keeps
-- the history; the UI does not read it back yet.
create table payroll_employees (
  id uuid primary key default gen_random_uuid(),
  payroll_form_id uuid not null references forms(id) on delete cascade,
  employee_number text,
  full_name text not null,
  phone text,
  email text,
  job_title text,
  department_id uuid references payroll_departments(id) on delete set null,
  employment_status text not null default 'active'
    check (employment_status in ('active', 'on_leave', 'suspended', 'inactive', 'terminated')),
  start_date date,
  end_date date,
  monthly_salary numeric not null default 0,
  -- Payment info (doc section 8) - optional, for future API payouts.
  bank_name text,
  account_number text,
  account_name text,
  payment_provider text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_payroll_employees_form on payroll_employees (payroll_form_id) where deleted_at is null;
create index idx_payroll_employees_department on payroll_employees (department_id) where deleted_at is null;

-- Compensation history (doc section 39) --------------------------------------
-- One row per salary state. Written on employee create and on every salary
-- change so raises can be tracked; not read back by the UI in this phase.
create table payroll_employee_compensation (
  id uuid primary key default gen_random_uuid(),
  payroll_form_id uuid not null references forms(id) on delete cascade,
  employee_id uuid not null references payroll_employees(id) on delete cascade,
  salary_type text not null default 'monthly'
    check (salary_type in ('monthly', 'daily', 'hourly', 'shift')),
  base_salary numeric not null,
  currency text not null default 'NGN',
  daily_rate_method text not null default 'calendar_days'
    check (daily_rate_method in ('calendar_days', 'fixed_working_days')),
  working_days integer,
  effective_from date not null default current_date,
  effective_to date,
  created_at timestamptz not null default now()
);

create index idx_payroll_compensation_employee on payroll_employee_compensation (employee_id);

-- Payroll periods (doc section 41) -----------------------------------------
create table payroll_periods (
  id uuid primary key default gen_random_uuid(),
  payroll_form_id uuid not null references forms(id) on delete cascade,
  month integer not null check (month between 1 and 12),
  year integer not null,
  start_date date,
  end_date date,
  status text not null default 'draft'
    check (status in ('draft', 'open', 'review', 'approved', 'processing', 'completed', 'locked')),
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (payroll_form_id, year, month)
);

-- Payroll entries (doc sections 42, 46) -----------------------------------
-- The heart of the system: one row per event that affects an employee's pay
-- for a month. `amount` is always stored positive; `entry_category` decides
-- the sign everywhere it is displayed or summed. For missed_day / extra_day
-- the amount is computed at entry time (daily_rate * quantity) and still
-- stored in `amount`, so every entry has one consistent field to sum.
-- `status` supports the optional manager-approval workflow (doc section 49);
-- entries default to 'approved' since that workflow has no UI yet.
create table payroll_entries (
  id uuid primary key default gen_random_uuid(),
  payroll_form_id uuid not null references forms(id) on delete cascade,
  employee_id uuid not null references payroll_employees(id) on delete cascade,
  payroll_period_id uuid references payroll_periods(id) on delete set null,
  entry_date date not null default current_date,
  entry_category text not null check (entry_category in ('deduction', 'addition')),
  entry_type text not null check (entry_type in (
    'fine', 'missed_day', 'extra_day', 'bonus', 'salary_advance', 'loan_repayment',
    'allowance', 'reimbursement', 'commission', 'damage', 'other_deduction', 'other_addition'
  )),
  quantity numeric,       -- days, for missed_day / extra_day
  unit_amount numeric,    -- daily rate at entry time, for missed_day / extra_day
  amount numeric not null check (amount >= 0),
  reason text,
  notes text,
  payroll_month text not null, -- 'YYYY-MM'
  status text not null default 'approved'
    check (status in ('draft', 'submitted', 'approved', 'rejected')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_payroll_entries_employee on payroll_entries (employee_id) where deleted_at is null;
create index idx_payroll_entries_month on payroll_entries (payroll_form_id, payroll_month) where deleted_at is null;

-- Payroll records (doc section 43) ---------------------------------------
-- One row per employee per payroll month - what "Run Payroll" produces.
-- Recalculated freely while draft/approved/on_hold; once paid or cancelled,
-- Run Payroll skips the row and the UI blocks edits (corrections go through
-- "Create Adjustment", which writes a new entry in a later month).
create table payroll_records (
  id uuid primary key default gen_random_uuid(),
  payroll_form_id uuid not null references forms(id) on delete cascade,
  employee_id uuid not null references payroll_employees(id) on delete cascade,
  payroll_period_id uuid references payroll_periods(id) on delete set null,
  payroll_month text not null, -- 'YYYY-MM'
  base_salary numeric not null,
  days_in_period integer not null,
  daily_rate numeric not null, -- full precision, never pre-rounded
  missed_days numeric not null default 0,
  missed_day_deduction numeric not null default 0,
  extra_days numeric not null default 0,
  extra_day_pay numeric not null default 0,
  total_fines numeric not null default 0,
  total_other_deductions numeric not null default 0,
  total_additions numeric not null default 0,
  gross_adjusted_pay numeric not null default 0,
  total_deductions numeric not null default 0,
  final_amount numeric not null,
  status text not null default 'draft'
    check (status in ('draft', 'pending_approval', 'approved', 'on_hold', 'paid', 'failed', 'cancelled')),
  hold_reason text,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  approved_amount numeric,
  paid_at timestamptz,
  payment_method text check (payment_method in ('bank_transfer', 'cash', 'pos', 'other')),
  payment_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payroll_form_id, employee_id, payroll_month)
);

create index idx_payroll_records_month on payroll_records (payroll_form_id, payroll_month);

-- Payment batches (doc section 45) --------------------------------------
create table payroll_payment_batches (
  id uuid primary key default gen_random_uuid(),
  payroll_form_id uuid not null references forms(id) on delete cascade,
  payroll_period_id uuid references payroll_periods(id) on delete set null,
  payroll_month text not null,
  employee_count integer not null default 0,
  total_amount numeric not null default 0,
  status text not null default 'draft'
    check (status in ('draft', 'ready', 'processing', 'completed', 'failed')),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

-- Disbursements (doc section 44 "payments" - renamed, payroll_payments taken) --
create table payroll_disbursements (
  id uuid primary key default gen_random_uuid(),
  payroll_form_id uuid not null references forms(id) on delete cascade,
  employee_id uuid not null references payroll_employees(id) on delete cascade,
  payroll_record_id uuid references payroll_records(id) on delete set null,
  payment_batch_id uuid references payroll_payment_batches(id) on delete set null,
  amount numeric not null,
  payment_method text check (payment_method in ('bank_transfer', 'cash', 'pos', 'other')),
  provider text,
  provider_reference text,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'successful', 'failed', 'reversed')),
  initiated_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_payroll_disbursements_record on payroll_disbursements (payroll_record_id);

-- Audit log (doc section 47) -------------------------------------------
create table payroll_audit_logs (
  id uuid primary key default gen_random_uuid(),
  payroll_form_id uuid not null references forms(id) on delete cascade,
  user_id uuid references auth.users(id),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create index idx_payroll_audit_form on payroll_audit_logs (payroll_form_id, created_at desc);

-- updated_at triggers -----------------------------------------------------
create or replace function set_payroll_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_payroll_employees_updated_at
before update on payroll_employees
for each row execute function set_payroll_updated_at();

create trigger trg_payroll_entries_updated_at
before update on payroll_entries
for each row execute function set_payroll_updated_at();

create trigger trg_payroll_records_updated_at
before update on payroll_records
for each row execute function set_payroll_updated_at();

-- Row level security ----------------------------------------------------
-- Owner-only on every table - no form_staff / POS-login access at all.
-- Payroll is financial and sensitive; staff logins have no legitimate reason
-- to see it (App.jsx's StaffScopedRoute also leaves /payroll* out, but RLS is
-- the real backstop). Every policy is the same shape: the row's
-- payroll_form_id must point at a forms row owned by the caller.
alter table payroll_departments enable row level security;
alter table payroll_employees enable row level security;
alter table payroll_employee_compensation enable row level security;
alter table payroll_periods enable row level security;
alter table payroll_entries enable row level security;
alter table payroll_records enable row level security;
alter table payroll_payment_batches enable row level security;
alter table payroll_disbursements enable row level security;
alter table payroll_audit_logs enable row level security;

create policy "Owners manage payroll departments" on payroll_departments for all to authenticated
using (exists (select 1 from forms where forms.id = payroll_departments.payroll_form_id and forms.user_id = auth.uid()))
with check (exists (select 1 from forms where forms.id = payroll_departments.payroll_form_id and forms.user_id = auth.uid()));

create policy "Owners manage payroll employees" on payroll_employees for all to authenticated
using (exists (select 1 from forms where forms.id = payroll_employees.payroll_form_id and forms.user_id = auth.uid()))
with check (exists (select 1 from forms where forms.id = payroll_employees.payroll_form_id and forms.user_id = auth.uid()));

create policy "Owners manage payroll compensation" on payroll_employee_compensation for all to authenticated
using (exists (select 1 from forms where forms.id = payroll_employee_compensation.payroll_form_id and forms.user_id = auth.uid()))
with check (exists (select 1 from forms where forms.id = payroll_employee_compensation.payroll_form_id and forms.user_id = auth.uid()));

create policy "Owners manage payroll periods" on payroll_periods for all to authenticated
using (exists (select 1 from forms where forms.id = payroll_periods.payroll_form_id and forms.user_id = auth.uid()))
with check (exists (select 1 from forms where forms.id = payroll_periods.payroll_form_id and forms.user_id = auth.uid()));

create policy "Owners manage payroll entries" on payroll_entries for all to authenticated
using (exists (select 1 from forms where forms.id = payroll_entries.payroll_form_id and forms.user_id = auth.uid()))
with check (exists (select 1 from forms where forms.id = payroll_entries.payroll_form_id and forms.user_id = auth.uid()));

create policy "Owners manage payroll records" on payroll_records for all to authenticated
using (exists (select 1 from forms where forms.id = payroll_records.payroll_form_id and forms.user_id = auth.uid()))
with check (exists (select 1 from forms where forms.id = payroll_records.payroll_form_id and forms.user_id = auth.uid()));

create policy "Owners manage payroll batches" on payroll_payment_batches for all to authenticated
using (exists (select 1 from forms where forms.id = payroll_payment_batches.payroll_form_id and forms.user_id = auth.uid()))
with check (exists (select 1 from forms where forms.id = payroll_payment_batches.payroll_form_id and forms.user_id = auth.uid()));

create policy "Owners manage payroll disbursements" on payroll_disbursements for all to authenticated
using (exists (select 1 from forms where forms.id = payroll_disbursements.payroll_form_id and forms.user_id = auth.uid()))
with check (exists (select 1 from forms where forms.id = payroll_disbursements.payroll_form_id and forms.user_id = auth.uid()));

create policy "Owners read payroll audit logs" on payroll_audit_logs for all to authenticated
using (exists (select 1 from forms where forms.id = payroll_audit_logs.payroll_form_id and forms.user_id = auth.uid()))
with check (exists (select 1 from forms where forms.id = payroll_audit_logs.payroll_form_id and forms.user_id = auth.uid()));

-- Retire the old two-form (Employees + Salary Events) bundle in favour of a
-- single anchor entry. Targets whichever template row currently has a bundle
-- (Staff Payment Tracker is the only one that has ever used this column, see
-- 20260726031658_templates_bundle_support.sql) rather than a specific slug,
-- since that row was seeded by the admin account at runtime.
update templates
set
  name = 'Payroll',
  slug = 'payroll',
  fields = '[]'::jsonb,
  bundle = '[
    { "key": "employees", "name": "Payroll", "fields": [], "settings": { "payrollRole": "employees" } }
  ]'::jsonb
where bundle is not null;
