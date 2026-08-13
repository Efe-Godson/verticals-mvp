// Place at: supabase/functions/manage-quiz-questions/index.ts
// Deploy: supabase functions deploy manage-quiz-questions
// Admin-only, setup-phase only. The non-AI counterpart to
// generate-quiz-questions: hand-editing a question's text/options/answer,
// deleting one, or reordering the set during the pre-game review step.
// Delete/reorder both re-sequence idx to stay contiguous (0..n-1), since
// quiz_questions has a unique(room_id, idx) constraint the live game relies
// on to fetch "the next question" by position.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { jsonResponse, corsHeaders, requireQuizAdmin } from '../_shared/quiz.ts'

Deno.serve(async req => {
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

    const body = await req.json()
    const { room_id, action } = body
    if (!room_id) return jsonResponse({ error: 'room_id is required' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const admin = await requireQuizAdmin(req, supabase, room_id)
    if (admin.error) return jsonResponse({ error: admin.error }, admin.status)
    const { room } = admin

    if (room.state !== 'setup') {
      return jsonResponse({ error: 'Questions can only be edited while the room is in setup' }, 403)
    }

    if (action === 'update') {
      const { question_id, prompt, options, correct_option_index, explanation, difficulty, type } = body
      if (!question_id) return jsonResponse({ error: 'question_id is required' }, 400)

      const patch: Record<string, unknown> = {}
      if (prompt !== undefined) patch.prompt = prompt
      if (options !== undefined) patch.options = options
      if (correct_option_index !== undefined) patch.correct_option_index = correct_option_index
      if (explanation !== undefined) patch.explanation = explanation
      if (difficulty !== undefined) patch.difficulty = difficulty
      if (type !== undefined) patch.type = type

      const { data: updated, error } = await supabase
        .from('quiz_questions').update(patch).eq('id', question_id).eq('room_id', room_id)
        .select('*').single()
      if (error) throw error
      return jsonResponse({ question: updated })
    }

    if (action === 'delete') {
      const { question_id } = body
      if (!question_id) return jsonResponse({ error: 'question_id is required' }, 400)

      const { data: remaining, error: deleteError } = await supabase
        .from('quiz_questions').delete().eq('id', question_id).eq('room_id', room_id)
        .select('id')
      if (deleteError) throw deleteError
      if (!remaining?.length) return jsonResponse({ error: 'Question not found' }, 404)

      const { data: questions, error: listError } = await supabase
        .from('quiz_questions').select('id').eq('room_id', room_id).order('idx')
      if (listError) throw listError

      for (let i = 0; i < questions.length; i++) {
        await supabase.from('quiz_questions').update({ idx: i }).eq('id', questions[i].id)
      }
      await supabase.from('quiz_rooms').update({ question_count: questions.length }).eq('id', room_id)

      return jsonResponse({ ok: true, question_count: questions.length })
    }

    if (action === 'reorder') {
      const { order } = body
      if (!Array.isArray(order) || order.length === 0) return jsonResponse({ error: 'order is required' }, 400)

      for (let i = 0; i < order.length; i++) {
        const { error } = await supabase
          .from('quiz_questions').update({ idx: i }).eq('id', order[i]).eq('room_id', room_id)
        if (error) throw error
      }

      const { data: questions, error: listError } = await supabase
        .from('quiz_questions').select('*').eq('room_id', room_id).order('idx')
      if (listError) throw listError
      return jsonResponse({ questions })
    }

    return jsonResponse({ error: 'Unknown action' }, 400)
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500)
  }
})
