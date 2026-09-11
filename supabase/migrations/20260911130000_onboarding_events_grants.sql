-- Follow-up to 20260911120000_onboarding_events_and_demo_seed.sql, found by
-- testing that migration directly against the live project rather than
-- assuming it would just work: unlike `forms`/`submissions` (old enough to
-- predate this migrations folder, and already granted broad table
-- privileges by whatever set up this project originally), a brand-new
-- table gets *no* default anon/authenticated grants at all here - an RLS
-- policy alone doesn't matter until the base table privilege exists too.
-- Without this, anon's insert failed with a "row-level security policy"
-- error despite a correct, matching `to public with check (true)` policy -
-- worth remembering next time a new anon-writable table is added, since
-- Supabase's own dashboard-created tables normally get this for free and
-- it's easy to assume every table does.
grant insert on onboarding_events to anon, authenticated;
grant select on onboarding_events to authenticated;

-- Separately (found while testing the fix above, not a second bug): never
-- chain .select() or send `Prefer: return=representation` on this insert.
-- Postgres also enforces the table's SELECT/USING policies against a
-- RETURNING clause, and anon has no SELECT policy here (on purpose - see
-- the previous migration) - asking for the inserted row back fails with
-- the exact same "violates row-level security policy" error as if the
-- insert itself were blocked, even though a plain insert with no return
-- value works fine. src/lib/onboardingEvents.js's track() deliberately
-- never chains .select() for this reason.
