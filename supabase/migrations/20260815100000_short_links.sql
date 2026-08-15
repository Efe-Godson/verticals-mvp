-- Short, shareable codes for a form's public order-screen link (see
-- PosSidePanel's Share Link) - "/s/:code" resolves back to the real
-- "/form/:id" via ShortLinkRedirect.jsx. Carries nothing but a public-safe
-- mapping (a form's own id, already reachable at its full-length URL
-- anyway), so it's fine to expose whole to anyone, same reasoning as
-- quiz_rooms' own public-read policy.
create table short_links (
  code text primary key,
  form_id uuid not null references forms(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index short_links_form_id_idx on short_links (form_id);

alter table short_links enable row level security;

create policy "Anyone can resolve a short link"
on short_links for select
to public
using (true);

-- A form's owner, or staff assigned to it, can mint a short link for it -
-- same "who's allowed to touch this form" shape form_staff.sql already uses
-- for forms/submissions.
create policy "Owners and staff can create short links for their form"
on short_links for insert
to authenticated
with check (
  exists (select 1 from forms where forms.id = form_id and forms.user_id = auth.uid())
  or exists (select 1 from form_staff where form_staff.form_id = short_links.form_id and form_staff.user_id = auth.uid())
);
