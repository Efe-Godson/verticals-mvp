// Place at: supabase/functions/generate-quiz-questions/index.ts
// Deploy: supabase functions deploy generate-quiz-questions
// Secret: reuses GEMINI_API_KEY (already set for ai-analyst/ai-ask)
// Admin-only, setup-phase only. Two actions: generate_batch (replaces every
// question in the room, used on first generation and on "regenerate all")
// and regenerate_one (replaces a single question by index, used by the
// per-question "regenerate" button in the review step). Explanations are
// generated in the same call as the questions themselves - cheap to include
// up front, and needed at the scoreboard reveal regardless.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { jsonResponse, corsHeaders, requireQuizAdmin } from '../_shared/quiz.ts'

const GEMINI_MODEL = 'gemini-flash-latest'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

function questionSchema(fixedType: string | null) {
  return {
    type: 'object',
    properties: {
      prompt: { type: 'string' },
      type: fixedType
        ? { type: 'string', enum: [fixedType] }
        : { type: 'string', enum: ['mcq', 'true_false'] },
      options: { type: 'array', items: { type: 'string' } },
      correct_option_index: { type: 'integer' },
      explanation: { type: 'string' },
      difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
    },
    required: ['prompt', 'type', 'options', 'correct_option_index', 'explanation', 'difficulty'],
  }
}

function buildPrompt(opts: {
  topic: string | null
  adminPrompt: string
  count: number
  difficulty: string
  questionType: string
}) {
  const { topic, adminPrompt, count, difficulty, questionType } = opts

  const difficultyInstruction = difficulty === 'mixed'
    ? 'Vary each question\'s difficulty (easy/medium/hard) so the set as a whole feels mixed.'
    : `Every question should be "${difficulty}" difficulty.`

  const typeInstruction = questionType === 'mixed'
    ? 'Use a mix of "mcq" (4 options) and "true_false" (options exactly ["True","False"]) questions.'
    : questionType === 'true_false'
      ? 'Every question is "true_false": options must be exactly ["True","False"].'
      : 'Every question is "mcq": exactly 4 options, one correct.'

  return `You are writing a live multiplayer quiz${topic ? ` about "${topic}"` : ''}.

Host's instructions: ${adminPrompt}

Generate exactly ${count} question(s).
${difficultyInstruction}
${typeInstruction}

For each question:
- prompt: clear, unambiguous, answerable from general knowledge of the topic (not a trick question).
- options: for mcq, 4 plausible options with exactly one correct answer and no duplicate/overlapping options. For true_false, exactly ["True","False"].
- correct_option_index: 0-based index into options.
- explanation: 1 short sentence explaining why the correct answer is correct, shown to players after they answer.
- difficulty: this question's own difficulty tag.

Avoid ambiguous questions, questions with more than one defensible correct answer, and options that are near-duplicates of each other.`
}

async function callGemini(prompt: string, count: number, fixedType: string | null) {
  const schema = {
    type: 'object',
    properties: {
      questions: { type: 'array', items: questionSchema(fixedType), minItems: count, maxItems: count },
    },
    required: ['questions'],
  }

  const res = await fetch(`${GEMINI_URL}?key=${Deno.env.get('GEMINI_API_KEY')}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: schema },
    }),
  })
  if (!res.ok) throw new Error(`Gemini API error: ${res.status} ${await res.text()}`)

  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('No content returned from Gemini')

  const parsed = JSON.parse(text)
  const questions = parsed.questions
  if (!Array.isArray(questions) || questions.length === 0) throw new Error('Gemini returned no questions')
  return questions
}

Deno.serve(async req => {
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

    const body = await req.json()
    const { room_id, action, index, prompt } = body
    if (!room_id) return jsonResponse({ error: 'room_id is required' }, 400)
    if (!prompt?.trim()) return jsonResponse({ error: 'prompt is required' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const admin = await requireQuizAdmin(req, supabase, room_id)
    if (admin.error) return jsonResponse({ error: admin.error }, admin.status)
    const { room } = admin

    if (room.state !== 'setup') {
      return jsonResponse({ error: 'Questions can only be generated while the room is in setup' }, 403)
    }

    const fixedType = room.question_type === 'mixed' ? null : room.question_type

    await supabase.from('quiz_rooms').update({ ai_prompt: prompt.trim() }).eq('id', room_id)

    if (action === 'generate_batch') {
      const generated = await callGemini(
        buildPrompt({ topic: room.topic, adminPrompt: prompt.trim(), count: room.question_count, difficulty: room.difficulty, questionType: room.question_type }),
        room.question_count,
        fixedType
      )

      await supabase.from('quiz_questions').delete().eq('room_id', room_id)

      const rows = generated.map((q: any, i: number) => ({
        room_id,
        idx: i,
        type: q.type,
        prompt: q.prompt,
        options: q.options,
        correct_option_index: q.correct_option_index,
        explanation: q.explanation,
        difficulty: q.difficulty,
        duration_seconds: room.time_per_question_seconds,
      }))

      const { data: inserted, error } = await supabase.from('quiz_questions').insert(rows).select('*').order('idx')
      if (error) throw error
      return jsonResponse({ questions: inserted })
    }

    if (action === 'regenerate_one') {
      if (!Number.isInteger(index)) return jsonResponse({ error: 'index is required' }, 400)

      const generated = await callGemini(
        buildPrompt({ topic: room.topic, adminPrompt: prompt.trim(), count: 1, difficulty: room.difficulty, questionType: room.question_type }),
        1,
        fixedType
      )
      const q = generated[0]

      await supabase.from('quiz_questions').delete().eq('room_id', room_id).eq('idx', index)

      const { data: inserted, error } = await supabase
        .from('quiz_questions')
        .insert([{
          room_id, idx: index, type: q.type, prompt: q.prompt, options: q.options,
          correct_option_index: q.correct_option_index, explanation: q.explanation,
          difficulty: q.difficulty, duration_seconds: room.time_per_question_seconds,
        }])
        .select('*').single()
      if (error) throw error
      return jsonResponse({ question: inserted })
    }

    return jsonResponse({ error: 'Unknown action' }, 400)
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500)
  }
})
