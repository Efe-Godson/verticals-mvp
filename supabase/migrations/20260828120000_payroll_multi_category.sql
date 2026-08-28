-- Roles, departments and locations become multi-value on payroll_employees:
-- one employee can hold several of each ("Baker" + "Store Keeper", works at
-- two locations, etc). The pre-existing single columns (job_title,
-- department_id, primary_location_id) are KEPT and stay in sync with the
-- first element of each array, so everything that still reads them (the
-- payroll run, reports, exports, the location filter's fallback path) keeps
-- working. New code reads the arrays.

alter table payroll_employees
  add column if not exists job_titles     text[] not null default '{}',
  add column if not exists department_ids uuid[] not null default '{}',
  add column if not exists location_ids   uuid[] not null default '{}';

-- Back-fill from the existing single columns. job_title has historically
-- been entered as "Baker / Store Keeper", so split on "/".
update payroll_employees
   set job_titles = coalesce(
         nullif(
           array(
             select trim(x)
             from unnest(string_to_array(coalesce(job_title, ''), '/')) as x
             where trim(x) <> ''
           ),
           '{}'
         ),
         '{}'
       )
 where job_titles = '{}';

update payroll_employees
   set department_ids = array[department_id]
 where department_id is not null
   and department_ids = '{}';

update payroll_employees
   set location_ids = array[primary_location_id]
 where primary_location_id is not null
   and location_ids = '{}';

-- GIN indexes so "employees at location X" / "in department X" stay cheap.
create index if not exists idx_payroll_employees_department_ids
  on payroll_employees using gin (department_ids);
create index if not exists idx_payroll_employees_location_ids
  on payroll_employees using gin (location_ids);
