-- Atomically decrements stock for any cart product with trackInventory
-- enabled, called by submit-form right after a submission is recorded. A
-- plain read-modify-write from the client (like every other forms.fields
-- edit in this app, e.g. Records.jsx's updateFormSettings) would lose
-- updates under concurrent sales - two customers checking out at the same
-- moment could both read the same stock count and step on each other's
-- decrement. `for update` row-locks the form for the duration of this
-- transaction so concurrent calls serialize instead of racing.
--
-- p_items is a jsonb array of {"id": "<product id>", "quantity": <number>}.
-- Products without trackInventory are left untouched. Stock floors at 0
-- rather than going negative.
--
-- Only ever meant to be called from submit-form using the service-role
-- client - the revoke/grant below keeps it unreachable from the browser,
-- same "writes mediated by an edge function" boundary submissions
-- themselves already use.
create or replace function apply_cart_stock_changes(p_form_id uuid, p_items jsonb)
returns void
language plpgsql
as $$
declare
  v_fields jsonb;
  v_new_fields jsonb;
  v_field jsonb;
  v_product jsonb;
  v_new_products jsonb;
  v_sold jsonb;
  v_qty numeric;
  v_stock numeric;
  i int;
  j int;
begin
  select fields into v_fields from forms where id = p_form_id for update;
  if v_fields is null then
    return;
  end if;

  v_new_fields := '[]'::jsonb;
  for i in 0 .. jsonb_array_length(v_fields) - 1 loop
    v_field := v_fields -> i;

    if v_field->>'type' = 'cart' and jsonb_typeof(v_field->'products') = 'array' then
      v_new_products := '[]'::jsonb;
      for j in 0 .. jsonb_array_length(v_field->'products') - 1 loop
        v_product := v_field->'products' -> j;

        select item into v_sold
        from jsonb_array_elements(p_items) item
        where item->>'id' = v_product->>'id'
        limit 1;

        if v_sold is not null and (v_product->>'trackInventory')::boolean is true then
          v_qty := coalesce((v_sold->>'quantity')::numeric, 0);
          v_stock := greatest(0, coalesce((v_product->>'stockQuantity')::numeric, 0) - v_qty);
          v_product := jsonb_set(v_product, '{stockQuantity}', to_jsonb(v_stock));
        end if;

        v_new_products := v_new_products || jsonb_build_array(v_product);
      end loop;
      v_field := jsonb_set(v_field, '{products}', v_new_products);
    end if;

    v_new_fields := v_new_fields || jsonb_build_array(v_field);
  end loop;

  update forms set fields = v_new_fields where id = p_form_id;
end;
$$;

revoke all on function apply_cart_stock_changes(uuid, jsonb) from public;
grant execute on function apply_cart_stock_changes(uuid, jsonb) to service_role;
