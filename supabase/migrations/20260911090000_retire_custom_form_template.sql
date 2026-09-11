-- Retire the "Custom Form" template (slug: custom-form) now that "Forms"
-- (slug: forms, see 20260909120000_forms_template.sql) covers the same
-- "start from scratch, no preset fields" case with its own richer home
-- page (search, Draft/Live/Paused/Archived, pinning).
--
-- Any existing form still tagged custom-form is reassigned to forms first,
-- so that workflow keeps showing on Home (BusinessesHome.jsx looks up
-- templates by the slugs its own forms reference) instead of silently
-- disappearing once the old template row is gone below.
update forms
set settings = jsonb_set(coalesce(settings, '{}'::jsonb), '{templateSlug}', '"forms"')
where settings->>'templateSlug' = 'custom-form';

delete from templates where slug = 'custom-form';
