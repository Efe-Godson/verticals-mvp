// Place at: supabase/functions/ai-ask/index.ts
// Deploy: supabase functions deploy ai-ask
// Uses the same GEMINI_API_KEY (and optional OPENROUTER_API_KEY fallback,
// see _shared/aiProvider.ts) as ai-analyst.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildStats, fetchSubmissions, jsonResponse, corsHeaders, requireFormOwner } from '../_shared/stats.ts'
import { generateText } from '../_shared/aiProvider.ts'

Deno.serve(async req => {
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    const { form_id, question, submission_ids, language_style = 'plain' } = await req.json()
    if (!form_id || !question) return jsonResponse({ error: 'form_id and question are required' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const owner = await requireFormOwner(req, supabase, form_id)
    if (owner.error) return jsonResponse({ error: owner.error }, owner.status)
    const { form } = owner

    const submissions = await fetchSubmissions(supabase, form_id, submission_ids)
    const stats = buildStats(form, submissions)

    const languageInstruction = language_style === 'technical'
      ? 'Use precise technical and analytical language, explaining abbreviations on first use.'
      : 'Use everyday plain English, avoiding technical jargon.'

    const prompt = `You are a business analyst. ${languageInstruction} Using only the aggregated data below for "${form.name}", answer the user's question in 1-3 sentences. Start with the direct answer: no preamble, no restating the question, no hedging unless the data genuinely doesn't support an answer, in which case say so plainly in one sentence.

Data:
${JSON.stringify(stats, null, 2)}

Question: ${question}`

    const answer = (await generateText(prompt))?.trim()
    if (!answer) throw new Error('No answer returned')

    return jsonResponse({ answer })
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500)
  }
})
