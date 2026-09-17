-- Transfers are separate from collaborator invitations: no ownership changes
-- until the verified recipient explicitly accepts the emailed secret.
create table public.workflow_transfers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  recipient_id uuid references auth.users(id),
  owner_email text not null,
  recipient_email text not null,
  template_slug text not null,
  display_name text not null,
  form_ids uuid[] not null,
  token_hash text not null check (token_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'sending' check (status in ('sending','pending','accepted','declined','cancelled','expired','email_failed')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  resolved_at timestamptz,
  delivered_at timestamptz
);
create unique index workflow_transfers_one_pending on public.workflow_transfers(owner_id, template_slug) where status in ('sending','pending');
alter table public.workflow_transfers enable row level security;
revoke all on public.workflow_transfers from anon, authenticated;
grant all on public.workflow_transfers to service_role;

-- Staff/admin UPDATE policies must never provide an alternate ownership path.
create function public.guard_form_owner_change() returns trigger language plpgsql set search_path = public as $$
begin
  if new.user_id is distinct from old.user_id and current_user in ('anon','authenticated') then
    raise exception 'Use an accepted workflow transfer to change ownership';
  end if;
  return new;
end;
$$;
create trigger guard_form_owner_change before update of user_id on public.forms for each row execute function public.guard_form_owner_change();

-- Prevent a former owner from recreating a location grant after transfer.
alter policy "Owners manage their collaborator shares" on public.collaborator_shares
with check (owner_id = auth.uid() and (
  (scope = 'location' and exists(select 1 from public.forms f where f.id = form_id and f.user_id = auth.uid())) or
  (scope = 'workflow' and exists(select 1 from public.forms f where f.user_id = auth.uid() and f.settings->>'templateSlug' = template_slug))
));
alter policy "Owners can add form staff" on public.form_staff
with check (created_by = auth.uid() and exists(select 1 from public.forms f where f.id = form_id and f.user_id = auth.uid()));

create function public.manage_workflow_transfer(
  p_actor uuid, p_action text, p_slug text default null, p_email text default null,
  p_id uuid default null, p_hash text default null
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user auth.users%rowtype;
  v_transfer public.workflow_transfers%rowtype;
  v_ids uuid[];
  v_name text;
  v_email text;
begin
  select * into v_user from auth.users where id = p_actor and deleted_at is null;
  if v_user.id is null or v_user.email_confirmed_at is null then raise exception 'A verified email account is required'; end if;
  v_email := lower(btrim(v_user.email));

  if p_action in ('request','status') then
    if not exists(select 1 from public.forms where user_id = p_actor and settings->>'templateSlug' = p_slug and deleted_at is null) then
      raise exception 'Workflow not found';
    end if;
    update public.workflow_transfers set status = 'expired', resolved_at = now()
      where owner_id = p_actor and template_slug = p_slug and status in ('sending','pending') and expires_at <= now();
    if p_action = 'status' then
      select * into v_transfer from public.workflow_transfers where owner_id = p_actor and template_slug = p_slug order by created_at desc limit 1;
      return case when v_transfer.id is null then 'null'::jsonb else to_jsonb(v_transfer) - 'token_hash' - 'form_ids' end;
    end if;
    if p_email is null or length(p_email) > 254 or lower(btrim(p_email)) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'A valid recipient email is required'; end if;
    if lower(btrim(p_email)) = v_email then raise exception 'You already own this workflow'; end if;
    if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid invitation secret'; end if;
    lock table public.forms in share row exclusive mode;
    select array_agg(id order by id) into v_ids from public.forms where user_id = p_actor and settings->>'templateSlug' = p_slug;
    if v_ids is null then raise exception 'Workflow not found'; end if;
    select coalesce(wn.display_name, t.name, p_slug) into v_name from public.templates t
      left join public.workflow_names wn on wn.template_slug = t.slug and wn.owner_id = p_actor where t.slug = p_slug;
    insert into public.workflow_transfers(owner_id, owner_email, recipient_email, template_slug, display_name, form_ids, token_hash)
      values(p_actor, v_email, lower(btrim(p_email)), p_slug, coalesce(v_name,p_slug), v_ids, p_hash) returning * into v_transfer;
    return to_jsonb(v_transfer) - 'token_hash';
  end if;

  select * into v_transfer from public.workflow_transfers where id = p_id for update;
  if v_transfer.id is null then raise exception 'Invitation not found'; end if;
  if p_action in ('sent','email_failed','cancel') then
    if v_transfer.owner_id <> p_actor then raise exception 'Invitation not found'; end if;
    if v_transfer.status not in ('sending','pending') then raise exception 'This invitation is no longer pending'; end if;
    if p_action = 'sent' and v_transfer.status <> 'sending' then raise exception 'Invitation already sent'; end if;
    update public.workflow_transfers set status = case p_action when 'sent' then 'pending' when 'cancel' then 'cancelled' else 'email_failed' end,
      delivered_at = case when p_action = 'sent' then now() else delivered_at end,
      resolved_at = case when p_action = 'sent' then null else now() end
      where id = p_id returning * into v_transfer;
    return to_jsonb(v_transfer) - 'token_hash' - 'form_ids';
  end if;

  if v_email <> v_transfer.recipient_email or p_hash is null or p_hash <> v_transfer.token_hash then
    raise exception 'Sign in with the email address that received this invitation';
  end if;
  if p_action = 'review' then
    return (to_jsonb(v_transfer) - 'token_hash' - 'form_ids') || jsonb_build_object('form_count', cardinality(v_transfer.form_ids), 'expired', v_transfer.expires_at <= now());
  end if;
  if p_action = 'accept' and v_transfer.status = 'accepted' and v_transfer.recipient_id = p_actor then
    return to_jsonb(v_transfer) - 'token_hash' - 'form_ids';
  end if;
  if v_transfer.status <> 'pending' or v_transfer.delivered_at is null or v_transfer.expires_at <= now() then raise exception 'This invitation is no longer available'; end if;
  if p_action = 'decline' then
    update public.workflow_transfers set status = 'declined', resolved_at = now() where id = p_id returning * into v_transfer;
    return to_jsonb(v_transfer) - 'token_hash' - 'form_ids';
  end if;
  if p_action <> 'accept' then raise exception 'Unknown action'; end if;
  -- Hold form writes while checking the exact invited set and moving ownership.
  lock table public.forms in share row exclusive mode;
  select array_agg(id order by id) into v_ids from public.forms
    where user_id = v_transfer.owner_id and settings->>'templateSlug' = v_transfer.template_slug;
  if v_ids is distinct from v_transfer.form_ids then raise exception 'The workflow locations changed. Ask the owner to send a new invitation'; end if;
  if not exists(select 1 from public.forms where id = any(v_ids) and deleted_at is null) then raise exception 'This workflow is no longer available'; end if;
  if exists(select 1 from public.forms where user_id = p_actor and settings->>'templateSlug' = v_transfer.template_slug) then
    raise exception 'You already own this workflow type. Transfer cannot merge two workflows';
  end if;
  if exists(select 1 from public.forms f where f.settings->>'primaryFormId' = any(v_ids::text[]) and not (f.id = any(v_ids))) then
    raise exception 'Linked forms changed. Ask the owner to send a new invitation';
  end if;
  -- Former owner loses access, while other collaborators/staff retain it.
  delete from public.collaborator_shares where
    ((owner_id = v_transfer.owner_id and scope = 'workflow' and template_slug = v_transfer.template_slug) or form_id = any(v_ids))
    and email in (v_transfer.owner_email, v_email);
  update public.collaborator_shares set owner_id = p_actor, owner_email = v_email, invited_by = p_actor where
    (owner_id = v_transfer.owner_id and scope = 'workflow' and template_slug = v_transfer.template_slug) or form_id = any(v_ids);
  delete from public.form_staff where form_id = any(v_ids) and user_id in (v_transfer.owner_id, p_actor);
  update public.form_staff set created_by = p_actor where form_id = any(v_ids);
  delete from public.report_shared_viewers where form_id = any(v_ids) and lower(email) = v_transfer.owner_email;
  -- OAuth credentials belong to the previous owner, not to the new workflow owner.
  delete from private.google_oauth_tokens where form_id = any(v_ids);
  update public.forms set user_id = p_actor, settings = settings - 'googleSheetId' - 'googleSheetUrl' where id = any(v_ids);
  insert into public.workflow_names(owner_id, template_slug, display_name)
    select p_actor, template_slug, display_name from public.workflow_names where owner_id = v_transfer.owner_id and template_slug = v_transfer.template_slug
    on conflict (owner_id, template_slug) do update set display_name = excluded.display_name, updated_at = now();
  delete from public.workflow_names where owner_id = v_transfer.owner_id and template_slug = v_transfer.template_slug;
  update public.workflow_transfers set status = 'accepted', recipient_id = p_actor, resolved_at = now() where id = p_id returning * into v_transfer;
  return to_jsonb(v_transfer) - 'token_hash' - 'form_ids';
end;
$$;
revoke all on function public.manage_workflow_transfer(uuid,text,text,text,uuid,text) from public, anon, authenticated;
grant execute on function public.manage_workflow_transfer(uuid,text,text,text,uuid,text) to service_role;
