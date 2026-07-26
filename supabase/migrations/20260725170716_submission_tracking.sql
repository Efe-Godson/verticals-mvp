-- Adds submission-tracking columns needed by the Records table: a
-- human-readable sequential order number, last-update timestamp (kept in
-- sync by trigger so it's correct regardless of which code path updates a
-- row), the submitter's IP as seen by the edge function that accepts public
-- submissions, and an unguessable edit token so a respondent can be given a
-- link back to their own submission without needing an account.

alter table submissions
  add column if not exists order_number bigserial,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists ip_address text,
  add column if not exists edit_token uuid not null default gen_random_uuid();

create unique index if not exists submissions_edit_token_idx on submissions (edit_token);

create or replace function set_submissions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_submissions_updated_at on submissions;
create trigger trg_submissions_updated_at
before update on submissions
for each row
execute function set_submissions_updated_at();
