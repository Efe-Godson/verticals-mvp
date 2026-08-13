// Place at: supabase/functions/advance-quiz-room/index.ts
// Deploy: supabase functions deploy advance-quiz-room
// Single-function action dispatch (mirrors manage-staff), verify_jwt = false
// at the config level because 'reveal' has dual authorization - everything
// else re-checks requireQuizAdmin per action instead of relying on the
// platform-level JWT gate. Every transition is a conditional UPDATE guarded
// by the room's current state/live_phase, so a duplicate/racing call (e.g.
// two admin tabs, or the "anyone can reveal past the deadline" path firing
// alongside an admin's own click) just affects zero rows the second time
// instead of double-advancing the room.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { jsonResponse, corsHeaders, requireQuizAdmin, broadcastPlayers } from '../_shared/quiz.ts'

async function questionEndsAt(room: any, index: number, supabase: any) {
  const { data: question, error } = await supabase
    .from('quiz_questions').select('duration_seconds').eq('room_id', room.id).eq('idx', index).single()
  if (error || !question) throw new Error('Question not found for index ' + index)
  const startedAt = Date.now()
  return {
    startedAt: new Date(startedAt).toISOString(),
    endsAt: new Date(startedAt + question.duration_seconds * 1000).toISOString(),
  }
}

// Backfills a zero-point "no answer" row for anyone who never submitted, so
// admin analytics and the scoreboard both count non-responses instead of
// silently omitting them.
async function backfillNonAnswers(supabase: any, room: any) {
  const { data: question } = await supabase
    .from('quiz_questions').select('id').eq('room_id', room.id).eq('idx', room.current_question_index).single()
  if (!question) return

  const [{ data: players }, { data: answers }] = await Promise.all([
    supabase.from('quiz_players').select('id').eq('room_id', room.id),
    supabase.from('quiz_answers').select('player_id').eq('question_id', question.id),
  ])
  const answered = new Set((answers || []).map((a: any) => a.player_id))
  const missing = (players || []).filter((p: any) => !answered.has(p.id))
  if (!missing.length) return

  await supabase.from('quiz_answers').insert(missing.map((p: any) => ({
    room_id: room.id, question_id: question.id, player_id: p.id,
    selected_option_index: null, is_correct: false, points_awarded: 0,
    response_ms: 0, answered_at: new Date().toISOString(),
  })))
}

async function finalizeRoom(supabase: any, roomId: string) {
  const { data: players, error } = await supabase
    .from('quiz_players').select('id, total_points').eq('room_id', roomId)
    .order('total_points', { ascending: false })
  if (error) throw error

  for (let i = 0; i < (players || []).length; i++) {
    await supabase.from('quiz_players').update({ final_rank: i + 1 }).eq('id', players[i].id)
  }

  await supabase.from('quiz_rooms').update({ state: 'finished', live_phase: null }).eq('id', roomId)
}

Deno.serve(async req => {
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

    const { room_id, action } = await req.json()
    if (!room_id) return jsonResponse({ error: 'room_id is required' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 'reveal' is the one action anyone can trigger once the deadline has
    // passed (see module comment) - every other action always requires the
    // verified room admin.
    let room: any
    if (action === 'reveal') {
      const authHeader = req.headers.get('Authorization')
      let isAdminCaller = false
      if (authHeader) {
        const check = await requireQuizAdmin(req, supabase, room_id)
        if (!check.error) { isAdminCaller = true; room = check.room }
      }
      if (!room) {
        const { data, error } = await supabase.from('quiz_rooms').select('*').eq('id', room_id).is('deleted_at', null).single()
        if (error || !data) return jsonResponse({ error: 'Room not found' }, 404)
        room = data
      }
      if (!isAdminCaller && Date.now() < new Date(room.current_question_ends_at).getTime()) {
        return jsonResponse({ error: 'The timer has not run out yet' }, 403)
      }
    } else {
      const admin = await requireQuizAdmin(req, supabase, room_id)
      if (admin.error) return jsonResponse({ error: admin.error }, admin.status)
      room = admin.room
    }

    if (action === 'open_lobby') {
      if (room.state !== 'setup') return jsonResponse({ error: 'Room is not in setup' }, 403)
      const { count } = await supabase
        .from('quiz_questions').select('id', { count: 'exact', head: true }).eq('room_id', room_id)
      if (!count) return jsonResponse({ error: 'Generate at least one question first' }, 400)

      await supabase.from('quiz_rooms').update({ state: 'lobby' }).eq('id', room_id).eq('state', 'setup')
      return jsonResponse({ ok: true })
    }

    if (action === 'start') {
      if (room.state !== 'lobby') return jsonResponse({ error: 'Room is not in the lobby' }, 403)

      const { startedAt, endsAt } = await questionEndsAt(room, 0, supabase)
      const { error } = await supabase
        .from('quiz_rooms')
        .update({
          state: 'live', live_phase: 'question', current_question_index: 0,
          current_question_started_at: startedAt, current_question_ends_at: endsAt,
          is_paused: false, paused_at: null,
        })
        .eq('id', room_id).eq('state', 'lobby')
      if (error) throw error
      return jsonResponse({ ok: true })
    }

    if (action === 'reveal') {
      if (room.state !== 'live' || room.live_phase !== 'question') return jsonResponse({ ok: true }) // already revealed, idempotent no-op

      await backfillNonAnswers(supabase, room)

      const { error } = await supabase
        .from('quiz_rooms').update({ live_phase: 'scoreboard' })
        .eq('id', room_id).eq('state', 'live').eq('live_phase', 'question')
        .eq('current_question_index', room.current_question_index)
      if (error) throw error

      await broadcastPlayers(supabase, room_id)
      return jsonResponse({ ok: true })
    }

    if (action === 'next') {
      if (room.state !== 'live' || room.live_phase !== 'scoreboard') {
        return jsonResponse({ error: 'Reveal the current question before advancing' }, 403)
      }

      const nextIndex = room.current_question_index + 1
      if (nextIndex >= room.question_count) {
        await finalizeRoom(supabase, room_id)
        await broadcastPlayers(supabase, room_id)
        return jsonResponse({ ok: true, finished: true })
      }

      const { startedAt, endsAt } = await questionEndsAt(room, nextIndex, supabase)
      const { error } = await supabase
        .from('quiz_rooms')
        .update({
          live_phase: 'question', current_question_index: nextIndex,
          current_question_started_at: startedAt, current_question_ends_at: endsAt,
          is_paused: false, paused_at: null,
        })
        .eq('id', room_id).eq('live_phase', 'scoreboard')
      if (error) throw error
      return jsonResponse({ ok: true })
    }

    if (action === 'pause') {
      if (room.state !== 'live' || room.live_phase !== 'question' || room.is_paused) {
        return jsonResponse({ error: 'Nothing to pause' }, 403)
      }
      const { error } = await supabase
        .from('quiz_rooms').update({ is_paused: true, paused_at: new Date().toISOString() })
        .eq('id', room_id).eq('is_paused', false)
      if (error) throw error
      return jsonResponse({ ok: true })
    }

    if (action === 'resume') {
      if (!room.is_paused) return jsonResponse({ error: 'Not paused' }, 403)

      const pausedMs = Date.now() - new Date(room.paused_at).getTime()
      const newEndsAt = new Date(new Date(room.current_question_ends_at).getTime() + pausedMs).toISOString()

      const { error } = await supabase
        .from('quiz_rooms').update({ is_paused: false, paused_at: null, current_question_ends_at: newEndsAt })
        .eq('id', room_id).eq('is_paused', true)
      if (error) throw error
      return jsonResponse({ ok: true })
    }

    if (action === 'end') {
      if (room.state === 'finished') return jsonResponse({ ok: true })
      await finalizeRoom(supabase, room_id)
      await broadcastPlayers(supabase, room_id)
      return jsonResponse({ ok: true })
    }

    return jsonResponse({ error: 'Unknown action' }, 400)
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500)
  }
})
