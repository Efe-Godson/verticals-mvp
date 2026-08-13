// Place at: supabase/functions/create-quiz-room/index.ts
// Deploy: supabase functions deploy create-quiz-room
// Admin-only (verify_jwt = true): creates a new quiz room in 'setup' state,
// before any AI question generation. Room-code uniqueness is enforced by the
// partial unique index in the quiz_tables migration - insert-and-retry here
// rather than a pre-check, since a pre-check-then-insert has a race window a
// concurrent insert could still slip through.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { jsonResponse, corsHeaders, requireQuizAdmin, generateRoomCode } from '../_shared/quiz.ts'

const MAX_CODE_ATTEMPTS = 5
const DIFFICULTIES = ['easy', 'medium', 'hard', 'mixed']
const QUESTION_TYPES = ['mcq', 'true_false', 'mixed']
const QUESTION_DURATIONS = [10, 20, 30, 60]

Deno.serve(async req => {
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const admin = await requireQuizAdmin(req, supabase)
    if (admin.error) return jsonResponse({ error: admin.error }, admin.status)

    const { name, topic, question_count, difficulty, question_type, time_per_question_seconds } = await req.json()

    if (!name?.trim()) return jsonResponse({ error: 'name is required' }, 400)
    if (!Number.isInteger(question_count) || question_count < 1 || question_count > 20) {
      return jsonResponse({ error: 'question_count must be between 1 and 20' }, 400)
    }
    if (!DIFFICULTIES.includes(difficulty)) return jsonResponse({ error: 'Invalid difficulty' }, 400)
    if (!QUESTION_TYPES.includes(question_type)) return jsonResponse({ error: 'Invalid question_type' }, 400)
    if (!QUESTION_DURATIONS.includes(time_per_question_seconds)) {
      return jsonResponse({ error: 'Invalid time_per_question_seconds' }, 400)
    }

    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const code = generateRoomCode()
      const { data: room, error } = await supabase
        .from('quiz_rooms')
        .insert([{
          code,
          name: name.trim(),
          topic: topic?.trim() || null,
          admin_user_id: admin.userId,
          state: 'setup',
          question_count,
          difficulty,
          question_type,
          time_per_question_seconds,
        }])
        .select('id, code')
        .single()

      if (!error) return jsonResponse({ room_id: room.id, code: room.code })
      // 23505 = unique_violation - only the code collision is expected here,
      // anything else should surface immediately instead of retrying blindly.
      if (error.code !== '23505') throw error
    }

    return jsonResponse({ error: 'Could not generate a unique room code, please try again' }, 500)
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500)
  }
})
