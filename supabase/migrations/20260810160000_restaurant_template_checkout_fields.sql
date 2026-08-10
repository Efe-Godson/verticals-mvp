-- Reworks the Restaurant template's checkout questions: Order Type and the
-- new Sales Person field stay front-and-center, everything else
-- (Customer/Table Name, Table Number, Phone, Special Instructions) is
-- flagged collapsedInCheckout so PublicForm.jsx tucks it behind a "+ More
-- details" toggle instead of listing every question up front. Payment
-- Method is dropped entirely - the cart's own checkout flow already
-- captures how the order was paid, so the separate form field was
-- redundant. Existing per-location forms already created from this
-- template keep their own fields (and customized menu) untouched; this
-- only affects the template new locations get created from.
update templates
set fields = $tmpl$[
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
where slug = 'restaurant-order-pay';
