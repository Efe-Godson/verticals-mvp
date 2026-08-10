-- Seeds the shared "Restaurant" template: a single form with a
-- Product Cart field (menu items + prices) plus the usual dine-in details.
-- Templates are data (see 20260726024341_templates_table.sql), so this is
-- a plain insert rather than a code change; created_by is left null since
-- there's no fixed admin user to attribute it to at migration time.
insert into templates (slug, name, category, eyebrow, description, highlights, fields)
values (
  'restaurant-order-pay',
  'Restaurant',
  'Restaurant',
  'Front of house',
  'Take dine-in, takeout, or delivery orders from a menu and record how the guest paid.',
  array['Menu with prices', 'Dine-in / takeout / delivery', 'Payment method on every order'],
  $tmpl$[
    {
      "id": "menu",
      "type": "cart",
      "label": "Menu",
      "required": true,
      "products": [
        { "id": "p1", "name": "Grilled Chicken", "price": "12.99", "category": "Mains" },
        { "id": "p2", "name": "Beef Burger", "price": "10.99", "category": "Mains" },
        { "id": "p3", "name": "Veggie Pasta", "price": "9.99", "category": "Mains" },
        { "id": "p4", "name": "Caesar Salad", "price": "7.49", "category": "Starters" },
        { "id": "p5", "name": "Spring Rolls", "price": "5.99", "category": "Starters" },
        { "id": "p6", "name": "Soft Drink", "price": "2.50", "category": "Drinks" },
        { "id": "p7", "name": "Fresh Juice", "price": "3.50", "category": "Drinks" },
        { "id": "p8", "name": "Chocolate Cake", "price": "4.99", "category": "Desserts" },
        { "id": "p9", "name": "Ice Cream", "price": "3.99", "category": "Desserts" }
      ]
    },
    { "id": "order_type", "type": "dropdown", "label": "Order Type", "required": true, "options": ["Dine-in", "Takeout", "Delivery"] },
    { "id": "sales_person", "type": "text", "label": "Sales Person", "required": false, "collapsedInCheckout": true },
    { "id": "customer_name", "type": "text", "label": "Customer / Table Name", "required": false, "collapsedInCheckout": true },
    { "id": "table_number", "type": "text", "label": "Table Number", "required": false, "collapsedInCheckout": true },
    { "id": "phone", "type": "phone", "label": "Phone (for takeout/delivery)", "required": false, "collapsedInCheckout": true },
    { "id": "notes", "type": "longtext", "label": "Special Instructions", "required": false, "collapsedInCheckout": true }
  ]$tmpl$::jsonb
)
on conflict (slug) do nothing;
