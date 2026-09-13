-- Google-Workspace-style collaborator sharing for workflows/locations.
--
-- This is a third, independent form of non-owner access, alongside the two
-- that already exist: form_staff (a real POS login, full read/write, scoped
-- to exactly one form, created with a password the owner sets directly) and
-- report_shared_viewers (read-only, no role concept, scoped to exactly one
-- form's report, access granted purely by email match). collaborator_shares
-- invites another person's own Supabase Auth account (via Supabase's
-- built-in invite email) to collaborate as 'admin' (same read/write as the
-- owner) or 'viewer' (read-only) - on either a whole *workflow* or a single
-- *location*.
--
-- Two scope grains, mutually exclusive per row (enforced by
-- collaborator_shares_scope_shape below):
--   'workflow' - form_id is null; owner_id + template_slug identify every
--                forms row that owner has, OR EVER WILL HAVE, tagged with
--                that templateSlug. Deliberately dynamic: a location added
--                to the workflow after the share was created is
--                automatically covered, because get_share_role (below)
--                re-resolves scope live from forms.user_id/
--                settings->>templateSlug on every check rather than
--                snapshotting a list of form ids at share time.
--   'location' - form_id is not null, template_slug is null; identifies
--                exactly one forms row, independent of whatever workflow
--                it happens to belong to.
--
-- template_slug is NOT globally unique (two unrelated accounts can each run
-- their own "restaurant" workflow at slug 'restaurant'), so every
-- workflow-scope row is always keyed on (owner_id, template_slug) together,
-- never template_slug alone - the same reasoning BusinessesHome.jsx/
-- RecordsHome.jsx/Reports.jsx's grouping has to follow client-side too.
create table public.collaborator_shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  scope text not null check (scope in ('workflow', 'location')),
  template_slug text,
  form_id uuid references public.forms(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'viewer')),
  -- Always equal to owner_id today (only the owner manages shares) - kept as
  -- its own column anyway, mirroring form_staff.created_by, so a future
  -- loosening of that rule doesn't need a schema change, just a policy one.
  invited_by uuid not null references auth.users(id),
  -- Denormalized from the owner's own JWT at invite time (see
  -- manage-share/index.ts). There's no profiles table in this app and a
  -- collaborator has no RLS grant to look a stranger's email up in
  -- auth.users themselves, so this is the only way BusinessesHome.jsx/
  -- RecordsHome.jsx/Reports.jsx can render a "Shared by X" badge.
  owner_email text not null,
  created_at timestamptz not null default now(),
  constraint collaborator_shares_scope_shape check (
    (scope = 'workflow' and template_slug is not null and form_id is null)
    or
    (scope = 'location' and form_id is not null and template_slug is null)
  ),
  -- Composite uniqueness relies on ordinary SQL NULL semantics to stay
  -- scoped to the right grain without needing a partial index: a
  -- workflow-scope row always has template_slug set, so this constraint
  -- only ever compares (and conflicts) among other workflow-scope rows -
  -- location-scope rows (template_slug always null) never trip it, because
  -- SQL never treats NULL as equal to NULL for uniqueness purposes.
  unique (owner_id, template_slug, email),
  -- Symmetric: form_id is only ever set on location-scope rows, so this
  -- only fires among those. Deliberately NOT partial/expression indexes -
  -- supabase-js's upsert({ onConflict }) can only target a plain unique
  -- index that matches a literal column list; see the normalizing trigger
  -- below for why that's still case-insensitive.
  unique (form_id, email)
);

alter table public.collaborator_shares enable row level security;

-- Case-insensitive email, enforced at the DB layer rather than trusted from
-- whatever writes the row (the edge function normalizes too, but RLS lets
-- the owner write this table directly - see the policy below - so this is
-- the actual source of truth get_share_role can rely on).
create or replace function public.normalize_collaborator_share_email()
returns trigger
language plpgsql
as $$
begin
  new.email = lower(btrim(new.email));
  return new;
end;
$$;

create trigger trg_collaborator_shares_normalize_email
before insert or update on public.collaborator_shares
for each row
execute function public.normalize_collaborator_share_email();

-- Reverse lookup ("which workflows/locations are shared to me") that the
-- two composite unique constraints above don't serve - neither leads with
-- email, so list_accessible_workflows() below needs this to avoid a full
-- table scan.
create index collaborator_shares_email_idx on public.collaborator_shares (email);

-- Only the owner can see/manage the full share list for their own
-- workflows/locations. A collaborator gets their own, separate, narrower
-- grant below - not through this policy.
create policy "Owners manage their collaborator shares"
on public.collaborator_shares for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

-- Lets a collaborator see the share row(s) that grant them access (e.g. so
-- the app can tell them who owns something shared with them), without
-- exposing any other row on this table. No security definer needed here -
-- unlike report_shared_viewers, this is a direct, self-only grant.
create policy "Collaborators can view their own shares"
on public.collaborator_shares for select
to authenticated
using (email = lower(auth.jwt() ->> 'email'));

-- Resolves the caller's effective role ('admin' | 'viewer' | null) for a
-- given form, checking both a direct location-scope share and a
-- workflow-scope share (joined through forms.user_id/settings->>templateSlug
-- so a location added to a shared workflow after the share was created is
-- covered automatically). security definer for two independent reasons:
-- (1) it queries forms from inside a policy defined ON forms - since this
-- function runs as its owning (table-owning, RLS-exempt) role rather than
-- the calling user, that inner query never re-evaluates forms' own SELECT
-- policy, which is what avoids "infinite recursion detected in policy for
-- relation forms" rather than merely happening to dodge it; and (2) it
-- needs to read collaborator_shares rows for the workflow-scope branch.
create or replace function public.get_share_role(p_form_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  with candidate_roles as (
    select cs.role
    from public.collaborator_shares cs
    where cs.scope = 'location'
      and cs.form_id = p_form_id
      and cs.email = lower(auth.jwt() ->> 'email')

    union all

    select cs.role
    from public.forms f
    join public.collaborator_shares cs
      on cs.scope = 'workflow'
     and cs.owner_id = f.user_id
     and cs.template_slug = f.settings ->> 'templateSlug'
    where f.id = p_form_id
      and cs.email = lower(auth.jwt() ->> 'email')
  )
  select case
    when exists (select 1 from candidate_roles where role = 'admin') then 'admin'
    when exists (select 1 from candidate_roles where role = 'viewer') then 'viewer'
    else null
  end
$$;

revoke all on function public.get_share_role(uuid) from public;
grant execute on function public.get_share_role(uuid) to authenticated;

-- Additive - the pre-existing owner-only SELECT/INSERT/UPDATE policies on
-- forms predate this repo's migration history and aren't touched; these
-- stack alongside them the same way form_staff/report_shared_viewers's
-- policies already do (multiple permissive policies for the same command
-- simply OR together, already proven safe in this schema - see
-- 20260911150000_fix_demo_policies_anon_access.sql for forms' existing
-- several coexisting SELECT policies).
create policy "Collaborators can read shared forms"
on public.forms for select
to authenticated
using (public.get_share_role(forms.id) is not null);

create policy "Admin collaborators can update shared forms"
on public.forms for update
to authenticated
using (public.get_share_role(forms.id) = 'admin')
with check (public.get_share_role(forms.id) = 'admin');

create policy "Admin collaborators can delete shared forms"
on public.forms for delete
to authenticated
using (public.get_share_role(forms.id) = 'admin');

-- The one INSERT case that's genuinely new: an admin collaborator creating a
-- *new* forms row on behalf of the workflow owner (new.user_id = the owner,
-- not auth.uid()) - this is what makes Add Location/Duplicate work under a
-- shared workflow. Deliberately NOT security definer: this EXISTS queries
-- collaborator_shares (not forms), and the caller already has a direct,
-- plain RLS grant to see their own row there via "Collaborators can view
-- their own shares" above, so there's no visibility gap to bypass and no
-- recursion risk (collaborator_shares' own policies never touch forms).
create policy "Admin collaborators can create locations for a shared workflow"
on public.forms for insert
to authenticated
with check (
  exists (
    select 1 from public.collaborator_shares cs
    where cs.scope = 'workflow'
      and cs.role = 'admin'
      and cs.owner_id = forms.user_id
      and cs.template_slug = forms.settings ->> 'templateSlug'
      and cs.email = lower(auth.jwt() ->> 'email')
  )
);

-- Mirrors forms, using get_share_role(submissions.form_id) directly - no
-- join through forms needed, since get_share_role already takes a form id
-- and resolves both scope grains internally.
create policy "Collaborators can read shared submissions"
on public.submissions for select
to authenticated
using (public.get_share_role(submissions.form_id) is not null);

create policy "Admin collaborators can insert shared submissions"
on public.submissions for insert
to authenticated
with check (public.get_share_role(submissions.form_id) = 'admin');

create policy "Admin collaborators can update shared submissions"
on public.submissions for update
to authenticated
using (public.get_share_role(submissions.form_id) = 'admin')
with check (public.get_share_role(submissions.form_id) = 'admin');

create policy "Admin collaborators can delete shared submissions"
on public.submissions for delete
to authenticated
using (public.get_share_role(submissions.form_id) = 'admin');

-- One combined lookup for "every workflow I own or have been given access
-- to", grouped by (owner_id, template_slug) - the shape BusinessesHome.jsx,
-- RecordsHome.jsx and Reports.jsx all need. security definer because the
-- workflow-scope branch has to read *other people's* forms rows to resolve
-- "every location under this shared workflow" - something the caller has no
-- direct grant to enumerate wholesale (get_share_role would let them read
-- each one individually via RLS, but this function does the joining itself
-- instead of relying on that, one row per accessible form). Not called from
-- inside a forms policy, so there's no recursion concern here the way there
-- is for get_share_role - this is only ever invoked directly as a client RPC.
create or replace function public.list_accessible_workflows()
returns table (
  owner_id uuid,
  template_slug text,
  role text,        -- 'owner' | 'admin' | 'viewer'
  owner_email text,  -- null when role = 'owner' (it's you)
  form_ids uuid[]
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
  select owner_id, template_slug,
         case when bool_or(role = 'owner') then 'owner'
              when bool_or(role = 'admin') then 'admin'
              else 'viewer' end as role,
         max(owner_email) as owner_email,
         array_agg(distinct form_id) as form_ids
  from rows
  group by owner_id, template_slug
$$;

revoke all on function public.list_accessible_workflows() from public;
grant execute on function public.list_accessible_workflows() to authenticated;
