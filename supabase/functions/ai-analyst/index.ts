// Place at: supabase/functions/ai-analyst/index.ts
// Deploy:    supabase functions deploy ai-analyst
// Secret:    supabase secrets set GEMINI_API_KEY=your_key
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically
// by Supabase into every edge function, no need to set them yourself.)
// Optional:  supabase secrets set OPENROUTER_API_KEY=your_key - falls back
// to OpenRouter's hosted Llama if Gemini hits a 429, see _shared/aiProvider.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildStats, fetchSubmissions, hashObject, jsonResponse, corsHeaders, requireFormOwner } from '../_shared/stats.ts'
import { generateText } from '../_shared/aiProvider.ts'

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    executiveSummary: { type: 'string' },
    keyInsights: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          detail: { type: 'string' },
          priority: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['title', 'detail', 'priority'],
      },
    },
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          detail: { type: 'string' },
          impact: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['title', 'detail', 'impact'],
      },
    },
    anomalies: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          detail: { type: 'string' },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['title', 'detail', 'severity'],
      },
    },
    forecasts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          metric: { type: 'string' },
          prediction: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          horizon: { type: 'string' },
        },
        required: ['metric', 'prediction', 'confidence', 'horizon'],
      },
    },
  },
  required: ['executiveSummary', 'keyInsights', 'recommendations', 'anomalies', 'forecasts'],
}

function buildPrompt(formName: string, stats: unknown, dateRangeLabel: string, languageStyle: string) {
  const languageInstruction = languageStyle === 'technical'
    ? 'Use precise technical and analytical language, while still explaining abbreviations on first use.'
    : 'Use everyday plain English. Avoid technical jargon and explain numbers in a way a non-specialist can understand.'
  return `You are a business analyst reviewing form submission data for "${formName}".
Date range: ${dateRangeLabel || 'All time'}.

Writing style: ${languageInstruction}

Aggregated data (already computed, do not recalculate, just reason over it):
${JSON.stringify(stats, null, 2)}

Produce a business analysis with:
- executiveSummary: 2-3 sentences, the single most important takeaway first.
- keyInsights: 3-5 concrete observations backed by the numbers above. Each "detail" is 1 sentence, specific and to the point, no filler.
- recommendations: 2-4 specific, actionable suggestions tied to the data. Each "detail" is 1 sentence.
- anomalies: unusual patterns or outliers if any genuinely stand out (empty array if none, do not invent anomalies to fill the list). Each "detail" is 1 sentence.
- forecasts: 1-3 short-term predictions with a stated confidence and horizon, clearly labeled as estimates, not guarantees.

Be succinct everywhere: every field should read like a headline, not a paragraph. Only state what the data supports. Do not fabricate numbers not present above.`
}

Deno.serve(async req => {
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    const { form_id, date_range_label, submission_ids, language_style = 'plain' } = await req.json()
    if (!form_id) return jsonResponse({ error: 'form_id is required' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const owner = await requireFormOwner(req, supabase, form_id)
    if (owner.error) return jsonResponse({ error: owner.error }, owner.status)
    const { form } = owner

    const submissions = await fetchSubmissions(supabase, form_id, submission_ids)

    const stats = buildStats(form, submissions)
    const dataHash = await hashObject({ form_id, date_range_label, language_style, count: submissions.length, stats })

    // Reuse a cached analysis if nothing's changed since the last generation
    // for this exact data slice, avoids burning free-tier quota on repeats.
    const { data: cached } = await supabase
      .from('ai_analyses').select('*')
      .eq('form_id', form_id).eq('data_hash', dataHash)
      .maybeSingle()

    if (cached) {
      return jsonResponse({ ...cached.result, cached: true, generated_at: cached.created_at })
    }

    const prompt = buildPrompt(form.name, stats, date_range_label, language_style)
    const text = await generateText(prompt, RESPONSE_SCHEMA)
    const result = JSON.parse(text)

    await supabase.from('ai_analyses').upsert(
      { form_id, data_hash: dataHash, result, created_at: new Date().toISOString() },
      { onConflict: 'form_id,data_hash' }
    )

    return jsonResponse({ ...result, cached: false, generated_at: new Date().toISOString() })
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500)
  }
})
