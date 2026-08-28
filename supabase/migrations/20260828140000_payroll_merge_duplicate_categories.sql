-- One-time cleanup: payroll_departments / payroll_locations have no
-- unique-name constraint, and the inline "+ Add" plus repeated imports had
-- created several active rows with the same name per form ("Main Kitchen"
-- x3, etc). Merge each same-name group (case- and whitespace-insensitive)
-- into a single canonical row - the oldest one - repoint every reference at
-- it, and archive the rest.
--
-- Idempotent: after the first run the extras are status='archived', so the
-- `having count(*) > 1` groups are empty on any re-run.

-- ===================== DEPARTMENTS =====================

with canon as (
  select payroll_form_id,
         lower(btrim(name))                       as norm_name,
         (array_agg(id order by created_at, id))[1] as keep_id,
         array_agg(id order by created_at, id)    as all_ids
  from payroll_departments
  where status = 'active'
  group by payroll_form_id, lower(btrim(name))
  having count(*) > 1
),
remap as (
  select unnest(all_ids) as dupe_id, keep_id from canon
)
update payroll_employees e
set department_id = r.keep_id
from remap r
where e.department_id = r.dupe_id
  and r.dupe_id <> r.keep_id;

with canon as (
  select payroll_form_id,
         (array_agg(id order by created_at, id))[1] as keep_id,
         array_agg(id order by created_at, id)    as all_ids
  from payroll_departments
  where status = 'active'
  group by payroll_form_id, lower(btrim(name))
  having count(*) > 1
),
remap as (
  select unnest(all_ids) as dupe_id, keep_id from canon
)
update payroll_employees e
set department_ids = coalesce((
  select array_agg(distinct v)
  from (
    select coalesce(r.keep_id, x) as v
    from unnest(e.department_ids) as x
    left join remap r on r.dupe_id = x
  ) t
), '{}')
where exists (
  select 1 from unnest(e.department_ids) as x
  join remap r on r.dupe_id = x and r.dupe_id <> r.keep_id
);

with canon as (
  select (array_agg(id order by created_at, id))[1] as keep_id,
         array_agg(id order by created_at, id)    as all_ids
  from payroll_departments
  where status = 'active'
  group by payroll_form_id, lower(btrim(name))
  having count(*) > 1
),
remap as (
  select unnest(all_ids) as dupe_id, keep_id from canon
)
update payroll_departments d
set status = 'archived'
from remap r
where d.id = r.dupe_id
  and r.dupe_id <> r.keep_id
  and d.status = 'active';

-- ===================== LOCATIONS =====================

with canon as (
  select (array_agg(id order by created_at, id))[1] as keep_id,
         array_agg(id order by created_at, id)    as all_ids
  from payroll_locations
  where status = 'active'
  group by payroll_form_id, lower(btrim(name))
  having count(*) > 1
),
remap as (
  select unnest(all_ids) as dupe_id, keep_id from canon
)
update payroll_employees e
set primary_location_id = r.keep_id
from remap r
where e.primary_location_id = r.dupe_id
  and r.dupe_id <> r.keep_id;

with canon as (
  select (array_agg(id order by created_at, id))[1] as keep_id,
         array_agg(id order by created_at, id)    as all_ids
  from payroll_locations
  where status = 'active'
  group by payroll_form_id, lower(btrim(name))
  having count(*) > 1
),
remap as (
  select unnest(all_ids) as dupe_id, keep_id from canon
)
update payroll_employees e
set location_ids = coalesce((
  select array_agg(distinct v)
  from (
    select coalesce(r.keep_id, x) as v
    from unnest(e.location_ids) as x
    left join remap r on r.dupe_id = x
  ) t
), '{}')
where exists (
  select 1 from unnest(e.location_ids) as x
  join remap r on r.dupe_id = x and r.dupe_id <> r.keep_id
);

with canon as (
  select (array_agg(id order by created_at, id))[1] as keep_id,
         array_agg(id order by created_at, id)    as all_ids
  from payroll_locations
  where status = 'active'
  group by payroll_form_id, lower(btrim(name))
  having count(*) > 1
),
remap as (
  select unnest(all_ids) as dupe_id, keep_id from canon
)
update payroll_payment_batches b
set location_id = r.keep_id
from remap r
where b.location_id = r.dupe_id
  and r.dupe_id <> r.keep_id;

with canon as (
  select (array_agg(id order by created_at, id))[1] as keep_id,
         array_agg(id order by created_at, id)    as all_ids
  from payroll_locations
  where status = 'active'
  group by payroll_form_id, lower(btrim(name))
  having count(*) > 1
),
remap as (
  select unnest(all_ids) as dupe_id, keep_id from canon
)
update payroll_locations l
set status = 'archived'
from remap r
where l.id = r.dupe_id
  and r.dupe_id <> r.keep_id
  and l.status = 'active';
