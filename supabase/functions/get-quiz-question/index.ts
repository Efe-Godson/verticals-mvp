// Place at: supabase/functions/get-quiz-question/index.ts
// Deploy: supabase functions deploy get-quiz-question
// Public, unauthenticated (verify_jwt = false) - the only way an anonymous
// player's browser ever sees a question, since quiz_questions itself has no
// RLS policies at all. Whether the answer key is safe to reveal depends
// entirely on the room's current live_phase for that question index, judged
// server-side - never trust the client's own idea of what phase it's in.
// server_now lets the client correct its local countdown for clock skew
// against current_question_ends_at (itself read straight off quiz_rooms,
// which every client already has via direct RLS select + Realtime).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { jsonResponse, corsHeaders } from '../_shared/quiz.ts'

Deno.serve(async req => {
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

    const { room_id, index } = await req.json()
    if (!room_id) return jsonResponse({ error: 'room_id is required' }, 400)
    if (!Number.isInteger(index)) return jsonResponse({ error: 'index is required' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: room, error: roomError } = await supabase
      .from('quiz_rooms').select('*').eq('id', room_id).is('deleted_at', null).single()
    if (roomError || !room) return jsonResponse({ error: 'Room not found' }, 404)

    const { data: question, error: questionError } = await supabase
      .from('quiz_questions').select('*').eq('room_id', room_id).eq('idx', index).maybeSingle()
    if (questionError) throw questionError
    if (!question) return jsonResponse({ error: 'Question not found' }, 404)

    const revealed = room.state === 'finished'
      || index < room.current_question_index
      || (index === room.current_question_index && room.live_phase === 'scoreboard')

    const serverNow = Date.now()

    if (revealed) {
      return jsonResponse({
        question: {
          id: question.id, idx: question.idx, type: question.type, prompt: question.prompt,
          options: question.options, correct_option_index: question.correct_option_index,
          explanation: question.explanation, duration_seconds: question.duration_seconds,
        },
        server_now: serverNow,
      })
    }

    return jsonResponse({
      question: {
        id: question.id, idx: question.idx, type: question.type, prompt: question.prompt,
        options: question.options, duration_seconds: question.duration_seconds,
      },
      ends_at: index === room.current_question_index ? room.current_question_ends_at : null,
      is_paused: room.is_paused,
      server_now: serverNow,
    })
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500)
  }
})
