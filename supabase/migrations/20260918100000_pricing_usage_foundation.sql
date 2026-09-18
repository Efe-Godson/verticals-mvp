-- Pricing & Usage system, Phases 0-2 (see the approved plan). "Workspace" is
-- just the owner's auth.users.id - same grain forms.user_id/
-- collaborator_shares.owner_id/workflow_names.owner_id already use, no new
-- workspace entity. Counting is trigger-based rather than a JS-level
-- recordEntryUsage() call: submit-form runs as service_role, so an
-- RLS-based gate would silently not apply to the highest-volume creation
-- path - triggers fire regardless of role and cover every insert path
-- (public form, bulk import, quick-add expense, payroll) with one
-- mechanism. Live payment is explicitly out of scope here; the
-- payment-provider columns are reserved now so Phase 4 never needs a
-- schema change, only a value change.

-- ---------------------------------------------------------------------------
-- 1. plan_catalogue - the only source of truth for prices/limits. Frontend
-- fetches these rows to render pricing UI; activate_plan() below re-reads
-- this table itself rather than trusting anything the client sends.
-- ---------------------------------------------------------------------------
create table plan_catalogue (
  plan text not null,
  billing_interval text not null,
  entry_limit integer,       -- null = custom (enterprise)
  price_ngn numeric,         -- null = custom (enterprise)
  discount_pct integer not null default 0,
  primary key (plan, billing_interval)
);

alter table plan_catalogue enable row level security;
create policy "Anyone can read the plan catalogue"
on plan_catalogue for select
to anon, authenticated
using (true);

insert into plan_catalogue (plan, billing_interval, entry_limit, price_ngn, discount_pct) values
  ('free', 'monthly', 100, 0, 0),
  ('starter', 'monthly', 500, 2500, 0),
  ('starter', 'quarterly', 500, 7125, 5),
  ('starter', 'half_year', 500, 13500, 10),
  ('starter', 'yearly', 500, 24000, 20),
  ('business', 'monthly', 2000, 5000, 0),
  ('business', 'quarterly', 2000, 14250, 5),
  ('business', 'half_year', 2000, 27000, 10),
  ('business', 'yearly', 2000, 48000, 20),
  ('growth', 'monthly', 5000, 10000, 0),
  ('growth', 'quarterly', 5000, 28500, 5),
  ('growth', 'half_year', 5000, 54000, 10),
  ('growth', 'yearly', 5000, 96000, 20),
  ('scale', 'monthly', 15000, 20000, 0),
  ('scale', 'quarterly', 15000, 57000, 5),
  ('scale', 'half_year', 15000, 108000, 10),
  ('scale', 'yearly', 15000, 192000, 20),
  ('enterprise', 'monthly', null, null, 0);

-- ---------------------------------------------------------------------------
-- 2. subscriptions - one row per owner.
-- ---------------------------------------------------------------------------
create table subscriptions (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free'
    check (plan in ('free','starter','business','growth','scale','enterprise')),
  billing_interval text not null default 'monthly'
    check (billing_interval in ('monthly','quarterly','half_year','yearly')),
  entry_limit integer not null default 100,
  price_ngn numeric not null default 0,
  -- Only 'active'/'cancelled' are written until the grace-period/reminder
  -- system (a separate later phase) lands - the rest are valid now so that
  -- phase doesn't need an alter table.
  status text not null default 'active'
    check (status in ('active','expiring_soon','grace_period','restricted','cancelled','past_due','expired')),
  -- Billing cycle (length = billing_interval) - renewal/expiry.
  current_period_start timestamptz,
  current_period_end timestamptz,
  -- Entries cycle - always ~30 days, anchored independently of billing
  -- interval. This is the actual mechanism for "yearly Starter still gets
  -- 500/month, not 6000 upfront."
  usage_period_start timestamptz not null default now(),
  usage_period_end timestamptz not null default (now() + interval '30 days'),
  -- Set on downgrade/cancel; applied at current_period_end by a later
  -- phase's cron job. Until that job exists, a downgrade is stored but the
  -- live entry_limit doesn't change yet - documented Phase 1 behavior, not
  -- a bug (see the plan's verification section).
  pending_plan text,
  pending_billing_interval text,
  pending_entry_limit integer,
  pending_price_ngn numeric,
  cancel_at_period_end boolean not null default false,
  -- Payment-provider seam - unused until a provider is chosen.
  payment_provider text,
  provider_customer_id text,
  provider_subscription_id text,
  provider_reference text,
  activated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table subscriptions enable row level security;
-- Read-only via RLS - the only way to change plan/limit/price is through
-- activate_plan() below (security definer, re-validates against
-- plan_catalogue itself), never a direct client write.
create policy "Owners can read their own subscription"
on subscriptions for select
to authenticated
using (owner_id = auth.uid());

-- Backfill for EXISTING accounts only - explicitly overrides entry_limit
-- to an effectively-unlimited placeholder rather than falling through to
-- the column's real Free-tier default (100). This is the actual Phase 0
-- promise: nothing user-visible changes and nobody already using
-- Verticals gets capped/blocked by this migration landing. A brand-new
-- signup after this point (see get_or_create_subscription/
-- insert_usage_event's lazy provisioning below) correctly gets the real
-- 100/month Free default instead - only this one-time backfill needs the
-- override.
insert into subscriptions (owner_id, entry_limit)
select id, 999999999 from auth.users
on conflict (owner_id) do nothing;

-- ---------------------------------------------------------------------------
-- 3. workspace_usage - monthly aggregate. entry_limit is snapshotted per
-- period so a later plan change doesn't rewrite the usage-history table.
-- ---------------------------------------------------------------------------
create table workspace_usage (
  owner_id uuid not null references auth.users(id) on delete cascade,
  usage_period_start timestamptz not null,
  usage_period_end timestamptz not null,
  entries_used integer not null default 0,
  entry_limit integer not null,
  primary key (owner_id, usage_period_start)
);

alter table workspace_usage enable row level security;
create policy "Owners can read their own usage"
on workspace_usage for select
to authenticated
using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4. workspace_usage_events - event grain, feeds the analytics charts and
-- is the duplicate-count guard (unique source_table+source_id).
-- ---------------------------------------------------------------------------
create table workspace_usage_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_table text not null,
  source_id uuid not null,
  workflow text,      -- forms.settings->>'templateSlug', or 'payroll'
  entry_type text,     -- sale / expense / inventory / payroll / form_submission / other
  entry_source text,   -- public_form / manual / import
  created_at timestamptz not null default now(),
  unique (source_table, source_id)
);
create index workspace_usage_events_owner_created_idx on workspace_usage_events (owner_id, created_at);
create index workspace_usage_events_owner_workflow_idx on workspace_usage_events (owner_id, workflow);

alter table workspace_usage_events enable row level security;
create policy "Owners can read their own usage events"
on workspace_usage_events for select
to authenticated
using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 5. templates gets an opt-out flag + category, so classifying a NEW
-- template later (or excluding a Lab feature once it graduates into the
-- main app) is a data change, not a trigger-code change.
-- ---------------------------------------------------------------------------
alter table templates add column counts_as_entry boolean not null default true;
alter table templates add column entry_type text;

update templates set entry_type = 'sale' where slug in ('restaurant-order-pay', 'retail-shop');
update templates set entry_type = 'expense' where slug = 'expenses';
update templates set entry_type = 'inventory' where slug = 'inventory';
update templates set entry_type = 'form_submission' where slug = 'forms';

-- ---------------------------------------------------------------------------
-- 6. submissions gets a provenance tag - one string literal added at each
-- existing insert call site (submit-form, Records.jsx's bulk import,
-- QuickAddExpense.jsx), not a new function call to remember.
-- ---------------------------------------------------------------------------
alter table submissions add column created_via text;

-- ---------------------------------------------------------------------------
-- 7. Shared counting helper. Idempotent (unique violation on the event =
-- no-op, not a double charge) and upserts the monthly aggregate with a
-- locking UPDATE so concurrent inserts (e.g. two POS terminals) serialize
-- correctly instead of racing a read-then-write.
-- ---------------------------------------------------------------------------
create or replace function insert_usage_event(
  p_owner_id uuid, p_workflow text, p_entry_type text,
  p_source_table text, p_source_id uuid, p_entry_source text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_sub subscriptions%rowtype;
begin
  begin
    insert into workspace_usage_events (owner_id, workflow, entry_type, source_table, source_id, entry_source)
    values (p_owner_id, p_workflow, p_entry_type, p_source_table, p_source_id, p_entry_source);
  exception when unique_violation then
    return; -- already counted (e.g. a retried request) - not a second charge
  end;

  -- Lazily provision a default Free row - matches this codebase's existing
  -- pattern (account_settings has no signup trigger either; it's created
  -- on first write). The migration's own backfill covers every existing
  -- user; this covers anyone who signs up after it runs.
  insert into subscriptions (owner_id) values (p_owner_id) on conflict (owner_id) do nothing;
  select * into v_sub from subscriptions where owner_id = p_owner_id;

  insert into workspace_usage (owner_id, usage_period_start, usage_period_end, entries_used, entry_limit)
  values (p_owner_id, v_sub.usage_period_start, v_sub.usage_period_end, 1, v_sub.entry_limit)
  on conflict (owner_id, usage_period_start) do update
    set entries_used = workspace_usage.entries_used + 1;
end;
$$;
revoke all on function insert_usage_event(uuid,text,text,text,uuid,text) from public, anon, authenticated;
grant execute on function insert_usage_event(uuid,text,text,text,uuid,text) to service_role;

-- ---------------------------------------------------------------------------
-- 8. Gate function - the sole authority for "can this owner create another
-- entry right now." No RLS WITH CHECK duplicates this; one authority avoids
-- the two drifting out of sync later.
-- ---------------------------------------------------------------------------
create or replace function can_create_entry(p_owner_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_sub subscriptions%rowtype;
  v_used integer;
begin
  insert into subscriptions (owner_id) values (p_owner_id) on conflict (owner_id) do nothing;
  select * into v_sub from subscriptions where owner_id = p_owner_id;
  select entries_used into v_used from workspace_usage
    where owner_id = p_owner_id and usage_period_start = v_sub.usage_period_start;
  return coalesce(v_used, 0) < v_sub.entry_limit;
end;
$$;
revoke all on function can_create_entry(uuid) from public, anon, authenticated;
grant execute on function can_create_entry(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 9. submissions triggers (public form / bulk import / quick-add expense -
-- every one of them, since all three insert into this same table).
-- ---------------------------------------------------------------------------
create or replace function trg_gate_submissions() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
begin
  select user_id into v_owner from forms where id = new.form_id;
  if v_owner is not null and not can_create_entry(v_owner) then
    raise exception 'ENTRY_LIMIT_REACHED: You have reached your monthly entry limit. Upgrade your plan to keep adding records.';
  end if;
  return new;
end;
$$;
create trigger gate_submissions_insert before insert on submissions
  for each row execute function trg_gate_submissions();

create or replace function trg_count_submissions() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_slug text;
  v_type text;
  v_counts boolean;
begin
  select f.user_id, f.settings->>'templateSlug' into v_owner, v_slug from forms f where f.id = new.form_id;
  if v_owner is null then return new; end if;

  select t.entry_type, t.counts_as_entry into v_type, v_counts from templates t where t.slug = v_slug;
  if v_counts is false then return new; end if;

  perform insert_usage_event(v_owner, v_slug, coalesce(v_type, 'form_submission'), 'submissions', new.id, coalesce(new.created_via, 'manual'));
  return new;
end;
$$;
create trigger count_submissions_insert after insert on submissions
  for each row execute function trg_count_submissions();

-- ---------------------------------------------------------------------------
-- 10. payroll_records triggers. payroll_records.upsert(...) in
-- src/payroll/payrollApi.js uses ON CONFLICT DO UPDATE, so Postgres only
-- ever fires AFTER INSERT for the genuinely-new (employee, month) row, never
-- on a recompute that hits the conflict path - no JS-side diffing needed.
-- ---------------------------------------------------------------------------
create or replace function trg_gate_payroll_records() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
begin
  select user_id into v_owner from forms where id = new.payroll_form_id;
  if v_owner is not null and not can_create_entry(v_owner) then
    raise exception 'ENTRY_LIMIT_REACHED: You have reached your monthly entry limit. Upgrade your plan to keep adding records.';
  end if;
  return new;
end;
$$;
create trigger gate_payroll_records_insert before insert on payroll_records
  for each row execute function trg_gate_payroll_records();

create or replace function trg_count_payroll_records() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
begin
  select user_id into v_owner from forms where id = new.payroll_form_id;
  if v_owner is null then return new; end if;
  perform insert_usage_event(v_owner, 'payroll', 'payroll', 'payroll_records', new.id, 'manual');
  return new;
end;
$$;
create trigger count_payroll_records_insert after insert on payroll_records
  for each row execute function trg_count_payroll_records();

-- ---------------------------------------------------------------------------
-- 11. Manual plan activation - stands in for real checkout (no payment
-- provider chosen yet). Prices/limits are read from plan_catalogue here,
-- never trusted from the caller. Upgrade/lateral (same-or-more capacity, or
-- an interval-only switch) applies immediately without touching
-- entries_used; anything with strictly less capacity (including moving to
-- free) is deferred to pending_* until a later phase's period-end job
-- applies it.
-- ---------------------------------------------------------------------------
create or replace function activate_plan(p_actor uuid, p_plan text, p_billing_interval text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_catalogue plan_catalogue%rowtype;
  v_current subscriptions%rowtype;
  v_is_downgrade boolean;
begin
  if p_plan = 'enterprise' then
    raise exception 'Enterprise plans are set up by Verticals support - use Contact Sales.';
  end if;

  select * into v_catalogue from plan_catalogue where plan = p_plan and billing_interval = p_billing_interval;
  if v_catalogue.plan is null then raise exception 'Unknown plan or billing interval'; end if;

  insert into subscriptions (owner_id) values (p_actor) on conflict (owner_id) do nothing;
  select * into v_current from subscriptions where owner_id = p_actor for update;

  if v_current.plan = p_plan and v_current.billing_interval = p_billing_interval then
    return to_jsonb(v_current); -- already on this exact plan/interval - no-op
  end if;

  v_is_downgrade := p_plan = 'free'
    or (v_catalogue.entry_limit is not null and v_current.entry_limit is not null and v_catalogue.entry_limit < v_current.entry_limit);

  if v_is_downgrade then
    update subscriptions set
      pending_plan = p_plan,
      pending_billing_interval = p_billing_interval,
      pending_entry_limit = v_catalogue.entry_limit,
      pending_price_ngn = v_catalogue.price_ngn,
      cancel_at_period_end = (p_plan = 'free'),
      updated_at = now()
    where owner_id = p_actor;
  else
    update subscriptions set
      plan = p_plan,
      billing_interval = p_billing_interval,
      entry_limit = v_catalogue.entry_limit,
      price_ngn = v_catalogue.price_ngn,
      status = 'active',
      current_period_start = now(),
      current_period_end = now() + (case p_billing_interval
        when 'monthly' then interval '1 month'
        when 'quarterly' then interval '3 months'
        when 'half_year' then interval '6 months'
        when 'yearly' then interval '1 year'
      end),
      pending_plan = null, pending_billing_interval = null, pending_entry_limit = null, pending_price_ngn = null,
      cancel_at_period_end = false,
      activated_by = 'manual',
      updated_at = now()
    where owner_id = p_actor;
  end if;

  select * into v_current from subscriptions where owner_id = p_actor;
  return to_jsonb(v_current);
end;
$$;
revoke all on function activate_plan(uuid,text,text) from public, anon, authenticated;
grant execute on function activate_plan(uuid,text,text) to service_role;

-- Read-your-own-row-or-create-the-default, safe to expose directly to
-- authenticated (unlike activate_plan): it never accepts a plan/price/limit
-- parameter, so there's nothing for a caller to spoof - it can only ever
-- provision the same all-defaults Free row insert_usage_event/
-- can_create_entry already lazily create on first use. Lets
-- src/BillingPage.jsx's very first visit work for a brand-new account that
-- hasn't created a single record yet (and therefore has no subscriptions
-- row at all).
create or replace function get_or_create_subscription() returns subscriptions
language plpgsql security definer set search_path = public as $$
declare
  v_sub subscriptions%rowtype;
begin
  insert into subscriptions (owner_id) values (auth.uid()) on conflict (owner_id) do nothing;
  select * into v_sub from subscriptions where owner_id = auth.uid();
  return v_sub;
end;
$$;
grant execute on function get_or_create_subscription() to authenticated;

-- ---------------------------------------------------------------------------
-- 12. Analytics reads (Phase 2). Plain (non-definer) stable functions - RLS
-- on workspace_usage_events/workspace_usage already scopes every row to
-- auth.uid(), and there's no legitimate reason a caller would need anyone
-- else's usage, so these take no owner argument at all.
-- ---------------------------------------------------------------------------
create or replace function get_usage_distribution()
returns table(entry_type text, entries bigint)
language sql stable as $$
  select entry_type, count(*) from workspace_usage_events
  where owner_id = auth.uid()
  group by entry_type order by count(*) desc;
$$;

create or replace function get_workflow_distribution()
returns table(workflow text, entries bigint)
language sql stable as $$
  select workflow, count(*) from workspace_usage_events
  where owner_id = auth.uid()
  group by workflow order by count(*) desc;
$$;

create or replace function get_usage_timeseries(p_since timestamptz, p_until timestamptz)
returns table(day date, entries bigint)
language sql stable as $$
  select date_trunc('day', created_at)::date as day, count(*) from workspace_usage_events
  where owner_id = auth.uid() and created_at >= p_since and created_at <= p_until
  group by 1 order by 1;
$$;

create or replace function get_usage_history(p_periods integer default 6)
returns table(usage_period_start timestamptz, usage_period_end timestamptz, entries_used integer, entry_limit integer)
language sql stable as $$
  select usage_period_start, usage_period_end, entries_used, entry_limit from workspace_usage
  where owner_id = auth.uid()
  order by usage_period_start desc limit p_periods;
$$;

grant execute on function get_usage_distribution() to authenticated;
grant execute on function get_workflow_distribution() to authenticated;
grant execute on function get_usage_timeseries(timestamptz, timestamptz) to authenticated;
grant execute on function get_usage_history(integer) to authenticated;
