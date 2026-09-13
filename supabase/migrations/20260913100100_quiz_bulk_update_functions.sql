-- Bulk-update helpers for advance-quiz-room's finalizeRoom and
-- manage-quiz-questions' delete/reorder actions. Both call sites used to
-- fire one UPDATE per row via Promise.all (concurrent round trips, but
-- still N separate statements) - these collapse each into a single
-- set-based UPDATE ... FROM unnest(...) statement instead, one round trip
-- and one statement no matter how many rows are being renumbered.
--
-- Both edge functions call these via supabase.rpc() using the
-- service-role client, so no SECURITY DEFINER is needed - same convention
-- as apply_cart_stock_changes (revoke from public, grant to service_role
-- only).

-- p_player_ids and p_ranks are parallel arrays (ids[i] gets ranks[i]).
-- room_id is re-checked here as defense-in-depth even though the ids
-- already come from a query scoped to this room upstream.
create or replace function finalize_quiz_room_ranks(p_room_id uuid, p_player_ids uuid[], p_ranks int[])
returns void
language sql
as $$
  update quiz_players
  set final_rank = v.final_rank
  from (select * from unnest(p_player_ids, p_ranks) as v(id, final_rank)) v
  where quiz_players.id = v.id and quiz_players.room_id = p_room_id;
$$;

revoke all on function finalize_quiz_room_ranks(uuid, uuid[], int[]) from public;
grant execute on function finalize_quiz_room_ranks(uuid, uuid[], int[]) to service_role;


-- p_question_ids and p_idxs are parallel arrays (ids[i] gets idxs[i]).
-- quiz_questions has a unique(room_id, idx) constraint - collapsing the
-- renumbering into one UPDATE (rather than one per row) is what keeps a
-- swap like [0,1] -> [1,0] from tripping it, since the whole set of new
-- idx values is applied together instead of row-by-row.
create or replace function reorder_quiz_questions(p_room_id uuid, p_question_ids uuid[], p_idxs int[])
returns void
language sql
as $$
  update quiz_questions
  set idx = v.idx
  from (select * from unnest(p_question_ids, p_idxs) as v(id, idx)) v
  where quiz_questions.id = v.id and quiz_questions.room_id = p_room_id;
$$;

revoke all on function reorder_quiz_questions(uuid, uuid[], int[]) from public;
grant execute on function reorder_quiz_questions(uuid, uuid[], int[]) to service_role;
