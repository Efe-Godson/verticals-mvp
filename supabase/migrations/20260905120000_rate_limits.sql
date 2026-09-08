-- Rate limiting for the custom Supabase edge functions (supabase/functions/*).
-- None of the 18 functions in this project enforce any request limit today -
-- Supabase's own dashboard-configurable rate limits only cover the built-in
-- Auth endpoints (login/signup/OTP), not these. Fixed-window counting in
-- Postgres: an in-memory counter wouldn't survive across the separate
-- isolates Deno Deploy spins up per invocation, so the DB is the only place
-- that's actually shared across every call.
create table rate_limits (
  bucket_key   text        not null,
  window_start timestamptz not null,
  count        integer     not null default 0,
  primary key (bucket_key, window_start)
);

-- Atomic check-and-increment: the ON CONFLICT ... DO UPDATE upsert is a single
-- statement, so concurrent calls for the same key/window serialize on
-- Postgres's own row lock instead of racing a separate read-then-write.
-- Returns true (allowed) while count stays at or under p_max, false once the
-- window is over budget. Callers should fail OPEN on any error calling this
-- (see supabase/functions/_shared/rateLimit.ts) - a broken limiter shouldn't
-- take the whole app down.
create or replace function check_rate_limit(p_key text, p_max int, p_window_seconds int)
returns boolean
language plpgsql
security definer
as $$
declare
  v_window_start timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count int;
begin
  insert into rate_limits (bucket_key, window_start, count)
  values (p_key, v_window_start, 1)
  on conflict (bucket_key, window_start) do update set count = rate_limits.count + 1
  returning count into v_count;

  return v_count <= p_max;
end;
$$;

-- Nothing prunes rate_limits on its own, so it grows forever without this.
-- pg_cron may not be enabled on every project this migration runs against,
-- so guard the schedule() call instead of failing the whole migration.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'rate_limits_cleanup',
      '0 3 * * *',
      $cron$delete from rate_limits where window_start < now() - interval '1 day'$cron$
    );
  end if;
end;
$$;
