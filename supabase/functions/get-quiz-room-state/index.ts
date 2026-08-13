// Place at: supabase/functions/get-quiz-room-state/index.ts
// Deploy: supabase functions deploy get-quiz-room-state
// Admin-only (verify_jwt = true). Polled every ~2s by QuizAdminDashboard.jsx
// rather than pushed via Realtime - it's a single viewer, and the per-option
// breakdown is answer-key-adjacent (which option each count belongs to),
// so it has to stay behind requireQuizAdmin rather than going out over a
// channel every player's browser could in principle listen to.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { jsonResponse, corsHeaders, requireQuizAdmin } from '../_shared/quiz.ts'

Deno.serve(async req => {
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

    const { room_id } = await req.json()
    if (!room_id) return jsonResponse({ error: 'room_id is required' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const admin = await requireQuizAdmin(req, supabase, room_id)
    if (admin.error) return jsonResponse({ error: admin.error }, admin.status)
    const { room } = admin

    const { data: players, error: playersError } = await supabase
      .from('quiz_players')
      .select('id, nickname, avatar, total_points, correct_count, is_ready, final_rank')
      .eq('room_id', room_id)
      .order('total_points', { ascending: false })
    if (playersError) throw playersError

    const ranked = (players || []).map((p: any, i: number) => ({ ...p, rank: i + 1 }))
    const leader = ranked[0] || null

    let currentQuestion: any = null
    let optionCounts: number[] = []
    if (room.current_question_index >= 0) {
      const { data: question } = await supabase
        .from('quiz_questions').select('*').eq('room_id', room_id).eq('idx', room.current_question_index).maybeSingle()

      if (question) {
        const { data: answers } = await supabase
          .from('quiz_answers').select('selected_option_index').eq('question_id', question.id)

        optionCounts = new Array((question.options || []).length).fill(0)
        ;(answers || []).forEach((a: any) => {
          if (a.selected_option_index != null && optionCounts[a.selected_option_index] != null) {
            optionCounts[a.selected_option_index]++
          }
        })

        currentQuestion = {
          id: question.id, idx: question.idx, prompt: question.prompt, options: question.options,
          correct_option_index: question.correct_option_index, answer_count: (answers || []).length,
        }
      }
    }

    return jsonResponse({
      room: {
        id: room.id, code: room.code, name: room.name, state: room.state, live_phase: room.live_phase,
        current_question_index: room.current_question_index, question_count: room.question_count,
        is_paused: room.is_paused, current_question_ends_at: room.current_question_ends_at,
      },
      player_count: ranked.length,
      players: ranked,
      leader,
      current_question: currentQuestion,
      option_counts: optionCounts,
    })
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500)
  }
})
