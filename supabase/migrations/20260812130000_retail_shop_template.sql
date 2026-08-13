-- Seeds the shared "Retail" template: same closed-environment shape as
-- Restaurant (a Product Cart field plus customer details), but with
-- deferCheckout on the cart instead of an embedded checkout modal - a shop
-- owner adds items, fills in whatever customer details they want, and hits
-- one Submit button at the end (see PublicForm.jsx's cartDefersCheckout).
-- Customer fields carry collapsedInCheckout the same way Restaurant's
-- Sales Person/Customer Name/Phone/Notes do (20260811100000_sales_person_
-- optional.sql), so they start tucked into "More details" but a shop owner
-- can promote any of them to the main field list via the new "Tuck into
-- 'More details'" toggle in FieldValidationControls.jsx.
insert into templates (slug, name, category, eyebrow, description, highlights, fields)
values (
  'retail-shop',
  'Retail',
  'Retail',
  'Set Up Shop',
  'Sell from a product catalogue and record who bought what - fill in the order, hit submit, no separate checkout step.',
  array['Product catalogue', 'One submit button, no embedded checkout', 'Customer details tucked into "More details"'],
  $tmpl$[
    {
      "id": "catalogue",
      "type": "cart",
      "label": "Product Catalogue",
      "required": true,
      "deferCheckout": true,
      "products": [
        { "id": "p1", "name": "T-Shirt", "price": "15.99", "category": "Apparel" },
        { "id": "p2", "name": "Jeans", "price": "34.99", "category": "Apparel" },
        { "id": "p3", "name": "Sneakers", "price": "49.99", "category": "Footwear" },
        { "id": "p4", "name": "Baseball Cap", "price": "12.99", "category": "Accessories" },
        { "id": "p5", "name": "Backpack", "price": "29.99", "category": "Accessories" },
        { "id": "p6", "name": "Wireless Earbuds", "price": "39.99", "category": "Electronics" },
        { "id": "p7", "name": "Phone Case", "price": "9.99", "category": "Electronics" },
        { "id": "p8", "name": "Water Bottle", "price": "8.99", "category": "Home" }
      ]
    },
    { "id": "sales_person", "type": "text", "label": "Sales Person", "required": false, "collapsedInCheckout": true },
    { "id": "customer_name", "type": "text", "label": "Customer Name", "required": false, "collapsedInCheckout": true },
    { "id": "phone", "type": "phone", "label": "Phone", "required": false, "collapsedInCheckout": true },
    { "id": "notes", "type": "longtext", "label": "Notes", "required": false, "collapsedInCheckout": true }
  ]$tmpl$::jsonb
)
on conflict (slug) do nothing;
