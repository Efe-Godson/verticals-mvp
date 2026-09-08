-- Feeds the "same account signed in from multiple places" alert on
-- src/AlertsPage.jsx. One row per sign-in (src/AuthContext.jsx calls
-- supabase/functions/log-sign-in on every SIGNED_IN event) rather than
-- building on Supabase's own auth.sessions - that table's exact columns
-- aren't a documented/portable surface (varies by Supabase version, isn't
-- guaranteed to carry IP/user-agent), so this logs our own minimal event
-- with exactly the fields the alert needs instead.
create table sign_in_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid        not null,
  ip         text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index sign_in_events_user_id_idx on sign_in_events (user_id, created_at desc);

alter table sign_in_events enable row level security;

-- "Concurrent" without a logout event: treat a sign-in as still active for
-- p_window_hours (roughly a typical session lifetime) rather than tracking
-- real logouts. Keeps only the most recent sign-in per distinct IP for a
-- user, then flags anyone with 2+ distinct IPs still "active" in that
-- window - one legitimate device re-signing in repeatedly from the same IP
-- never counts as concurrent.
create or replace function list_concurrent_sessions(p_window_hours int default 24)
returns table (user_id uuid, email text, sessions jsonb)
language sql
security definer
set search_path = public, auth
as $$
  with recent as (
    select se.user_id, se.ip, se.user_agent, se.created_at,
      row_number() over (
        partition by se.user_id, coalesce(se.ip, '')
        order by se.created_at desc
      ) as rn
    from sign_in_events se
    where se.created_at > now() - (p_window_hours::text || ' hours')::interval
  ),
  latest_per_ip as (
    select user_id, ip, user_agent, created_at from recent where rn = 1
  ),
  grouped as (
    select
      user_id,
      count(distinct coalesce(ip, '')) as ip_count,
      jsonb_agg(
        jsonb_build_object('ip', ip, 'user_agent', user_agent, 'created_at', created_at)
        order by created_at desc
      ) as sessions
    from latest_per_ip
    group by user_id
    having count(distinct coalesce(ip, '')) > 1
  )
  select g.user_id, u.email, g.sessions
  from grouped g
  join auth.users u on u.id = g.user_id;
$$;
