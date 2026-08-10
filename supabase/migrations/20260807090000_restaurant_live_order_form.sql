-- A live, published form for the restaurant: just the menu (Product Cart)
-- and Dine-in/Takeout, trimmed down from the fuller "Restaurant Order &
-- Pay" template (20260806120000) which also asks for name/phone/payment
-- method. Owned by the account that hosts the team's real forms/data.
insert into forms (name, description, fields, status, user_id, settings)
select
  'Restaurant Order',
  'Quick order form: pick items from the menu and say dine-in or takeout.',
  $form$[
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
    { "id": "order_type", "type": "dropdown", "label": "Dine-in or Takeout?", "required": true, "options": ["Dine-in", "Takeout"] }
  ]$form$::jsonb,
  'published',
  u.id,
  '{"templateSlug": "restaurant-order-pay"}'::jsonb
from auth.users u
where u.email = 'akpobasaefegodson@gmail.com'
on conflict do nothing;
