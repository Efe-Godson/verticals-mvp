-- A "start from scratch" template: empty fields array, no cart field, so
-- EditForm.jsx automatically renders its full, unrestricted builder (every
-- field type, Add Field/Add Section, Preview) instead of the locked-down
-- "Add Product" view it shows for cart-based templates like Restaurant
-- Order & Pay. This is what used to live behind /create, now reachable
-- through the same Templates -> Locations flow as everything else, so a
-- non-admin account isn't limited to only curated templates.
insert into templates (slug, name, category, eyebrow, description, highlights, fields)
values (
  'custom-form',
  'Custom Form',
  'Other',
  'Build from scratch',
  'Start with a blank form and add exactly the fields you need.',
  array['Every field type', 'Fully customizable', 'Add as many as you like'],
  '[]'::jsonb
)
on conflict (slug) do nothing;
