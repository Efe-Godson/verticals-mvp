-- Account-wide preferences (currently just the theme color picked on
-- AccountPage.jsx), stored server-side instead of localStorage so they're
-- consistent across every device/browser the account signs into - and
-- visible to that account's staff logins too, so a shared POS device shows
-- the same brand color regardless of which login is active on it.
create table account_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme_color text,
  updated_at timestamptz not null default now()
);

alter table account_settings enable row level security;

create policy "Owners manage their own settings"
on account_settings for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Staff read (never write) the settings of whichever owner created their
-- login, via the same form_staff.created_by link used elsewhere for
-- staff/owner association.
create policy "Staff can view their employer's settings"
on account_settings for select
to authenticated
using (exists (
  select 1 from form_staff
  where form_staff.user_id = auth.uid() and form_staff.created_by = account_settings.user_id
));
