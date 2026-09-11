-- Part 1: onboarding_events - feeds the new pre-signup entry flow's funnel
-- (Welcome -> Setup Selection -> Demo/Preview -> Signup). One generic table
-- per event, same "type + jsonb-ish detail" convention as alert_events
-- (20260905120100_alert_events.sql), except this one must be insertable by
-- an anonymous visitor - most of the funnel happens before an account
-- exists at all, so there's no auth.uid() to key off of yet. session_id is
-- a client-generated id (see src/lib/onboardingEvents.js) that ties the
-- pre-signup events to the same visitor; user_id is only ever set once
-- signup actually completes.
create table onboarding_events (
  id                 uuid primary key default gen_random_uuid(),
  session_id         text        not null,
  user_id            uuid,
  event_type         text        not null,
  entry_intent       text,
  custom_intent_text text,
  created_at         timestamptz not null default now()
);
create index onboarding_events_session_id_idx on onboarding_events (session_id);
create index onboarding_events_created_at_idx on onboarding_events (created_at desc);

alter table onboarding_events enable row level security;

-- Anyone (logged in or not) can log their own onboarding events - there's
-- nothing sensitive in an event row (an intent label and a session id), and
-- most of them fire before an account exists. No public select policy: the
-- client never reads this back, only the Lab's funnel view will (Phase 2).
create policy "Anyone can log onboarding events"
on onboarding_events for insert
to public
with check (true);

-- Same admin-only read convention as templates/list_concurrent_sessions -
-- added now even though nothing calls it until Phase 2's Lab funnel view,
-- so that view doesn't need a second migration just to become readable.
create policy "Only the main account can read onboarding events"
on onboarding_events for select
to authenticated
using (auth.uid() = '7d91d04c-d223-4ef1-a94d-382aa2d31bfe');

-- Part 1b: templates were only readable `to authenticated` (Templates.jsx,
-- the gallery, has only ever been reached by a logged-in user) - the new
-- onboarding flow's RealTemplatePreview.jsx needs to read a template's own
-- fields (to preview them) before an account exists at all. Additive: this
-- coexists with the existing authenticated-only policy rather than
-- replacing it (RLS OR's multiple permissive policies for the same
-- command together), and a template's fields/name/description were never
-- sensitive - they're what the gallery already shows off to any signed-in user.
create policy "Anyone can view templates"
on templates for select
to public
using (true);

-- Part 2: seed one real demo business - a small Nigerian restaurant menu
-- (matches the onboarding brief's own "Jollof Rice" example), is_demo =
-- true so the existing "Anyone can view demo forms/submissions" policies
-- already make it publicly, anonymously readable - no new RLS needed for
-- the new Sales/Reporting onboarding intents to show it. Nothing here is
-- referenced by slug/id from application code; the new onboarding flow
-- looks it up via `is_demo = true`, same as the existing (currently empty)
-- /lab/demo page already does.
insert into forms (id, name, description, status, is_demo, user_id, settings, fields)
values (
  '11111111-1111-4111-8111-111111111111',
  'Mama''s Kitchen',
  'A sample restaurant business, used to power the onboarding demo.',
  'published',
  true,
  '7d91d04c-d223-4ef1-a94d-382aa2d31bfe',
  '{}'::jsonb,
  $tmpl$[
    {
      "id": "order",
      "type": "cart",
      "label": "Order",
      "required": true,
      "products": [
        { "id": "p1", "name": "Jollof Rice", "price": "1500", "category": "Mains" },
        { "id": "p2", "name": "Chicken & Chips", "price": "2200", "category": "Mains" },
        { "id": "p3", "name": "Fried Rice", "price": "1500", "category": "Mains" },
        { "id": "p4", "name": "Suya", "price": "1000", "category": "Starters" },
        { "id": "p5", "name": "Moi Moi", "price": "800", "category": "Starters" },
        { "id": "p6", "name": "Chapman", "price": "700", "category": "Drinks" },
        { "id": "p7", "name": "Zobo", "price": "500", "category": "Drinks" },
        { "id": "p8", "name": "Puff Puff", "price": "300", "category": "Desserts" }
      ]
    },
    { "id": "order_type", "type": "dropdown", "label": "Order Type", "required": true, "options": ["Dine-in", "Takeout", "Delivery"] },
    { "id": "customer_name", "type": "text", "label": "Customer / Table Name", "required": false, "collapsedInCheckout": true },
    { "id": "phone", "type": "phone", "label": "Phone (for takeout/delivery)", "required": false, "collapsedInCheckout": true }
  ]$tmpl$::jsonb
)
on conflict (id) do nothing;

-- ~18 sample orders: a handful "today" (so the onboarding stats tile's
-- "Today" numbers aren't empty), the rest spread over the last week for a
-- Report view with actual trend/top-seller shape. Item totals are computed
-- by hand to match price*quantity - nothing recomputes them at insert time.
insert into submissions (form_id, data, created_at) values
  ('11111111-1111-4111-8111-111111111111',
   '{"order": {"items": [{"id":"p1","name":"Jollof Rice","price":1500,"category":"Mains","quantity":2},{"id":"p6","name":"Chapman","price":700,"category":"Drinks","quantity":2}], "total": 4400, "payment": {"method": "Cash"}, "deliveryFee": 0}, "order_type": "Dine-in", "customer_name": "Tunde", "phone": "08012345001"}'::jsonb,
   now() - interval '2 hours'),
  ('11111111-1111-4111-8111-111111111111',
   '{"order": {"items": [{"id":"p2","name":"Chicken & Chips","price":2200,"category":"Mains","quantity":1},{"id":"p7","name":"Zobo","price":500,"category":"Drinks","quantity":1}], "total": 2700, "payment": {"method": "Card"}, "deliveryFee": 0}, "order_type": "Takeout", "customer_name": "Ada", "phone": "08012345002"}'::jsonb,
   now() - interval '3 hours'),
  ('11111111-1111-4111-8111-111111111111',
   '{"order": {"items": [{"id":"p1","name":"Jollof Rice","price":1500,"category":"Mains","quantity":3},{"id":"p4","name":"Suya","price":1000,"category":"Starters","quantity":2},{"id":"p6","name":"Chapman","price":700,"category":"Drinks","quantity":3}], "total": 8600, "payment": {"method": "Cash"}, "deliveryFee": 500}, "order_type": "Delivery", "customer_name": "Chidi", "phone": "08012345003"}'::jsonb,
   now() - interval '5 hours'),
  ('11111111-1111-4111-8111-111111111111',
   '{"order": {"items": [{"id":"p3","name":"Fried Rice","price":1500,"category":"Mains","quantity":2},{"id":"p8","name":"Puff Puff","price":300,"category":"Desserts","quantity":4}], "total": 4200, "payment": {"method": "Cash"}, "deliveryFee": 0}, "order_type": "Dine-in", "customer_name": "Ngozi", "phone": "08012345004"}'::jsonb,
   now() - interval '6 hours'),
  ('11111111-1111-4111-8111-111111111111',
   '{"order": {"items": [{"id":"p2","name":"Chicken & Chips","price":2200,"category":"Mains","quantity":2},{"id":"p1","name":"Jollof Rice","price":1500,"category":"Mains","quantity":1},{"id":"p7","name":"Zobo","price":500,"category":"Drinks","quantity":3}], "total": 7400, "payment": {"method": "Card"}, "deliveryFee": 0}, "order_type": "Dine-in", "customer_name": "Emeka", "phone": "08012345005"}'::jsonb,
   now() - interval '9 hours'),
  ('11111111-1111-4111-8111-111111111111',
   '{"order": {"items": [{"id":"p1","name":"Jollof Rice","price":1500,"category":"Mains","quantity":4},{"id":"p6","name":"Chapman","price":700,"category":"Drinks","quantity":4}], "total": 8800, "payment": {"method": "Cash"}, "deliveryFee": 500}, "order_type": "Delivery", "customer_name": "Bisi", "phone": "08012345006"}'::jsonb,
   now() - interval '1 days' - interval '2 hours'),
  ('11111111-1111-4111-8111-111111111111',
   '{"order": {"items": [{"id":"p3","name":"Fried Rice","price":1500,"category":"Mains","quantity":1},{"id":"p5","name":"Moi Moi","price":800,"category":"Starters","quantity":1}], "total": 2300, "payment": {"method": "Cash"}, "deliveryFee": 0}, "order_type": "Takeout", "customer_name": "Kunle", "phone": "08012345007"}'::jsonb,
   now() - interval '1 days' - interval '4 hours'),
  ('11111111-1111-4111-8111-111111111111',
   '{"order": {"items": [{"id":"p2","name":"Chicken & Chips","price":2200,"category":"Mains","quantity":3},{"id":"p8","name":"Puff Puff","price":300,"category":"Desserts","quantity":3}], "total": 7500, "payment": {"method": "Card"}, "deliveryFee": 0}, "order_type": "Dine-in", "customer_name": "Funmi", "phone": "08012345008"}'::jsonb,
   now() - interval '1 days' - interval '8 hours'),
  ('11111111-1111-4111-8111-111111111111',
   '{"order": {"items": [{"id":"p1","name":"Jollof Rice","price":1500,"category":"Mains","quantity":2},{"id":"p2","name":"Chicken & Chips","price":2200,"category":"Mains","quantity":1},{"id":"p6","name":"Chapman","price":700,"category":"Drinks","quantity":2}], "total": 6600, "payment": {"method": "Cash"}, "deliveryFee": 0}, "order_type": "Dine-in", "customer_name": "Ijeoma", "phone": "08012345009"}'::jsonb,
   now() - interval '2 days' - interval '1 hours'),
  ('11111111-1111-4111-8111-111111111111',
   '{"order": {"items": [{"id":"p1","name":"Jollof Rice","price":1500,"category":"Mains","quantity":5},{"id":"p7","name":"Zobo","price":500,"category":"Drinks","quantity":5}], "total": 10000, "payment": {"method": "Card"}, "deliveryFee": 500}, "order_type": "Delivery", "customer_name": "Segun", "phone": "08012345010"}'::jsonb,
   now() - interval '2 days' - interval '6 hours'),
  ('11111111-1111-4111-8111-111111111111',
   '{"order": {"items": [{"id":"p4","name":"Suya","price":1000,"category":"Starters","quantity":2},{"id":"p6","name":"Chapman","price":700,"category":"Drinks","quantity":2}], "total": 3400, "payment": {"method": "Cash"}, "deliveryFee": 0}, "order_type": "Takeout", "customer_name": "Amara", "phone": "08012345011"}'::jsonb,
   now() - interval '3 days' - interval '3 hours'),
  ('11111111-1111-4111-8111-111111111111',
   '{"order": {"items": [{"id":"p2","name":"Chicken & Chips","price":2200,"category":"Mains","quantity":2},{"id":"p1","name":"Jollof Rice","price":1500,"category":"Mains","quantity":2}], "total": 7400, "payment": {"method": "Cash"}, "deliveryFee": 0}, "order_type": "Dine-in", "customer_name": "Yemi", "phone": "08012345012"}'::jsonb,
   now() - interval '3 days' - interval '7 hours'),
  ('11111111-1111-4111-8111-111111111111',
   '{"order": {"items": [{"id":"p3","name":"Fried Rice","price":1500,"category":"Mains","quantity":3},{"id":"p8","name":"Puff Puff","price":300,"category":"Desserts","quantity":2}], "total": 5100, "payment": {"method": "Card"}, "deliveryFee": 0}, "order_type": "Dine-in", "customer_name": "Chinwe", "phone": "08012345013"}'::jsonb,
   now() - interval '4 days' - interval '2 hours'),
  ('11111111-1111-4111-8111-111111111111',
   '{"order": {"items": [{"id":"p1","name":"Jollof Rice","price":1500,"category":"Mains","quantity":3},{"id":"p6","name":"Chapman","price":700,"category":"Drinks","quantity":3}], "total": 6600, "payment": {"method": "Cash"}, "deliveryFee": 500}, "order_type": "Delivery", "customer_name": "Tobi", "phone": "08012345014"}'::jsonb,
   now() - interval '4 days' - interval '9 hours'),
  ('11111111-1111-4111-8111-111111111111',
   '{"order": {"items": [{"id":"p2","name":"Chicken & Chips","price":2200,"category":"Mains","quantity":1},{"id":"p5","name":"Moi Moi","price":800,"category":"Starters","quantity":1},{"id":"p7","name":"Zobo","price":500,"category":"Drinks","quantity":1}], "total": 3500, "payment": {"method": "Cash"}, "deliveryFee": 0}, "order_type": "Takeout", "customer_name": "Uche", "phone": "08012345015"}'::jsonb,
   now() - interval '5 days' - interval '4 hours'),
  ('11111111-1111-4111-8111-111111111111',
   '{"order": {"items": [{"id":"p1","name":"Jollof Rice","price":1500,"category":"Mains","quantity":4},{"id":"p2","name":"Chicken & Chips","price":2200,"category":"Mains","quantity":2},{"id":"p6","name":"Chapman","price":700,"category":"Drinks","quantity":4}], "total": 13200, "payment": {"method": "Card"}, "deliveryFee": 0}, "order_type": "Dine-in", "customer_name": "Halima", "phone": "08012345016"}'::jsonb,
   now() - interval '5 days' - interval '10 hours'),
  ('11111111-1111-4111-8111-111111111111',
   '{"order": {"items": [{"id":"p3","name":"Fried Rice","price":1500,"category":"Mains","quantity":2},{"id":"p4","name":"Suya","price":1000,"category":"Starters","quantity":1}], "total": 4000, "payment": {"method": "Cash"}, "deliveryFee": 0}, "order_type": "Dine-in", "customer_name": "Musa", "phone": "08012345017"}'::jsonb,
   now() - interval '6 days' - interval '3 hours'),
  ('11111111-1111-4111-8111-111111111111',
   '{"order": {"items": [{"id":"p1","name":"Jollof Rice","price":1500,"category":"Mains","quantity":2},{"id":"p8","name":"Puff Puff","price":300,"category":"Desserts","quantity":2}], "total": 3600, "payment": {"method": "Cash"}, "deliveryFee": 0}, "order_type": "Takeout", "customer_name": "Grace", "phone": "08012345018"}'::jsonb,
   now() - interval '6 days' - interval '8 hours')
on conflict do nothing;
