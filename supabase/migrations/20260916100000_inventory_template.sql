-- Seeds the standalone Inventory template. It uses the existing cart product
-- catalogue as its storage model, but opens directly on stock management rather
-- than an order screen.
insert into templates (slug, name, category, eyebrow, description, highlights, fields)
values (
  'inventory',
  'Inventory',
  'Inventory',
  'Track stock simply',
  'Keep a live catalogue of products, quantities and low-stock levels without setting up a sales workflow.',
  array['Product catalogue', 'Stock counts and restocking', 'Low-stock warnings'],
  $tmpl$[
    {
      "id": "products",
      "type": "cart",
      "label": "Products",
      "required": true,
      "deferCheckout": true,
      "products": [
        { "id": "p1", "name": "Product 1", "price": "0", "category": "General", "trackInventory": true, "stockQuantity": 0 },
        { "id": "p2", "name": "Product 2", "price": "0", "category": "General", "trackInventory": true, "stockQuantity": 0 }
      ]
    }
  ]$tmpl$::jsonb
)
on conflict (slug) do nothing;
