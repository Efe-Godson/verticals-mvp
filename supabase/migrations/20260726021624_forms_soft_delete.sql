-- Forms now soft-delete into a Recycle Bin (matching the existing
-- submissions pattern) instead of deleting immediately, so Home.jsx needs a
-- deleted_at column to filter live forms and list trashed ones.
alter table forms
  add column if not exists deleted_at timestamptz;
