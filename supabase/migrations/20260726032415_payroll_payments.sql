-- Phase 2 of the payroll vertical: persistent Paid/Pending status per
-- employee per pay period. The final-salary breakdown itself is always
-- computed live from Employees + Salary Events (so it stays correct if
-- events are added/edited later); this table only needs to remember
-- whether a period was marked paid, and freeze the amount at that moment
-- so a later event edit can't silently change what was already paid out.
create table payroll_payments (
  id uuid primary key default gen_random_uuid(),
  employees_form_id uuid not null references forms(id) on delete cascade,
  employee_submission_id uuid not null references submissions(id) on delete cascade,
  period text not null, -- 'YYYY-MM'
  status text not null default 'pending' check (status in ('paid', 'pending')),
  amount numeric,
  marked_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (employees_form_id, employee_submission_id, period)
);

create or replace function set_payroll_payments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_payroll_payments_updated_at
before update on payroll_payments
for each row
execute function set_payroll_payments_updated_at();

alter table payroll_payments enable row level security;

create policy "Owners can manage their payroll payments"
on payroll_payments
for all
to authenticated
using (
  exists (select 1 from forms where forms.id = payroll_payments.employees_form_id and forms.user_id = auth.uid())
)
with check (
  exists (select 1 from forms where forms.id = payroll_payments.employees_form_id and forms.user_id = auth.uid())
);
