-- Tightens get_share_role/list_accessible_workflows (added in
-- 20260913170000_collaborator_shares.sql) so `anon` can no longer call them.
--
-- `revoke all on function ... from public` (the pattern already used by the
-- older is_report_shared_viewer/set_report_shared_viewers) only strips the
-- PUBLIC pseudo-role's grant - it does NOT touch a grant held directly by a
-- named role. This project's own Postgres role setup grants EXECUTE on
-- every new public-schema function to `anon` directly (via a project-level
-- ALTER DEFAULT PRIVILEGES, not through PUBLIC), so that revoke never
-- actually removed anon's access to begin with. Confirmed via
-- has_function_privilege('anon', ...) after the previous migration shipped:
-- anon had EXECUTE on both functions despite the revoke.
--
-- Not an active data leak either way - both functions are internally gated
-- on auth.uid()/auth.jwt()->>'email', which are null for an anon caller, so
-- they've only ever returned empty/null for anon, never real rows. This is
-- defense-in-depth: removing the unnecessary grant outright rather than
-- relying on the function body alone to keep anon out.
revoke execute on function public.get_share_role(uuid) from anon;
revoke execute on function public.list_accessible_workflows() from anon;
