-- Records.jsx subscribes to postgres_changes on `submissions` (filtered by
-- form_id) so the table updates as orders / responses come in, with no
-- manual refresh. That needs:
--   1. the table in the `supabase_realtime` publication, and
--   2. replica identity FULL, so UPDATE / DELETE payloads carry form_id
--      (the client-side `form_id=eq.<id>` filter can't match a delete row
--      that only has its primary key otherwise).

alter table public.submissions replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'submissions'
  ) then
    alter publication supabase_realtime add table public.submissions;
  end if;
end $$;
