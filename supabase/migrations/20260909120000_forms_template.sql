-- Seeds the "Forms" template: a blank canvas (no preset fields, no cart),
-- for whoever wants to build a plain custom form from scratch rather than
-- starting from a business-specific template like Retail or Restaurant.
-- Starting it (Templates.jsx's startTemplate -> createLocationForm) drops
-- straight into the builder (see locations.js's locationDestination - no
-- cart field means it's never treated as a cart/POS template), same as any
-- other single-form template with no fields yet.
--
-- Its "locations" page is special-cased to FormsTemplateHome.jsx instead of
-- the generic TemplateLocations.jsx tile grid (see the literal
-- /templates/forms/locations route in App.jsx, ranked above the dynamic
-- /templates/:slug/locations one) - a rich list (search, Draft/Live/Paused/
-- Archived states, per-status actions, pinning) fits "however many custom
-- forms you build" far better than a bare grid of location tiles.
insert into templates (slug, name, category, eyebrow, description, highlights, fields)
values (
  'forms',
  'Forms',
  'Other',
  'Build Your Own',
  'Start from a blank form and add exactly the fields you need - no preset catalogue or workflow.',
  array['Blank canvas, add any fields', 'Share a link and collect responses', 'Records and reports included'],
  '[]'::jsonb
)
on conflict (slug) do nothing;
