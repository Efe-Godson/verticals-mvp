-- Staff logins: real Supabase Auth accounts an admin creates from the POS
-- Admin page, restricted to a single form. `form_staff` is just the
-- assignment record (which auth user belongs to which form); the actual
-- account (email/password) lives in auth.users, created via the
-- manage-staff edge function using the service role key (client-side code
-- can't create confirmed users with the anon key).
create table form_staff (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references forms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (form_id, user_id)
);

alter table form_staff enable row level security;

-- The form owner manages the staff list for forms they own.
create policy "Owners can view their form staff"
on form_staff for select
to authenticated
using (created_by = auth.uid());

create policy "Owners can add form staff"
on form_staff for insert
to authenticated
with check (created_by = auth.uid());

create policy "Owners can remove form staff"
on form_staff for delete
to authenticated
using (created_by = auth.uid());

-- A staff account needs to read its own assignment row client-side (to know
-- which single form it's scoped to and lock the rest of the app down).
create policy "Staff can view their own assignment"
on form_staff for select
to authenticated
using (user_id = auth.uid());

-- Staff get the same read/update access as the owner, but only for the one
-- form they're assigned to (Add Products edits `forms.fields`, Records
-- edits `submissions.data`) - never delete, and never any other form.
create policy "Staff can view their assigned form"
on forms for select
to authenticated
using (exists (
  select 1 from form_staff
  where form_staff.form_id = forms.id and form_staff.user_id = auth.uid()
));

create policy "Staff can update their assigned form"
on forms for update
to authenticated
using (exists (
  select 1 from form_staff
  where form_staff.form_id = forms.id and form_staff.user_id = auth.uid()
))
with check (exists (
  select 1 from form_staff
  where form_staff.form_id = forms.id and form_staff.user_id = auth.uid()
));

create policy "Staff can view submissions of their assigned form"
on submissions for select
to authenticated
using (exists (
  select 1 from form_staff
  where form_staff.form_id = submissions.form_id and form_staff.user_id = auth.uid()
));

create policy "Staff can update submissions of their assigned form"
on submissions for update
to authenticated
using (exists (
  select 1 from form_staff
  where form_staff.form_id = submissions.form_id and form_staff.user_id = auth.uid()
))
with check (exists (
  select 1 from form_staff
  where form_staff.form_id = submissions.form_id and form_staff.user_id = auth.uid()
));
