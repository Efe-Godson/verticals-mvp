-- The "Restaurant Order & Pay" template (20260806120000) already seeded
-- with that name on databases where that migration ran before this one
-- existed; renaming the insert alone wouldn't reach those rows.
update templates set name = 'Restaurant' where slug = 'restaurant-order-pay' and name = 'Restaurant Order & Pay';
