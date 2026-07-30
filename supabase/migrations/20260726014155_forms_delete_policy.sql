-- `forms` had SELECT/INSERT/UPDATE policies but no DELETE policy, so Row
-- Level Security silently denied every delete: Supabase's delete() call
-- doesn't error when RLS filters out the target row, it just reports 0 rows
-- affected. The app's UI didn't check for that, so it removed the form from
-- local state optimistically while the row stayed in the database: the
-- form would then reappear on the next load. Adding the missing policy so
-- owners can actually delete their own forms.

create policy "Owners can delete own forms"
on forms
for delete
using (user_id = auth.uid());

-- Same gap on submissions: only SELECT/UPDATE/INSERT policies existed, so
-- "permanently delete" and "empty bin" in the Records page were also
-- silently no-ops.
create policy "Owners can delete their submissions"
on submissions
for delete
using (
  exists (
    select 1 from forms
    where forms.id = submissions.form_id and forms.user_id = auth.uid()
  )
);
