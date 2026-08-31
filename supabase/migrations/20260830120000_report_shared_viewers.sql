-- Read-only report sharing: a signed-in user whose email is listed in
-- forms.settings -> 'reportSharedEmails' can SELECT that form and its
-- submissions (nothing else). They see only /form/:id/report - the app
-- routes/guards keep them there, and RLS makes sure that's all the data
-- they can actually read.

create or replace function public.email_in_report_share_list(form_settings jsonb)
returns boolean
language sql
stable
as $$
  select coalesce(
    exists (
      select 1
      from jsonb_array_elements_text(coalesce(form_settings -> 'reportSharedEmails', '[]'::jsonb)) as e(addr)
      where lower(btrim(e.addr)) = lower(auth.jwt() ->> 'email')
    ),
    false
  )
$$;

drop policy if exists "Shared viewers can read the form" on forms;
create policy "Shared viewers can read the form"
on forms for select to authenticated
using (public.email_in_report_share_list(settings));

drop policy if exists "Shared viewers can read submissions" on submissions;
create policy "Shared viewers can read submissions"
on submissions for select to authenticated
using (
  exists (
    select 1 from forms
    where forms.id = submissions.form_id
      and public.email_in_report_share_list(forms.settings)
  )
);
