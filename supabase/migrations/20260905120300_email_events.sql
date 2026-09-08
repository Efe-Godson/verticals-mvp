-- Feeds the "Email Monitor" Lab page (src/EmailMonitorPage.jsx, /lab/
-- email-monitor). First card: password-reset/OTP request volume, written by
-- the request-password-reset edge function on every attempt - whether or not
-- the email actually matches an account (account_existed is for this
-- internal view only, never returned to the caller - see that function).
create table email_events (
  id              uuid primary key default gen_random_uuid(),
  type            text        not null,   -- 'password_reset_request' for now
  email           text        not null,
  account_existed boolean     not null,
  ip              text,
  created_at      timestamptz not null default now()
);
create index email_events_created_at_idx on email_events (created_at desc);

alter table email_events enable row level security;

-- Whether `p_email` matches a real account, without exposing anything else
-- about auth.users to the caller - request-password-reset uses this to
-- decide whether to actually trigger a reset email, while still returning
-- the same generic response either way.
create or replace function email_exists(p_email text)
returns boolean
language sql
security definer
set search_path = auth
as $$
  select exists(select 1 from auth.users where lower(email) = lower(p_email));
$$;
