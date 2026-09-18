-- Subscription lifecycle (Phase 3 of the Pricing & Usage plan): the grace-
-- period/reminder state machine. Subscription restriction and entry-limit
-- restriction are separate checks (a subscription can be restricted with
-- entries still available, or vice versa) - both are folded into the same
-- assert_can_create_entry() below, the sole gate, so nothing drifts out of
-- sync between two enforcement paths.
--
-- Schedule (see plan): day -7 (warn) -> day 0 (expiry, grace begins) ->
-- day +4 (8 days left) -> day +8 (4 days left) -> day +12 (grace ends,
-- restricted). A voluntary downgrade/cancel (pending_plan) applying at
-- period end is a SEPARATE thing from this - it's a requested change, not a
-- failure to renew, so it's handled first and skips the grace path entirely.

-- ---------------------------------------------------------------------------
-- 1. subscriptions gets three more columns for the state machine.
-- ---------------------------------------------------------------------------
alter table subscriptions add column grace_period_started_at timestamptz;
alter table subscriptions add column grace_period_ends_at timestamptz;
alter table subscriptions add column last_reminder_stage text
  check (last_reminder_stage in ('day_-7','day_0','day_+4','day_+8','day_+12'));

-- ---------------------------------------------------------------------------
-- 2. renewal_reminders - one row per (owner, cycle, milestone), so a
-- milestone can recur on the NEXT billing cycle without colliding with this
-- one. subscription_cycle_id is the current_period_end value the milestone
-- belongs to - it stays fixed across expiring_soon -> grace_period ->
-- restricted (only activate_plan(), on an actual renewal, moves
-- current_period_end forward and starts a fresh cycle).
-- ---------------------------------------------------------------------------
create table renewal_reminders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  subscription_cycle_id timestamptz not null,
  milestone text not null check (milestone in ('day_-7','day_0','day_+4','day_+8','day_+12')),
  shown_as_modal_at timestamptz,
  banner_dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (owner_id, subscription_cycle_id, milestone)
);

alter table renewal_reminders enable row level security;
create policy "Owners can read their own reminders"
on renewal_reminders for select
to authenticated
using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. assert_can_create_entry() replaces the ad-hoc "if not can_create_entry
-- then raise" duplicated in both gate triggers - one place decides both
-- whether a subscription's status blocks creation AND whether the entry
-- count does, with a distinct message prefix for each so the frontend can
-- tell them apart (existing ENTRY_LIMIT_REACHED: handling in submit-form/
-- Records.jsx/QuickAddExpense.jsx gets a SUBSCRIPTION_RESTRICTED: sibling).
-- can_create_entry() itself is left as-is (still used nowhere else, but
-- changing its return type would need a drop, not just a replace).
-- ---------------------------------------------------------------------------
create or replace function assert_can_create_entry(p_owner_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_sub subscriptions%rowtype;
  v_used integer;
begin
  insert into subscriptions (owner_id) values (p_owner_id) on conflict (owner_id) do nothing;
  select * into v_sub from subscriptions where owner_id = p_owner_id;

  if v_sub.status = 'restricted' then
    raise exception 'SUBSCRIPTION_RESTRICTED: Your subscription needs to be renewed before you can add new entries.';
  end if;

  select entries_used into v_used from workspace_usage
    where owner_id = p_owner_id and usage_period_start = v_sub.usage_period_start;
  if coalesce(v_used, 0) >= v_sub.entry_limit then
    raise exception 'ENTRY_LIMIT_REACHED: You have reached your monthly entry limit. Upgrade your plan to keep adding records.';
  end if;
end;
$$;
revoke all on function assert_can_create_entry(uuid) from public, anon, authenticated;
grant execute on function assert_can_create_entry(uuid) to service_role;

create or replace function trg_gate_submissions() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
begin
  select user_id into v_owner from forms where id = new.form_id;
  if v_owner is not null then perform assert_can_create_entry(v_owner); end if;
  return new;
end;
$$;

create or replace function trg_gate_payroll_records() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
begin
  select user_id into v_owner from forms where id = new.payroll_form_id;
  if v_owner is not null then perform assert_can_create_entry(v_owner); end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. The daily lifecycle job. Each step's UPDATE only matches rows sitting
-- at the exact preceding stage, so every transition fires exactly once per
-- cycle regardless of how many times (or how late) this runs - a multi-day
-- gap in cron execution just walks a row through several transitions in one
-- pass instead of getting stuck, each still logged to renewal_reminders.
-- ---------------------------------------------------------------------------
create or replace function process_subscription_lifecycle() returns void
language plpgsql security definer set search_path = public as $$
begin
  -- 0. Apply a due VOLUNTARY plan change (downgrade/cancel reaching the end
  -- of its already-paid period) - independent of the grace-period path
  -- below, since this is a requested change, not a failed renewal.
  update subscriptions s set
    plan = s.pending_plan,
    billing_interval = coalesce(s.pending_billing_interval, s.billing_interval),
    entry_limit = coalesce(s.pending_entry_limit, s.entry_limit),
    price_ngn = coalesce(s.pending_price_ngn, 0),
    status = 'active',
    current_period_start = now(),
    current_period_end = case when s.pending_plan = 'free' then null else now() + (case coalesce(s.pending_billing_interval, s.billing_interval)
      when 'monthly' then interval '1 month' when 'quarterly' then interval '3 months'
      when 'half_year' then interval '6 months' when 'yearly' then interval '1 year' end) end,
    pending_plan = null, pending_billing_interval = null, pending_entry_limit = null, pending_price_ngn = null,
    cancel_at_period_end = false, grace_period_started_at = null, grace_period_ends_at = null,
    last_reminder_stage = null, updated_at = now()
  where s.pending_plan is not null and s.current_period_end is not null and s.current_period_end <= now();

  -- 1. Seven days before expiry.
  with t as (
    update subscriptions set status = 'expiring_soon', last_reminder_stage = 'day_-7', updated_at = now()
    where status = 'active' and pending_plan is null and current_period_end is not null
      and current_period_end <= now() + interval '7 days' and current_period_end > now()
    returning owner_id, current_period_end as cycle_id
  )
  insert into renewal_reminders (owner_id, subscription_cycle_id, milestone)
  select owner_id, cycle_id, 'day_-7' from t
  on conflict (owner_id, subscription_cycle_id, milestone) do nothing;

  -- 2. Expiry day - grace period begins.
  with t as (
    update subscriptions set
      status = 'grace_period', grace_period_started_at = current_period_end,
      grace_period_ends_at = current_period_end + interval '12 days',
      last_reminder_stage = 'day_0', updated_at = now()
    where status in ('active','expiring_soon') and pending_plan is null
      and current_period_end is not null and current_period_end <= now()
    returning owner_id, current_period_end as cycle_id
  )
  insert into renewal_reminders (owner_id, subscription_cycle_id, milestone)
  select owner_id, cycle_id, 'day_0' from t
  on conflict (owner_id, subscription_cycle_id, milestone) do nothing;

  -- 3. Grace day 4 (8 days remaining).
  with t as (
    update subscriptions set last_reminder_stage = 'day_+4', updated_at = now()
    where status = 'grace_period' and last_reminder_stage = 'day_0'
      and grace_period_started_at is not null and now() >= grace_period_started_at + interval '4 days'
    returning owner_id, current_period_end as cycle_id
  )
  insert into renewal_reminders (owner_id, subscription_cycle_id, milestone)
  select owner_id, cycle_id, 'day_+4' from t
  on conflict (owner_id, subscription_cycle_id, milestone) do nothing;

  -- 4. Grace day 8 (4 days remaining).
  with t as (
    update subscriptions set last_reminder_stage = 'day_+8', updated_at = now()
    where status = 'grace_period' and last_reminder_stage = 'day_+4'
      and grace_period_started_at is not null and now() >= grace_period_started_at + interval '8 days'
    returning owner_id, current_period_end as cycle_id
  )
  insert into renewal_reminders (owner_id, subscription_cycle_id, milestone)
  select owner_id, cycle_id, 'day_+8' from t
  on conflict (owner_id, subscription_cycle_id, milestone) do nothing;

  -- 5. Grace ends - restricted.
  with t as (
    update subscriptions set status = 'restricted', last_reminder_stage = 'day_+12', updated_at = now()
    where status = 'grace_period' and grace_period_ends_at is not null and now() >= grace_period_ends_at
    returning owner_id, current_period_end as cycle_id
  )
  insert into renewal_reminders (owner_id, subscription_cycle_id, milestone)
  select owner_id, cycle_id, 'day_+12' from t
  on conflict (owner_id, subscription_cycle_id, milestone) do nothing;
end;
$$;
revoke all on function process_subscription_lifecycle() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'subscription_lifecycle_daily',
      '15 0 * * *',
      $cron$select process_subscription_lifecycle()$cron$
    );
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Frontend-facing helpers.
-- ---------------------------------------------------------------------------

-- One round trip for the lifecycle gate component: current subscription +
-- whichever reminder (if any) hasn't been shown as a modal yet for the
-- current cycle.
create or replace function get_subscription_and_pending_reminder()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_sub subscriptions%rowtype;
  v_reminder renewal_reminders%rowtype;
begin
  insert into subscriptions (owner_id) values (auth.uid()) on conflict (owner_id) do nothing;
  select * into v_sub from subscriptions where owner_id = auth.uid();
  select * into v_reminder from renewal_reminders
    where owner_id = auth.uid() and subscription_cycle_id = v_sub.current_period_end
    order by created_at desc limit 1;
  return jsonb_build_object(
    'subscription', to_jsonb(v_sub),
    'reminder', case when v_reminder.id is null then null else to_jsonb(v_reminder) end
  );
end;
$$;
grant execute on function get_subscription_and_pending_reminder() to authenticated;

-- Marks a reminder as shown (modal, once) or its banner dismissed - scoped
-- to the caller's own row, never accepts anything else about the reminder.
create or replace function mark_reminder_seen(p_reminder_id uuid, p_kind text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_kind = 'modal' then
    update renewal_reminders set shown_as_modal_at = now() where id = p_reminder_id and owner_id = auth.uid() and shown_as_modal_at is null;
  elsif p_kind = 'banner' then
    update renewal_reminders set banner_dismissed_at = now() where id = p_reminder_id and owner_id = auth.uid();
  end if;
end;
$$;
grant execute on function mark_reminder_seen(uuid, text) to authenticated;

-- Anonymous-safe: a public form's own visitors need to know if it's
-- unavailable, but never why (spec: "do not expose billing information
-- publicly") - just a boolean.
create or replace function is_form_restricted(p_form_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select s.status = 'restricted' from forms f join subscriptions s on s.owner_id = f.user_id where f.id = p_form_id),
    false
  );
$$;
grant execute on function is_form_restricted(uuid) to anon, authenticated;
