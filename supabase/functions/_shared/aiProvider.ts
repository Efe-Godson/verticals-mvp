// Place at: supabase/functions/_shared/aiProvider.ts
// Every AI edge function (ai-analyst, ai-ask, extract-products-ai,
// extract-order-ai) calls the model through generateText() instead of
// hitting a provider directly. Baseten (DeepSeek V4.1 Flash) is primary -
// cheap, fast, no free-tier quota to exhaust. A failure gets one same-tier
// retry (most failures on a hosted-inference endpoint are brief blips), then
// cascades to Gemini - whose responseSchema mode still gives strict
// structured decoding as a fallback - and finally to OpenRouter's hosted
// Llama (best-effort prompt-embedded schema + json_object mode) as the
// last resort before giving up entirely.
const GEMINI_MODEL = 'gemini-flash-latest'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
// The ":free" suffix matters - without it this is OpenRouter's paid Llama
// ($0.10 / $0.32 per 1M tokens), not the free tier this fallback is meant
// to be.
const OPENROUTER_MODEL = 'meta-llama/llama-3.3-70b-instruct:free'
const BASETEN_URL = 'https://inference.baseten.co/v1/chat/completions'
const BASETEN_MODEL = 'deepseek-ai/DeepSeek-V4.1-Flash'

// A cap only ever applied for structured (jsonSchema) calls - ai-analyst/
// ai-ask's free-form prose answers pass no schema and stay uncapped. 8192
// tokens is generous headroom above any realistic extraction response (even
// a large pasted menu's worth of products), so this only ever cuts off a
// truly runaway/repeating generation - the actual latency risk it guards
// against - rather than a normal-sized real answer.
const MAX_STRUCTURED_OUTPUT_TOKENS = 8192

async function callGemini(prompt: string, jsonSchema?: object) {
  const res = await fetch(`${GEMINI_URL}?key=${Deno.env.get('GEMINI_API_KEY')}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      ...(jsonSchema ? {
        generationConfig: {
          responseMimeType: 'application/json', responseSchema: jsonSchema,
          maxOutputTokens: MAX_STRUCTURED_OUTPUT_TOKENS,
        },
      } : {}),
    }),
  })
  if (!res.ok) {
    const err = new Error(`Gemini API error: ${res.status} ${await res.text()}`) as Error & { status: number }
    err.status = res.status
    throw err
  }
  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('No content returned from Gemini')
  return text
}

// OpenRouter has no equivalent of Gemini's schema-constrained decoding -
// response_format: json_object only guarantees valid JSON, not a specific
// shape. Callers' prompts describe the expected fields in prose (for
// Gemini's benefit too, schema or not), but nested key names (e.g.
// "fieldId"/"value" inside extract-order-ai's answers array) only ever
// appear in the RESPONSE_SCHEMA object itself, which Gemini enforces via
// responseSchema but which OpenRouter never sees. Left alone, OpenRouter
// guesses at key names and silently drops or mis-shapes whatever part of
// the prompt was less explicit - so the schema is serialized into the
// prompt here to give it the exact shape to follow.
async function callOpenRouter(prompt: string, jsonSchema?: object) {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY')
  if (!apiKey) throw new Error('Baseten and Gemini both failed, and OPENROUTER_API_KEY is not set, so there is no further fallback available right now.')

  const fullPrompt = jsonSchema
    ? `${prompt}\n\nRespond with ONLY a JSON object matching exactly this schema (use these exact property names and nesting, omit nothing the schema requires):\n${JSON.stringify(jsonSchema)}`
    : prompt

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [{ role: 'user', content: fullPrompt }],
      ...(jsonSchema ? { response_format: { type: 'json_object' }, max_tokens: MAX_STRUCTURED_OUTPUT_TOKENS } : {}),
    }),
  })
  if (!res.ok) throw new Error(`OpenRouter API error: ${res.status} ${await res.text()}`)
  const data = await res.json()
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('No content returned from OpenRouter')
  return text
}

// OpenAI-compatible Chat Completions endpoint, same request/response shape
// as callOpenRouter. DeepSeek's structured-output support isn't as
// well-established as OpenAI's own json_schema mode, so this plays it safe
// and reuses OpenRouter's approach: prompt-embed the schema and only ask for
// json_object mode, rather than trusting json_schema to be enforced
// strictly on what is now the primary tier.
async function callBaseten(prompt: string, jsonSchema?: object) {
  const apiKey = Deno.env.get('BASETEN_API_KEY')
  if (!apiKey) throw new Error('BASETEN_API_KEY is not set.')

  const fullPrompt = jsonSchema
    ? `${prompt}\n\nRespond with ONLY a JSON object matching exactly this schema (use these exact property names and nesting, omit nothing the schema requires):\n${JSON.stringify(jsonSchema)}`
    : prompt

  const res = await fetch(BASETEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: BASETEN_MODEL,
      messages: [{ role: 'user', content: fullPrompt }],
      ...(jsonSchema ? { response_format: { type: 'json_object' }, max_tokens: MAX_STRUCTURED_OUTPUT_TOKENS } : {}),
    }),
  })
  if (!res.ok) throw new Error(`Baseten API error: ${res.status} ${await res.text()}`)
  const data = await res.json()
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('No content returned from Baseten')
  return text
}

async function retryOnce<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch {
    return await fn()
  }
}

// jsonSchema: pass the Gemini responseSchema object for structured output -
// doubles as the signal to ask Baseten/OpenRouter for JSON mode on
// fallback. Omit for a plain free-text answer (see ai-ask).
export async function generateText(prompt: string, jsonSchema?: object) {
  try {
    // One same-tier retry before cascading further - most failures on a
    // hosted-inference endpoint are brief blips, cheaper to retry than to
    // fall all the way to a different provider.
    return await retryOnce(() => callBaseten(prompt, jsonSchema))
  } catch {
    try {
      return await callGemini(prompt, jsonSchema)
    } catch {
      return await callOpenRouter(prompt, jsonSchema)
    }
  }
}
