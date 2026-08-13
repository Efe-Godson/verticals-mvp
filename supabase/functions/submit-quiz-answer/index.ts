// Place at: supabase/functions/submit-quiz-answer/index.ts
// Deploy: supabase functions deploy submit-quiz-answer
// Public, unauthenticated (verify_jwt = false). The one place correctness
// and points are ever computed - entirely server-side, off the room's own
// current_question_ends_at/current_question_started_at and the question's
// own correct_option_index, never off anything the client sends. The client
// only ever learns whether the submission was accepted, not whether it was
// right - correctness/points are only revealed once the room moves to the
// scoreboard phase (see get-quiz-question), so an early response can't leak
// the answer key to players who haven't answered yet.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { jsonResponse, corsHeaders, requirePlayerCredential, scoreAnswer, broadcastPlayers, GRACE_MS } from '../_shared/quiz.ts'

Deno.serve(async req => {
  // Captured before any I/O so DB round-trips below don't inflate this
  // player's own response time.
  const answeredAtMs = Date.now()

  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

    const { room_id, player_id, player_secret, question_id, selected_option_index } = await req.json()
    if (!room_id || !question_id) return jsonResponse({ error: 'room_id and question_id are required' }, 400)
    if (!Number.isInteger(selected_option_index)) {
      return jsonResponse({ error: 'selected_option_index is required' }, 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const credential = await requirePlayerCredential(supabase, room_id, player_id, player_secret)
    if (credential.error) return jsonResponse({ error: credential.error }, credential.status)
    const { player } = credential

    const { data: room, error: roomError } = await supabase
      .from('quiz_rooms').select('*').eq('id', room_id).single()
    if (roomError || !room) return jsonResponse({ error: 'Room not found' }, 404)

    const { data: question, error: questionError } = await supabase
      .from('quiz_questions').select('*').eq('id', question_id).eq('room_id', room_id).single()
    if (questionError || !question) return jsonResponse({ error: 'Question not found' }, 404)

    if (room.live_phase !== 'question' || question.idx !== room.current_question_index) {
      return jsonResponse({ error: 'This question is no longer accepting answers' }, 403)
    }
    if (room.is_paused) return jsonResponse({ error: 'The quiz is paused' }, 403)

    const endsAtMs = new Date(room.current_question_ends_at).getTime()
    if (answeredAtMs > endsAtMs + GRACE_MS) {
      return jsonResponse({ error: "Time's up" }, 403)
    }

    const isCorrect = selected_option_index === question.correct_option_index
    const responseMs = Math.max(0, answeredAtMs - new Date(room.current_question_started_at).getTime())
    const points = scoreAnswer(isCorrect, endsAtMs, answeredAtMs, question.duration_seconds)

    const { error: insertError } = await supabase
      .from('quiz_answers')
      .insert([{
        room_id, question_id, player_id,
        selected_option_index, is_correct: isCorrect, points_awarded: points,
        response_ms: responseMs, answered_at: new Date(answeredAtMs).toISOString(),
      }])
    if (insertError) {
      if (insertError.code === '23505') return jsonResponse({ error: 'Already answered' }, 409)
      throw insertError
    }

    const nextFastest = isCorrect
      ? (player.fastest_answer_ms == null ? responseMs : Math.min(player.fastest_answer_ms, responseMs))
      : player.fastest_answer_ms

    const { error: updateError } = await supabase
      .from('quiz_players')
      .update({
        total_points: player.total_points + points,
        correct_count: player.correct_count + (isCorrect ? 1 : 0),
        fastest_answer_ms: nextFastest,
      })
      .eq('id', player_id)
    if (updateError) throw updateError

    await broadcastPlayers(supabase, room_id)

    return jsonResponse({ submitted: true })
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500)
  }
})
