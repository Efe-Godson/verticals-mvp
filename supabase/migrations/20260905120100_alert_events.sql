-- Admin-only "Alerts" feed (src/AlertsPage.jsx, /lab/alerts). One generic
-- table for every alert type this app produces, distinguished by `type` with
-- a per-type `detail` shape rather than a separate table per kind:
--   'rate_limit'          -> { function, key, ip, ...whatever else that
--                              function's call site passed }
--   'concurrent_sessions' -> { user_id, email, sessions: [{ ip, user_agent,
--                              created_at }, ...] }
create table alert_events (
  id         uuid primary key default gen_random_uuid(),
  type       text        not null,
  detail     jsonb       not null,
  created_at timestamptz not null default now()
);
create index alert_events_created_at_idx on alert_events (created_at desc);

-- No RLS policies granting access on purpose: the client never reads this
-- directly (RLS defaults to deny-all with RLS enabled and no policies), only
-- AlertsPage.jsx's own edge-function-backed fetch (service role) can. Edge
-- functions insert with the service-role key too, which also bypasses RLS.
alter table alert_events enable row level security;
