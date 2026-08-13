-- Pins Customer Name and Phone (already on the Retail template) and adds a
-- new Location field, also pinned - all three now show right after the
-- catalogue instead of behind "+ More details" (see MoreDetailsManager.jsx
-- for the equivalent self-service pin/unpin tool a shop owner has on their
-- own already-created form). Sales Person and Notes stay tucked away,
-- matching Restaurant's existing collapsedInCheckout defaults.
update templates
set fields = (
  select jsonb_agg(
    case
      when field->>'id' in ('customer_name', 'phone') then field - 'collapsedInCheckout'
      else field
    end
    order by ord
  )
  from jsonb_array_elements(fields) with ordinality as t(field, ord)
) || jsonb_build_array(jsonb_build_object(
  'id', 'location', 'type', 'location', 'label', 'Location', 'required', false
))
where slug = 'retail-shop';
