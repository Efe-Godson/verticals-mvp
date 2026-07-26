-- Shared template library: was a hardcoded array in Templates.jsx with no
-- real field data (Start just linked to a blank /create). Moving to a real
-- table so templates can be added as data instead of a code change, and so
-- Templates.jsx can filter/search instead of rendering a fixed list.
create table templates (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  category text not null,
  eyebrow text,
  description text,
  highlights text[] not null default '{}',
  fields jsonb not null default '[]',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table templates enable row level security;

-- Every signed-in user can browse the shared template library.
create policy "Authenticated users can view templates"
on templates for select
to authenticated
using (true);

-- Only the main account curates the shared library, so templates stay
-- consistent instead of every user adding their own into the shared list.
create policy "Only the main account can manage templates"
on templates for all
to authenticated
using (auth.uid() = '7d91d04c-d223-4ef1-a94d-382aa2d31bfe')
with check (auth.uid() = '7d91d04c-d223-4ef1-a94d-382aa2d31bfe');
