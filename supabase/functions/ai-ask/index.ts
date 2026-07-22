// Place at: supabase/functions/ai-ask/index.ts
// Deploy: supabase functions deploy ai-ask
// Uses the same GEMINI_API_KEY secret as ai-analyst.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildStats, fetchSubmissions, jsonResponse, corsHeaders } from '../_shared/stats.ts'

const GEMINI_MODEL = 'gemini-3.5-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

Deno.serve(async req => {
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    const { form_id, question, submission_ids, language_style = 'plain' } = await req.json()
    if (!form_id || !question) return jsonResponse({ error: 'form_id and question are required' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: form, error: formError } = await supabase
      .from('forms').select('*').eq('id', form_id).single()
    if (formError || !form) throw formError || new Error('Form not found')

    const submissions = await fetchSubmissions(supabase, form_id, submission_ids)
    const stats = buildStats(form, submissions)

    const languageInstruction = language_style === 'technical'
      ? 'Use precise technical and analytical language, explaining abbreviations on first use.'
      : 'Use everyday plain English, avoiding technical jargon.'

    const prompt = `You are a business analyst. ${languageInstruction} Using only the aggregated data below for "${form.name}", answer the user's question directly and concisely (2-4 sentences). If the data doesn't contain enough information to answer, say so plainly rather than guessing.

Data:
${JSON.stringify(stats, null, 2)}

Question: ${question}`

    const geminiRes = await fetch(`${GEMINI_URL}?key=${Deno.env.get('GEMINI_API_KEY')}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
    })

    if (!geminiRes.ok) {
      throw new Error(`Gemini API error: ${geminiRes.status} ${await geminiRes.text()}`)
    }

    const geminiData = await geminiRes.json()
    const answer = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    if (!answer) throw new Error('No answer returned')

    return jsonResponse({ answer })
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500)
  }
})
