// Place at: supabase/functions/get-player-quiz-history/index.ts
// Deploy: supabase functions deploy get-player-quiz-history
// Public, unauthenticated (verify_jwt = false). Powers Quiz Home's "My Quiz
// History / Overall Points / My Rank" and the dedicated Point History page.
// Stats are computed here on every read by aggregating quiz_players rather
// than denormalized onto quiz_player_identities, since this page is a cold
// path (viewed rarely) and this avoids a second mutation site racing the
// atomic score increment in submit-quiz-answer. Device-local only - a
// different browser/device is a different identity_token, by design (see
// the quiz_tables migration comment on quiz_player_identities).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { jsonResponse, corsHeaders } from '../_shared/quiz.ts'

Deno.serve(async req => {
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

    const { identity_token } = await req.json()
    if (!identity_token) return jsonResponse({ error: 'identity_token is required' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: rows, error } = await supabase
      .from('quiz_players')
      .select('total_points, correct_count, final_rank, joined_at, quiz_rooms(id, name, question_count, state, created_at)')
      .eq('identity_id', identity_token)
    if (error) throw error

    const finished = (rows || []).filter((r: any) => r.quiz_rooms && r.final_rank != null)

    const totalPoints = finished.reduce((sum: number, r: any) => sum + r.total_points, 0)
    const quizzesPlayed = finished.length
    const accuracies = finished
      .filter((r: any) => r.quiz_rooms.question_count > 0)
      .map((r: any) => r.correct_count / r.quiz_rooms.question_count)
    const averageAccuracy = accuracies.length ? accuracies.reduce((a: number, b: number) => a + b, 0) / accuracies.length : 0
    const bestRank = finished.length ? Math.min(...finished.map((r: any) => r.final_rank)) : null

    const history = finished
      .map((r: any) => ({
        room_id: r.quiz_rooms.id,
        name: r.quiz_rooms.name,
        date: r.quiz_rooms.created_at,
        points: r.total_points,
        rank: r.final_rank,
      }))
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return jsonResponse({
      total_points: totalPoints,
      quizzes_played: quizzesPlayed,
      average_accuracy: averageAccuracy,
      best_rank: bestRank,
      history,
    })
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500)
  }
})
