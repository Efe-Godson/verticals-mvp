-- Per-record reconciliation ("ticked this sale off against another source" -
-- a bank statement, till roll, ...), independent of the day-level mark
-- already in form.settings.reconciledDates (see Records.jsx's Daily Tally).
-- Plain columns, same as submissions' existing deleted_at/updated_at, rather
-- than a JSONB bag - every UPDATE policy on submissions is row-level (the
-- owner, or an admin collaborator via get_share_role), so no new RLS is
-- needed to let either of them set these.
alter table public.submissions
  add column reconciled_at timestamptz,
  add column reconciled_by text;
