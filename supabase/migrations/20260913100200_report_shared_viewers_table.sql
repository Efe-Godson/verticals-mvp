-- Move report-sharing emails out of forms.settings (a jsonb blob scanned
-- with jsonb_array_elements_text on every RLS check) into a real indexed
-- table, so checking "is this email allowed to view this form's report"
-- is a plain equality lookup instead of a per-row JSON scan.

create table if not exists public.report_shared_viewers (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  unique (form_id, email)
);

alter table public.report_shared_viewers enable row level security;

-- Only the form's owner can see/manage its shared-viewer list.
drop policy if exists "Form owners manage report shared viewers" on public.report_shared_viewers;
create policy "Form owners manage report shared viewers"
on public.report_shared_viewers
for all
to authenticated
using (
  exists (select 1 from public.forms where forms.id = report_shared_viewers.form_id and forms.user_id = auth.uid())
)
with check (
  exists (select 1 from public.forms where forms.id = report_shared_viewers.form_id and forms.user_id = auth.uid())
);

-- Backfill existing forms.settings -> reportSharedEmails into the new table.
insert into public.report_shared_viewers (form_id, email)
select forms.id, lower(btrim(e.addr))
from public.forms, jsonb_array_elements_text(coalesce(forms.settings -> 'reportSharedEmails', '[]'::jsonb)) as e(addr)
where btrim(e.addr) <> ''
on conflict (form_id, email) do nothing;

-- The jsonb copy is now redundant - drop it so there's a single source of truth.
update public.forms
set settings = settings - 'reportSharedEmails'
where settings ? 'reportSharedEmails';

-- SECURITY DEFINER so the forms/submissions RLS policies below can check
-- membership even though ordinary authenticated users (the shared viewers
-- themselves) have no direct SELECT grant on report_shared_viewers.
create or replace function public.is_report_shared_viewer(p_form_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.report_shared_viewers
    where form_id = p_form_id
      and email = lower(auth.jwt() ->> 'email')
  )
$$;

revoke all on function public.is_report_shared_viewer(uuid) from public;
grant execute on function public.is_report_shared_viewer(uuid) to authenticated;

drop policy if exists "Shared viewers can read the form" on public.forms;
create policy "Shared viewers can read the form"
on public.forms for select to authenticated
using (public.is_report_shared_viewer(forms.id));

drop policy if exists "Shared viewers can read submissions" on public.submissions;
create policy "Shared viewers can read submissions"
on public.submissions for select to authenticated
using (public.is_report_shared_viewer(submissions.form_id));

drop function if exists public.email_in_report_share_list(jsonb);

-- Lets FormSettings.jsx replace a form's whole shared-viewer list in one
-- round trip. Runs as the calling (authenticated) user, so it's still
-- gated by the owner-only policy above - not a privilege escalation.
create or replace function public.set_report_shared_viewers(p_form_id uuid, p_emails text[])
returns void
language plpgsql
as $$
begin
  delete from public.report_shared_viewers
  where form_id = p_form_id
    and email <> all (coalesce(p_emails, '{}'::text[]));

  insert into public.report_shared_viewers (form_id, email)
  select p_form_id, email from unnest(coalesce(p_emails, '{}'::text[])) as email
  on conflict (form_id, email) do nothing;
end;
$$;

revoke all on function public.set_report_shared_viewers(uuid, text[]) from public;
grant execute on function public.set_report_shared_viewers(uuid, text[]) to authenticated;
