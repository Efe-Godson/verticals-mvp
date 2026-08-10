-- Sales Person was required and shown up front alongside Order Type -
-- too much friction for something that isn't always known/needed at the
-- moment of checkout. Now optional and tucked into the same collapsed
-- "Additional Information" group as Customer/Table Name, Table Number,
-- Phone, and Special Instructions.
update templates
set fields = (
  select jsonb_agg(
    case
      when field->>'id' = 'sales_person'
        then field || '{"required": false, "collapsedInCheckout": true}'::jsonb
      else field
    end
  )
  from jsonb_array_elements(fields) as field
)
where slug = 'restaurant-order-pay';
