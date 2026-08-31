-- Unattended Google Sheet sync: whenever a form's submissions change, a
-- statement-level trigger POSTs { form_id } to the sheet-sync edge function
-- (via pg_net), which rebuilds and rewrites the linked sheet using a stored
-- Google refresh token. Nothing here runs unless the form has both a
-- googleSheetId in settings and a stored refresh token.

create extension if not exists pg_net;
create schema if not exists private;

-- Per-form Google refresh token (offline access). Private schema so it is
-- never exposed through PostgREST; the client writes it only via the
-- security-definer RPC below, the edge function reads it with the service role.
create table if not exists private.google_oauth_tokens (
  form_id      uuid primary key references forms(id) on delete cascade,
  refresh_token text not null,
  updated_at   timestamptz not null default now()
);
alter table private.google_oauth_tokens enable row level security;
-- no policies: authenticated / anon get nothing; service_role bypasses RLS.

-- The client hands its provider_refresh_token here after granting Google
-- consent. SECURITY DEFINER + an explicit ownership check keeps a caller
-- from writing a token for a form they don't own.
create or replace function public.store_sheet_refresh_token(p_form_id uuid, p_token text)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if p_token is null or length(p_token) = 0 then
    return;
  end if;
  if not exists (select 1 from forms where id = p_form_id and user_id = auth.uid()) then
    raise exception 'not allowed';
  end if;
  insert into private.google_oauth_tokens (form_id, refresh_token, updated_at)
  values (p_form_id, p_token, now())
  on conflict (form_id) do update set refresh_token = excluded.refresh_token, updated_at = now();
end;
$$;
revoke all on function public.store_sheet_refresh_token(uuid, text) from public, anon;
grant execute on function public.store_sheet_refresh_token(uuid, text) to authenticated;

-- Where the trigger POSTs, and the shared secret the edge function checks.
create table if not exists private.sheet_sync_config (
  id           boolean primary key default true check (id),
  function_url text not null,
  shared_secret text not null
);
insert into private.sheet_sync_config (id, function_url, shared_secret)
values (
  true,
  'https://suollljmcdnfxefytxbs.supabase.co/functions/v1/sheet-sync',
  replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
)
on conflict (id) do nothing;

-- One POST per distinct form per statement (so a bulk import = one call),
-- and only for forms that are actually set up for sync.
create or replace function private.notify_sheet_sync()
returns trigger
language plpgsql
security definer
set search_path = public, private, net
as $$
declare
  cfg private.sheet_sync_config%rowtype;
  r   record;
begin
  select * into cfg from private.sheet_sync_config limit 1;
  if cfg.function_url is null then
    return null;
  end if;

  for r in select distinct form_id from changed loop
    if r.form_id is not null
       and exists (select 1 from forms f where f.id = r.form_id and f.settings ? 'googleSheetId')
       and exists (select 1 from private.google_oauth_tokens t where t.form_id = r.form_id)
    then
      perform net.http_post(
        url     := cfg.function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-sheet-sync-secret', cfg.shared_secret
        ),
        body    := jsonb_build_object('form_id', r.form_id)
      );
    end if;
  end loop;

  return null;
end;
$$;

drop trigger if exists trg_sheet_sync_insert on submissions;
drop trigger if exists trg_sheet_sync_update on submissions;
drop trigger if exists trg_sheet_sync_delete on submissions;

create trigger trg_sheet_sync_insert
  after insert on submissions
  referencing new table as changed
  for each statement execute function private.notify_sheet_sync();

create trigger trg_sheet_sync_update
  after update on submissions
  referencing new table as changed
  for each statement execute function private.notify_sheet_sync();

create trigger trg_sheet_sync_delete
  after delete on submissions
  referencing old table as changed
  for each statement execute function private.notify_sheet_sync();
