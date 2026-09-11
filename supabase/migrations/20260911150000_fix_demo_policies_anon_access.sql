-- Fixes a pre-existing bug found while testing src/PublicDemoExperience.jsx
-- (and, in hindsight, affecting the Sales/Reporting onboarding demo from
-- Phase 1 too - IntentDestination.jsx's Report view): "Anyone can view demo
-- form submissions" and "Anyone can view demo forms" are both scoped
-- `to authenticated` only, despite their names - never actually reachable
-- by a genuinely logged-out `anon` visitor. This never showed up before
-- because the only thing that ever exercised them was the old /lab/demo
-- page, which was admin-only (always a logged-in `authenticated` session)
-- and never actually tested as anonymous.
--
-- `forms` read still "worked" by coincidence - a completely different
-- policy, "Public can view published forms" (`status = 'published'`),
-- already covers a demo form since Demo Data Manager always publishes one
-- on creation. `submissions` has no equivalent public-by-default policy, so
-- there was nothing masking this one - real anonymous visitors got zero
-- rows back, silently (no error, just an empty result), for every demo.
drop policy "Anyone can view demo form submissions" on submissions;
create policy "Anyone can view demo form submissions"
on submissions for select
to public
using (exists (select 1 from forms where forms.id = submissions.form_id and forms.is_demo = true));

drop policy "Anyone can view demo forms" on forms;
create policy "Anyone can view demo forms"
on forms for select
to public
using (is_demo = true);
