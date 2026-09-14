-- Lets a workflow's Home tile show a name the account chose (e.g. "Downtown
-- Diner") instead of always the shared template's generic name (e.g.
-- "Restaurant"), which is what BusinessesHome.jsx showed unconditionally
-- until now with no way to change it. Keyed by (owner_id, template_slug) -
-- the same grain BusinessesHome.jsx/RecordsHome.jsx/Reports.jsx/
-- collaborator_shares already group a "workflow" by. No row for a given
-- (owner_id, template_slug) means "use the template's own name" -
-- list_accessible_workflows() below returns null in that case and
-- BusinessesHome.jsx falls back to template.name itself.
create table public.workflow_names (
  owner_id uuid not null references auth.users(id) on delete cascade,
  template_slug text not null,
  display_name text not null,
  updated_at timestamptz not null default now(),
  primary key (owner_id, template_slug)
);

alter table public.workflow_names enable row level security;

-- No SELECT policy at all, on purpose: every read goes through
-- list_accessible_workflows() below (security definer), which already
-- resolves exactly which workflows a caller can see - a direct table read
-- would just duplicate that logic and risk falling out of sync with it.
create policy "Owners manage their workflow names"
on public.workflow_names for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

-- Same "workflow scope + admin role" check collaborator_shares.sql already
-- uses for who can create/delete forms under a shared workflow - renaming
-- the workflow itself is the same tier of action, so an admin collaborator
-- gets the same write access an owner has here, a viewer gets none.
create policy "Admin collaborators can insert workflow names"
on public.workflow_names for insert
to authenticated
with check (
  exists (
    select 1 from public.collaborator_shares cs
    where cs.scope = 'workflow' and cs.role = 'admin'
      and cs.owner_id = workflow_names.owner_id
      and cs.template_slug = workflow_names.template_slug
      and cs.email = lower(auth.jwt() ->> 'email')
  )
);

create policy "Admin collaborators can update workflow names"
on public.workflow_names for update
to authenticated
using (
  exists (
    select 1 from public.collaborator_shares cs
    where cs.scope = 'workflow' and cs.role = 'admin'
      and cs.owner_id = workflow_names.owner_id
      and cs.template_slug = workflow_names.template_slug
      and cs.email = lower(auth.jwt() ->> 'email')
  )
)
with check (
  exists (
    select 1 from public.collaborator_shares cs
    where cs.scope = 'workflow' and cs.role = 'admin'
      and cs.owner_id = workflow_names.owner_id
      and cs.template_slug = workflow_names.template_slug
      and cs.email = lower(auth.jwt() ->> 'email')
  )
);

create policy "Admin collaborators can delete workflow names"
on public.workflow_names for delete
to authenticated
using (
  exists (
    select 1 from public.collaborator_shares cs
    where cs.scope = 'workflow' and cs.role = 'admin'
      and cs.owner_id = workflow_names.owner_id
      and cs.template_slug = workflow_names.template_slug
      and cs.email = lower(auth.jwt() ->> 'email')
  )
);

-- list_accessible_workflows() gains a workflow_name column (left-joined
-- from workflow_names). CREATE OR REPLACE can't change a function's return
-- shape, so this drops and recreates it exactly as
-- 20260913170000_collaborator_shares.sql defined it, plus that one join.
drop function if exists public.list_accessible_workflows();

create function public.list_accessible_workflows()
returns table (
  owner_id uuid,
  template_slug text,
  role text,        -- 'owner' | 'admin' | 'viewer'
  owner_email text,  -- null when role = 'owner' (it's you)
  form_ids uuid[],
  workflow_name text -- null when nobody's renamed this workflow
)
language sql
stable
security definer
set search_path = public
as $$
  with rows as (
    select f.user_id as owner_id, f.settings ->> 'templateSlug' as template_slug,
           'owner'::text as role, null::text as owner_email, f.id as form_id
    from public.forms f
    where f.user_id = auth.uid()
      and f.deleted_at is null
      and f.settings ->> 'templateSlug' is not null
      and f.settings ->> 'primaryFormId' is null

    union all

    -- Whole workflows shared to me - joins forms live, so a location added
    -- to the workflow after the share was created shows up automatically.
    select cs.owner_id, cs.template_slug, cs.role, cs.owner_email, f.id as form_id
    from public.collaborator_shares cs
    join public.forms f
      on f.user_id = cs.owner_id
     and f.settings ->> 'templateSlug' = cs.template_slug
    where cs.scope = 'workflow'
      and cs.email = lower(auth.jwt() ->> 'email')
      and f.deleted_at is null
      and f.settings ->> 'primaryFormId' is null

    union all

    -- Individual locations shared to me one at a time - only that one form,
    -- not every other location under the same owner+slug.
    select cs.owner_id, f.settings ->> 'templateSlug' as template_slug,
           cs.role, cs.owner_email, f.id as form_id
    from public.collaborator_shares cs
    join public.forms f on f.id = cs.form_id
    where cs.scope = 'location'
      and cs.email = lower(auth.jwt() ->> 'email')
      and f.deleted_at is null
  )
  select r.owner_id, r.template_slug,
         case when bool_or(r.role = 'owner') then 'owner'
              when bool_or(r.role = 'admin') then 'admin'
              else 'viewer' end as role,
         max(r.owner_email) as owner_email,
         array_agg(distinct r.form_id) as form_ids,
         max(wn.display_name) as workflow_name
  from rows r
  left join public.workflow_names wn
    on wn.owner_id = r.owner_id and wn.template_slug = r.template_slug
  group by r.owner_id, r.template_slug
$$;

revoke all on function public.list_accessible_workflows() from public;
grant execute on function public.list_accessible_workflows() to authenticated;
