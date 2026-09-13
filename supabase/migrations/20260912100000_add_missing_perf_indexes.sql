-- Perf: add indexes for FK/filter columns that get hit on every read of
-- their table but have never had a matching index. `if not exists` on every
-- statement so this is safe to run against a database that already has some
-- of these (e.g. picked up by a previous manual fix).
--
-- A few FK columns that might look "missing" at a glance are deliberately
-- left out below because they're already the leading column of an existing
-- composite unique index, and Postgres can use a multicolumn btree index for
-- an equality lookup on just its leading column(s) - a second single-column
-- index on the same leading column would be pure duplication (extra storage,
-- extra write overhead) with no read benefit:
--   - quiz_questions.room_id  -> covered by `unique (room_id, idx)`
--   - quiz_players.room_id    -> covered by `unique (room_id, identity_id)`
--   - quiz_answers.question_id -> covered by `unique (question_id, player_id)`
--   - payroll_periods.payroll_form_id -> covered by `unique (payroll_form_id, year, month)`
-- (see supabase/migrations/20260812100000_quiz_tables.sql and
-- 20260826140000_payroll_module.sql).

-- submissions.form_id - Records.jsx and every submissions list/report query
-- filter by this; there has never been an index on it (the table predates
-- the migration history and no later migration added one).
create index if not exists submissions_form_id_idx on submissions (form_id);

-- quiz_answers - room_id and player_id are each only ever a trailing column
-- of the table's `unique (question_id, player_id)` constraint, so neither is
-- covered by an existing index.
create index if not exists quiz_answers_room_id_idx on quiz_answers (room_id);
create index if not exists quiz_answers_player_id_idx on quiz_answers (player_id);

-- payroll_payment_batches.payroll_form_id - unlike payroll_periods, this
-- table has no unique/composite index that happens to lead with
-- payroll_form_id, so it genuinely has no coverage yet. Follows the same
-- `idx_payroll_<table>_form` naming used by the sibling tables in
-- 20260826140000_payroll_module.sql / 20260827100000_payroll_locations.sql.
create index if not exists idx_payroll_payment_batches_form on payroll_payment_batches (payroll_form_id);
